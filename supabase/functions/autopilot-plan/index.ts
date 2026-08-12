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
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return respond({ error: 'Sign in to use Forge AI.' }, 401)
    const keySet = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<
      string,
      string
    >
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? keySet.default
    if (!publishableKey)
      return respond({ error: 'Forge AI is missing its Supabase function configuration.' }, 503)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userResult } = await supabase.auth.getUser()
    if (!userResult.user)
      return respond({ error: 'Your Forge session is no longer valid. Please sign in again.' }, 401)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey)
      return respond(
        { error: 'Forge AI is not configured yet. Add OPENAI_API_KEY to Edge Function Secrets.' },
        503,
      )
    let body: { workItems?: WorkItem[] }
    try {
      body = await request.json()
    } catch {
      return respond({ error: 'Invalid request body.' }, 400)
    }
    const workItems = (body.workItems ?? []).slice(0, 40).map((item) => ({
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
    if (!openai.ok) {
      const provider = (await openai.json().catch(() => null)) as {
        error?: { message?: string }
      } | null
      console.error('OpenAI planning request failed', openai.status, provider?.error?.message)
      return respond(
        {
          error: `OpenAI could not plan (${openai.status}). Check API billing, model access, and the OPENAI_API_KEY secret.`,
        },
        502,
      )
    }
    const result = await openai.json()
    const text =
      result.output_text ??
      result.output
        ?.flatMap((entry: { content?: { text?: string }[] }) => entry.content ?? [])
        .map((content: { text?: string }) => content.text ?? '')
        .join('')
    const json = String(text).replace(/^```(?:json)?\s*|\s*```$/g, '')
    const direction = JSON.parse(json) as {
      workItemId: string
      title: string
      reason: string
      minutes: number
    }
    const selectedItem = workItems.find((item) => item.id === direction.workItemId)
    if (!selectedItem) throw new Error('Unknown work item')
    // The id is authoritative. Never let an AI-generated label point at a different task.
    direction.title = selectedItem.title
    direction.minutes = [15, 25, 45].includes(direction.minutes) ? direction.minutes : 25
    return respond({ direction })
  } catch (error) {
    console.error('Autopilot planner failed', error)
    return respond(
      {
        error:
          'Forge AI could not finish planning. Check the Edge Function logs for the safe error detail.',
      },
      500,
    )
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
