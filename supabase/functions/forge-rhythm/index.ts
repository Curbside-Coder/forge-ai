import { createClient } from 'npm:@supabase/supabase-js@2'

type RhythmKind = 'morning' | 'eod' | 'monday' | 'friday'
type Preference = {
  owner_id: string
  timezone: string
  morning_hour: number
  eod_hour: number
  email_enabled: boolean
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
    if (!serviceKey) return json({ error: 'Rhythm service configuration is missing.' }, 503)
    const admin = createClient(url, serviceKey)
    const cronToken = request.headers.get('x-forge-cron-token')
    const isCron = Boolean(cronToken && cronToken === Deno.env.get('FORGE_CRON_TOKEN'))
    let ownerId: string | null = null
    if (!isCron) {
      const authorization = request.headers.get('Authorization')
      if (!authorization) return json({ error: 'Unauthorized.' }, 401)
      const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authorization } },
      })
      const { data } = await client.auth.getUser()
      ownerId = data.user?.id ?? null
      if (!ownerId) return json({ error: 'Unauthorized.' }, 401)
    }
    const preferenceQuery = admin.from('forge_rhythm_preferences').select('*')
    const { data: preferences, error } = await (ownerId
      ? preferenceQuery.eq('owner_id', ownerId)
      : preferenceQuery)
    if (error) return json({ error: error.message }, 500)
    const due = (preferences as Preference[]).flatMap((preference) =>
      dueKinds(preference).map((kind) => ({ preference, kind })),
    )
    const reports = []
    for (const entry of due) {
      const report = await generateReport(admin, entry.preference, entry.kind)
      if (report) reports.push(report)
    }
    return json({ generated: reports.length, reports })
  } catch (error) {
    console.error('Forge Rhythm failed', error)
    return json({ error: 'Forge Rhythm could not run.' }, 500)
  }
})

function dueKinds(preference: Preference): RhythmKind[] {
  const local = new Intl.DateTimeFormat('en-US', {
    timeZone: preference.timezone,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const weekday = local.find((part) => part.type === 'weekday')?.value
  const hour = Number(local.find((part) => part.type === 'hour')?.value)
  if (weekday === 'Mon' && hour === preference.morning_hour) return ['monday']
  if (weekday === 'Fri' && hour === preference.eod_hour) return ['friday']
  if (hour === preference.morning_hour) return ['morning']
  if (hour === preference.eod_hour) return ['eod']
  return []
}

async function generateReport(
  admin: ReturnType<typeof createClient>,
  preference: Preference,
  kind: RhythmKind,
) {
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: preference.timezone }).format(
    new Date(),
  )
  const existing = await admin
    .from('forge_rhythm_reports')
    .select('id')
    .eq('owner_id', preference.owner_id)
    .eq('kind', kind)
    .eq('period_date', localDate)
    .maybeSingle()
  if (existing.data) return null
  const since =
    kind === 'monday' || kind === 'friday'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : new Date(`${localDate}T00:00:00`).toISOString()
  const [work, meetings] = await Promise.all([
    admin
      .from('work_items')
      .select('id,title,status,priority,updated_at')
      .eq('created_by', preference.owner_id)
      .gte('updated_at', since),
    admin
      .from('meetings')
      .select('id,title,created_at')
      .eq('created_by', preference.owner_id)
      .gte('created_at', since),
  ])
  const items = work.data ?? []
  const done = items.filter((item) => item.status === 'done')
  const open = items.filter((item) => item.status !== 'done')
  const facts = {
    completed: done.length,
    open: open.length,
    meetings: (meetings.data ?? []).length,
    criticalOpen: open.filter((item) => item.priority === 'critical').length,
  }
  const title = titles[kind]
  const body = await writeReport(kind, facts, items.slice(0, 30))
  const { data: saved, error } = await admin
    .from('forge_rhythm_reports')
    .insert({ owner_id: preference.owner_id, kind, period_date: localDate, title, body, facts })
    .select()
    .single()
  if (error) throw error
  if (preference.email_enabled && ['eod', 'monday', 'friday'].includes(kind))
    await sendEmail(admin, preference.owner_id, title, body, saved.id)
  return saved
}

const titles: Record<RhythmKind, string> = {
  morning: 'Your Forge direction for today',
  eod: 'End-of-day Forge report',
  monday: 'Monday one-on-one with Forge',
  friday: 'Friday weekly closeout',
}
async function writeReport(kind: RhythmKind, facts: Record<string, number>, items: unknown[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey)
    return `${facts.completed} completed, ${facts.open} still open, and ${facts.meetings} meeting(s) recorded. AI commentary will appear once OPENAI_API_KEY is configured.`
  const prompt = `You are Forge, a direct but fair personal executive assistant. Write a concise ${kind} report from these facts and items. Separate facts from interpretation. Be candid about lagging without shame. Give at most three concrete next directions. Include family, health, or rest only when the facts support a balanced suggestion. Facts: ${JSON.stringify(facts)}. Work: ${JSON.stringify(items)}`
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-terra',
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      input: prompt,
    }),
  })
  const result = await response.json().catch(() => null)
  return response.ok && result?.output_text
    ? result.output_text
    : `${facts.completed} completed, ${facts.open} still open, and ${facts.meetings} meeting(s) recorded.`
}
async function sendEmail(
  admin: ReturnType<typeof createClient>,
  ownerId: string,
  subject: string,
  body: string,
  reportId: string,
) {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!key || !from) return
  const { data } = await admin.auth.admin.getUserById(ownerId)
  const email = data.user?.email
  if (!email) return
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject, text: body }),
  })
  if (response.ok)
    await admin
      .from('forge_rhythm_reports')
      .update({ emailed_at: new Date().toISOString() })
      .eq('id', reportId)
}
