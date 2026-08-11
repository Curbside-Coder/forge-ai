import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Suggestion = {
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  type: 'task' | 'bug' | 'feature' | 'idea' | 'research' | 'improvement'
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
    const body = (await request.json()) as { title?: string; notes?: string }
    const notes = body.notes?.trim().slice(0, 14000) ?? ''
    if (!notes) return respond({ error: 'Add meeting notes before asking Forge AI.' }, 400)
    const prompt = `You are Forge, a precise AI secretary for one developer. Analyze these meeting notes. Return JSON only with: summary (2-4 concise sentences) and workItems (0-8 items). Each work item needs title, description, priority (critical|high|medium|low), and type (task|bug|feature|idea|research|improvement). Extract only genuine actionable commitments or useful follow-ups. Combine duplicates, omit vague discussion, do not invent owners, dates, facts, or commitments. Descriptions must provide useful context from the notes.\n\nMeeting title: ${body.title?.slice(0, 180) || 'Untitled meeting'}\n\nNotes:\n${notes}`
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
    if (!openai.ok) {
      console.error('OpenAI meeting request failed', openai.status)
      return respond({ error: `OpenAI could not analyze this meeting (${openai.status}).` }, 502)
    }
    const result = await openai.json()
    const text =
      result.output_text ??
      result.output
        ?.flatMap((entry: { content?: { text?: string }[] }) => entry.content ?? [])
        .map((content: { text?: string }) => content.text ?? '')
        .join('')
    const parsed = JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, '')) as {
      summary?: string
      workItems?: Suggestion[]
    }
    const priorities = new Set<Suggestion['priority']>(['critical', 'high', 'medium', 'low'])
    const types = new Set<Suggestion['type']>([
      'task',
      'bug',
      'feature',
      'idea',
      'research',
      'improvement',
    ])
    const workItems = (parsed.workItems ?? []).slice(0, 8).flatMap((item) => {
      const title = item.title?.trim().slice(0, 180)
      if (!title) return []
      return [
        {
          title,
          description:
            item.description?.trim().slice(0, 1200) || `Follow up from this meeting: ${title}`,
          priority: priorities.has(item.priority) ? item.priority : 'medium',
          type: types.has(item.type) ? item.type : 'task',
        },
      ]
    })
    return respond({
      summary: parsed.summary?.trim().slice(0, 1200) || 'Meeting notes analyzed.',
      workItems,
    })
  } catch (error) {
    console.error('Meeting analysis failed', error)
    return respond({ error: 'Forge AI could not analyze these notes. Please try again.' }, 500)
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
