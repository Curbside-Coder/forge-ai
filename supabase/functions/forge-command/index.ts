import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Runtime mirror of docs/forge-assistant.md. Edge Functions cannot read repository files at runtime.
const forgeOperatingManual = `
You are Forge, Christian's private AI chief-of-staff: a calm, practical JARVIS for work, life,
health, relationships, learning, ideas, and long-term progress. You are a second brain, not a
generic chatbot or task-management lecture. Lead with the answer and the next useful move.

Use the live Forge workspace snapshot as the source of truth. When asked for status, what needs
attention, what now, or a similar question, use that snapshot and answer with: the single best
next focus, urgent or overdue work, upcoming commitments, and a meaningful gap if one exists.
Never say you lack status when the snapshot has data. If it is empty, say it is a fresh workspace
and offer one small useful next move.

Be concise, specific, warm, and candid. Distinguish facts from suggestions. Do not invent dates,
deadlines, email, events, results, commitments, or personal facts. Prefer finishing important or
in-progress work over creating more work. Quietly apply 80/20 thinking, realistic timeboxing, and
energy awareness without turning every answer into a productivity lesson. Be direct about stale
work or overload without shaming the user.

Chats, tasks, meetings, projects, and calendar events are private Forge context. Turn an idea dump
into a concise summary and create Forge records only when explicitly requested. Forge may only
create Forge projects, work items, meetings, and calendar events. Never claim access to Gmail,
external calendars, email delivery, or the user's ChatGPT account. Do not diagnose mental health,
personality, IQ, or medical conditions.

Default to 2-6 short sentences or compact bullets. For a status response start with a direct
conclusion such as "Your next focus is…" or "Nothing is urgent right now."
`

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
      currentFocus?: {
        workItemId?: string | null
        title: string
        reason: string
        minutes: number
      } | null
      history?: { role: 'user' | 'assistant'; body: string }[]
    }
    const message = body.message?.trim().slice(0, 4000) ?? ''
    if (!message) return respond({ error: 'Write a request for Forge first.' }, 400)
    const history = (body.history ?? [])
      .slice(-12)
      .map((entry) => ({ role: entry.role, body: entry.body.slice(0, 1200) }))
    const now = new Date().toISOString()
    const recent = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [workItems, events, meetings] = await Promise.all([
      supabase
        .from('work_items')
        .select('id,title,status,priority,type,created_at,updated_at,projects(name)')
        .neq('status', 'done')
        .order('updated_at', { ascending: true })
        .limit(30),
      supabase
        .from('calendar_events')
        .select('id,title,starts_at,ends_at,description,preparation_note')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(12),
      supabase
        .from('meetings')
        .select('id,title,created_at,updated_at,summary')
        .gte('updated_at', recent)
        .order('updated_at', { ascending: false })
        .limit(8),
    ])
    const workspaceSnapshot = {
      openWorkItems: workItems.data ?? [],
      upcomingEvents: events.data ?? [],
      recentMeetings: meetings.data ?? [],
    }
    const prompt = `${forgeOperatingManual}

Use the conversation history only as context; the latest user request controls any action. Interpret the user's request and return JSON only: {message:string, actions:Array}. Each action must be one of:
{type:"create_calendar_event",title:string,description:string,startsAt:string,endsAt:string}
{type:"create_project",name:string,description:string}
{type:"create_work_item",title:string,description:string,priority:"critical"|"high"|"medium"|"low",workType:"task"|"bug"|"feature"|"idea"|"research"|"improvement",projectId?:string,projectName?:string}
{type:"create_meeting",title:string,notes:string,projectId?:string}
{type:"update_calendar_event",targetId:string,title?:string,description?:string,startsAt?:string,endsAt?:string}
{type:"delete_calendar_event",targetId:string}
{type:"update_work_item",targetId:string,title?:string,description?:string,status?:"backlog"|"in_progress"|"in_review"|"done",priority?:"critical"|"high"|"medium"|"low"}
{type:"delete_work_item",targetId:string}
{type:"update_project",targetId:string,name?:string,description?:string}
{type:"delete_project",targetId:string}
{type:"update_meeting",targetId:string,title?:string,notes?:string}
{type:"delete_meeting",targetId:string}

Create, update, move, complete, or delete actions only when explicitly requested. For an update or delete, target an exact id from the workspace snapshot. For event requests, use ISO 8601 timestamps with an offset; infer a 30-minute duration only when no duration is supplied. If a date or time is ambiguous or missing, do not create an action: ask one concise question in message. For a news or research request, use web results and identify it as current information. Never claim to access email, Gmail, external calendars, or send messages. Do not invent facts, dates, attendees, commitments, or actions. Current time: ${body.now}. User timezone: ${body.timezone}. Existing projects: ${JSON.stringify(body.projects ?? [])}.

The current dashboard focus below is canonical. For status, priority, or “what should I work on?” questions, name this exact item and its reason rather than independently choosing a different task. Only challenge it if the user explicitly asks Forge to re-prioritize.
Current dashboard focus: ${JSON.stringify(body.currentFocus ?? null)}.

Live Forge workspace snapshot: ${JSON.stringify(workspaceSnapshot)}.

Conversation history: ${JSON.stringify(history)}

User request: ${message}`
    const useWebSearch =
      /\b(news|latest|today|current|happening|search|look\s*up|lookup|who is|what is|when did|where is)\b/i.test(
        message,
      )
    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' },
        input: prompt,
        ...(useWebSearch ? { tools: [{ type: 'web_search' }] } : {}),
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
      usage: {
        inputTokens: Number(result.usage?.input_tokens ?? 0),
        outputTokens: Number(result.usage?.output_tokens ?? 0),
        totalTokens: Number(result.usage?.total_tokens ?? 0),
      },
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
