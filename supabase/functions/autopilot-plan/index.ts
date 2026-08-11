import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type WorkItem = {
  id: string
  title: string
  description: string
  priority: string
  status: string
  updatedAt: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization) return respond({ error: 'Sign in to use Forge AI.' }, 401)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userResult } = await supabase.auth.getUser()
  if (!userResult.user) return respond({ error: 'Your Forge session is no longer valid.' }, 401)
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return respond({ error: 'Forge AI is not configured yet.' }, 503)
  let body: { workItems?: WorkItem[] }
  try {
    body = await request.json()
  } catch {
    return respond({ error: 'Invalid request body.' }, 400)
  }
  const workItems = (body.workItems ?? [])
    .slice(0, 40)
    .map((item) => ({
      id: item.id,
      title: item.title.slice(0, 180),
      description: item.description.slice(0, 1000),
      priority: item.priority,
      status: item.status,
      updatedAt: item.updatedAt,
    }))
  if (workItems.length === 0)
    return respond({ direction: null, reason: 'There is no open work to plan yet.' })
  const prompt = `You are Forge Autopilot, a calm executive assistant for one developer. Choose exactly one next direction from the work items below. Do not invent projects, deadlines, commitments, or extra steps. Prefer finishing in-progress or critical work, but use judgment. Return JSON only with: workItemId, title, reason, minutes. minutes must be 15, 25, or 45. reason must be one direct sentence under 160 characters.\n\nWork items:\n${JSON.stringify(workItems)}`
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
  if (!openai.ok) return respond({ error: 'Forge AI could not plan right now.' }, 502)
  const result = await openai.json()
  const text =
    result.output_text ??
    result.output
      ?.flatMap((entry: { content?: { text?: string }[] }) => entry.content ?? [])
      .map((content: { text?: string }) => content.text ?? '')
      .join('')
  try {
    const json = String(text).replace(/^```(?:json)?\s*|\s*```$/g, '')
    const direction = JSON.parse(json) as {
      workItemId: string
      title: string
      reason: string
      minutes: number
    }
    if (!workItems.some((item) => item.id === direction.workItemId))
      throw new Error('Unknown work item')
    direction.minutes = [15, 25, 45].includes(direction.minutes) ? direction.minutes : 25
    return respond({ direction })
  } catch {
    return respond({ error: 'Forge AI returned an invalid plan. Please try again.' }, 502)
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
