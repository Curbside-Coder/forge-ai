import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return respond({ ok: true })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return respond({ error: 'Sign in to use Forge AI.' }, 401)
    const keySet = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<
      string,
      string
    >
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? keySet.default
    if (!publishableKey)
      return respond({ error: 'Forge AI is missing its function configuration.' }, 503)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userResult } = await supabase.auth.getUser()
    if (!userResult.user) return respond({ error: 'Your Forge session is no longer valid.' }, 401)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return respond({ error: 'Forge AI is not configured yet.' }, 503)
    const body = (await request.json()) as {
      message?: string
      now?: string
      timezone?: string
      projects?: { id: string; name: string }[]
    }
    const message = body.message?.trim().slice(0, 4000) ?? ''
    if (!message) return respond({ error: 'Write a request for Forge first.' }, 400)
    const prompt = `You are Forge, an execution assistant for one developer. Interpret the user's request and return JSON only: {message:string, actions:Array}. Each action must be one of:
{type:"create_calendar_event",title:string,description:string,startsAt:string,endsAt:string}
{type:"create_project",name:string,description:string}
{type:"create_work_item",title:string,description:string,priority:"critical"|"high"|"medium"|"low",workType:"task"|"bug"|"feature"|"idea"|"research"|"improvement",projectId?:string,projectName?:string}
{type:"create_meeting",title:string,notes:string,projectId?:string}

Create actions only when explicitly requested. For event requests, use ISO 8601 timestamps with an offset; infer a 30-minute duration only when no duration is supplied. If a date or time is ambiguous or missing, do not create an action: ask one concise question in message. Never claim to access email, Gmail, external calendars, or send messages. Do not invent facts, dates, attendees, commitments, or actions. Current time: ${body.now}. User timezone: ${body.timezone}. Existing projects: ${JSON.stringify(body.projects ?? [])}.\n\nUser request: ${message}`
    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' },
        input: prompt,
      }),
    })
    if (!openai.ok)
      return respond({ error: `OpenAI could not process this request (${openai.status}).` }, 502)
    const result = await openai.json()
    const output =
      result.output_text ??
      result.output
        ?.flatMap((entry: { content?: { text?: string }[] }) => entry.content ?? [])
        .map((content: { text?: string }) => content.text ?? '')
        .join('')
    const parsed = JSON.parse(String(output).replace(/^```(?:json)?\s*|\s*```$/g, '')) as {
      message?: string
      actions?: unknown[]
    }
    return respond({
      message: parsed.message?.slice(0, 800) ?? 'I could not interpret that request.',
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 8) : [],
    })
  } catch (error) {
    console.error('Forge command failed', error)
    return respond({ error: 'Forge AI could not complete that request. Please try again.' }, 500)
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
