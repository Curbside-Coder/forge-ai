import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PlanStep = { title: string; notes: string; minutes: number }

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
      title?: string
      description?: string
      type?: string
      priority?: string
    }
    const title = body.title?.trim().slice(0, 180) ?? ''
    if (!title) return respond({ error: 'A work-item title is required.' }, 400)
    const prompt = `You are Forge, a practical AI chief-of-staff for one developer. Build an execution brief for the work item below. Return JSON only with: problemStatement, desiredOutcome, briefMarkdown, steps.

briefMarkdown must be concise GitHub-flavored Markdown. Include these headings when useful: ## Recommended approach, ## Why this is the right move, ## Risks / checks, ## References. Explain clearly enough for the user to act. Include a Mermaid flowchart code block only when a flow makes the work materially clearer. Add external references only when they are genuinely useful; never invent links. Do not claim you solved, tested, searched, or changed anything. steps must have 2-7 small ordered actions with title, notes, and minutes (15, 25, or 45). Focus on the next concrete path, not ceremony.

Work item title: ${title}
Type: ${body.type ?? 'task'}
Priority: ${body.priority ?? 'medium'}
Context: ${body.description?.trim().slice(0, 8000) || 'No further context supplied.'}`
    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        reasoning: { effort: 'low' },
        text: { verbosity: 'medium' },
        input: prompt,
      }),
    })
    if (!openai.ok)
      return respond({ error: `OpenAI could not build this plan (${openai.status}).` }, 502)
    const result = await openai.json()
    const output =
      result.output_text ??
      result.output
        ?.flatMap((entry: { content?: { text?: string }[] }) => entry.content ?? [])
        .map((content: { text?: string }) => content.text ?? '')
        .join('')
    const parsed = JSON.parse(String(output).replace(/^```(?:json)?\s*|\s*```$/g, '')) as {
      problemStatement?: string
      desiredOutcome?: string
      briefMarkdown?: string
      steps?: PlanStep[]
    }
    const steps = (parsed.steps ?? []).slice(0, 7).flatMap((step) => {
      const stepTitle = step.title?.trim().slice(0, 240)
      if (!stepTitle) return []
      return [
        {
          title: stepTitle,
          notes: step.notes?.trim().slice(0, 1600) ?? '',
          minutes: [15, 25, 45].includes(step.minutes) ? step.minutes : 25,
        },
      ]
    })
    if (!steps.length)
      return respond({ error: 'Forge did not return usable plan steps. Please try again.' }, 502)
    return respond({
      problemStatement: parsed.problemStatement?.trim().slice(0, 2000) || `Move ${title} forward.`,
      desiredOutcome:
        parsed.desiredOutcome?.trim().slice(0, 2000) ||
        `A useful outcome for ${title} is complete.`,
      briefMarkdown:
        parsed.briefMarkdown?.trim().slice(0, 12000) ||
        `## Recommended approach\n\nStart with the first checklist item.`,
      steps,
    })
  } catch (error) {
    console.error('Forge work plan failed', error)
    return respond({ error: 'Forge AI could not build this plan. Please try again.' }, 500)
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
