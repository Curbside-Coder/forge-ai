/* eslint-disable react-hooks/set-state-in-effect */
import {
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Download,
  Copy,
  KeyRound,
  Clock3,
  Play,
  Plus,
  Save,
  Settings2,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { supabase } from '@/lib/supabase'

type FieldKind = 'text' | 'select'
type TrackerField = {
  id: string
  label: string
  type: FieldKind
  options?: string[]
  defaultValue?: string
}
type Entry = {
  id: string
  project_id: string
  started_at: string
  ended_at: string
  duration_seconds: number
  description: string
  billing_status: string
  approval_status: string
  custom_fields: Record<string, string>
  source: string
  page_url: string | null
  page_title: string | null
}
type ActiveTimer = {
  projectId: string
  startedAt: string
  description: string
  values: Record<string, string>
  pageUrl?: string
  pageTitle?: string
}
type DbActiveTimer = {
  project_id: string
  started_at: string
  description: string
  custom_fields: Record<string, string>
  page_url: string | null
  page_title: string | null
}
const admiredFields: TrackerField[] = [
  { id: 'client_name', label: 'Client name', type: 'text', defaultValue: 'Admired' },
  { id: 'project_name', label: 'Project name', type: 'text' },
  { id: 'job_name', label: 'Job name', type: 'text' },
  { id: 'employee_id', label: 'Employee ID', type: 'text', defaultValue: 'EXP_PH_0011' },
  { id: 'email', label: 'Email ID', type: 'text', defaultValue: 'christian@expressionable.com' },
  { id: 'first_name', label: 'First name', type: 'text', defaultValue: 'Christian' },
  { id: 'last_name', label: 'Last name', type: 'text', defaultValue: 'Foster' },
  {
    id: 'reporting_to',
    label: 'Reporting to',
    type: 'text',
    defaultValue: 'EXP_TPA_0001 Amit Bhalla',
  },
  { id: 'department', label: 'Department', type: 'text', defaultValue: 'Technology' },
  {
    id: 'designation',
    label: 'Designation',
    type: 'text',
    defaultValue: 'Full-Stack Web Developer',
  },
  { id: 'location', label: 'Location', type: 'text', defaultValue: 'Philippines' },
  {
    id: 'shift_details',
    label: 'Shift details',
    type: 'text',
    defaultValue: 'Support Early (06:00 AM - 01:00 PM)',
  },
  { id: 'release', label: 'Release', type: 'text' },
  {
    id: 'billing_status',
    label: 'Billing status',
    type: 'select',
    options: ['Billable', 'Non-billable'],
    defaultValue: 'Billable',
  },
  {
    id: 'approval_status',
    label: 'Approval status',
    type: 'select',
    options: ['Not Submitted', 'Submitted', 'Approved', 'Rejected'],
    defaultValue: 'Not Submitted',
  },
]

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
const dateKey = (value: string) => new Date(value).toLocaleDateString('en-CA')
const mapActive = (row: DbActiveTimer): ActiveTimer => ({
  projectId: row.project_id,
  startedAt: row.started_at,
  description: row.description,
  values: row.custom_fields ?? {},
  pageUrl: row.page_url ?? undefined,
  pageTitle: row.page_title ?? undefined,
})
const defaultsFor = (fields: TrackerField[]) =>
  Object.fromEntries(fields.map((field) => [field.id, field.defaultValue ?? ''])) as Record<
    string,
    string
  >
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const asFields = (value: unknown): TrackerField[] =>
  Array.isArray(value) ? (value as TrackerField[]) : []

export function TimeTrackerPage({ settingsOnly = false }: { settingsOnly?: boolean }) {
  const { user } = useAuth()
  const { projects } = useWorkspace()
  const [entries, setEntries] = useState<Entry[]>([])
  const [settings, setSettings] = useState<Record<string, TrackerField[]>>({})
  const [projectId, setProjectId] = useState('')
  const [active, setActive] = useState<ActiveTimer | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [description, setDescription] = useState(
    () => new URLSearchParams(window.location.search).get('note') ?? '',
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const currentProject = projects.find((project) => project.id === projectId)
  const fields = useMemo(
    () =>
      settings[projectId] ??
      (currentProject?.name.toLowerCase() === 'admired' ? admiredFields : []),
    [currentProject?.name, projectId, settings],
  )
  const calendar = useMemo(() => calendarDays(month), [month])
  const secondsByDay = useMemo(() => {
    const next: Record<string, number> = {}
    entries.forEach((entry) => {
      next[dateKey(entry.started_at)] =
        (next[dateKey(entry.started_at)] ?? 0) + entry.duration_seconds
    })
    return next
  }, [entries])

  const load = useCallback(async () => {
    if (!supabase || !user) return
    const [entryResult, settingsResult, activeResult] = await Promise.all([
      supabase.from('time_entries').select('*').order('started_at', { ascending: false }),
      supabase.from('time_tracking_project_settings').select('project_id,fields'),
      supabase.from('active_time_trackers').select('*').maybeSingle(),
    ])
    const issue = entryResult.error ?? settingsResult.error ?? activeResult.error
    if (issue) {
      setError(issue.message)
      return
    }
    setEntries((entryResult.data ?? []) as Entry[])
    setActive(activeResult.data ? mapActive(activeResult.data as DbActiveTimer) : null)
    setSettings(
      Object.fromEntries(
        (settingsResult.data ?? []).map((row) => [row.project_id, asFields(row.fields)]),
      ),
    )
  }, [user])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const client = supabase
    if (!client || !user) return
    const channel = client
      .channel(`forge-active-timer-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_time_trackers',
          filter: `owner_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe()
    const refresh = window.setInterval(() => void load(), 15_000)
    return () => {
      window.clearInterval(refresh)
      void client.removeChannel(channel)
    }
  }, [load, user])
  useEffect(() => {
    if (!projectId && projects[0])
      setProjectId(
        projects.find((item) => item.name.toLowerCase() === 'admired')?.id ?? projects[0].id,
      )
  }, [projectId, projects])
  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const refresh = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)),
      )
    refresh()
    const timer = window.setInterval(refresh, 1000)
    return () => window.clearInterval(timer)
  }, [active])
  useEffect(() => {
    if (!active || active.projectId !== projectId) return
    setDescription(active.description)
    setValues(active.values)
  }, [active, projectId])
  useEffect(() => {
    if (active) return
    setValues(defaultsFor(fields))
  }, [active, projectId, fields])

  const start = async () => {
    if (!projectId || !supabase || !user) return
    const incoming = new URLSearchParams(window.location.search)
    const next: ActiveTimer = {
      projectId,
      startedAt: new Date().toISOString(),
      description,
      values,
      pageUrl: incoming.get('pageUrl') ?? undefined,
      pageTitle: incoming.get('pageTitle') ?? undefined,
    }
    const { data, error: issue } = await supabase
      .from('active_time_trackers')
      .upsert(
        {
          owner_id: user.id,
          project_id: next.projectId,
          started_at: next.startedAt,
          description: next.description,
          custom_fields: next.values,
          page_url: next.pageUrl ?? null,
          page_title: next.pageTitle ?? null,
        },
        { onConflict: 'owner_id' },
      )
      .select()
      .single()
    if (issue) {
      setError(issue.message)
      return
    }
    setActive(mapActive(data as DbActiveTimer))
    setNotice(`Tracking ${currentProject?.name ?? 'this project'}.`)
  }
  const exportEntries = (format: 'csv' | 'json', range: 'month' | 'all') => {
    const start = range === 'month' ? startOfMonth(month).getTime() : Number.NEGATIVE_INFINITY
    const end =
      range === 'month'
        ? new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
        : Number.POSITIVE_INFINITY
    const selected = entries.filter(
      (entry) =>
        (!projectId || entry.project_id === projectId) &&
        new Date(entry.started_at).getTime() >= start &&
        new Date(entry.started_at).getTime() < end,
    )
    const projectName = (currentProject?.name ?? 'forge').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const period =
      range === 'month'
        ? month.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' })
        : 'all-time'
    const content =
      format === 'csv' ? timeEntriesCsv(selected, fields) : JSON.stringify(selected, null, 2)
    const blob = new Blob([content], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `forge-${projectName}-time-${period}.${format}`
    link.click()
    URL.revokeObjectURL(link.href)
    setNotice(
      `${selected.length} ${selected.length === 1 ? 'entry' : 'entries'} exported as ${format.toUpperCase()}.`,
    )
  }
  const stop = async () => {
    if (!active || !supabase || !user) return
    const endedAt = new Date().toISOString()
    const duration = Math.max(
      1,
      Math.floor((new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 1000),
    )
    const { error: issue } = await supabase.from('time_entries').insert({
      owner_id: user.id,
      project_id: active.projectId,
      started_at: active.startedAt,
      ended_at: endedAt,
      duration_seconds: duration,
      description: active.description,
      billing_status: active.values.billing_status || 'Billable',
      approval_status: active.values.approval_status || 'Not Submitted',
      custom_fields: active.values,
      source: active.pageUrl ? 'chrome-extension' : 'forge',
      page_url: active.pageUrl ?? null,
      page_title: active.pageTitle ?? null,
    })
    if (issue) {
      setError(issue.message)
      return
    }
    const { error: removeIssue } = await supabase
      .from('active_time_trackers')
      .delete()
      .eq('owner_id', user.id)
    if (removeIssue) {
      setError(removeIssue.message)
      return
    }
    setActive(null)
    setDescription('')
    setNotice('Time entry saved to Forge.')
    await load()
  }
  const createPairingCode = async () => {
    if (!supabase || !user) return
    const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '')
    const bytes = new TextEncoder().encode(raw)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const tokenHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const { error: issue } = await supabase
      .from('time_tracker_extension_tokens')
      .insert({ owner_id: user.id, token_hash: tokenHash })
    if (issue) {
      setError(issue.message)
      return
    }
    setPairingCode(raw)
    setNotice(
      'Chrome pairing code created. Copy it into the extension once; it is never shown again.',
    )
  }
  const saveFields = async () => {
    if (!supabase || !user || !projectId) return
    const next = settings[projectId] ?? fields
    const { error: issue } = await supabase
      .from('time_tracking_project_settings')
      .upsert(
        { project_id: projectId, owner_id: user.id, fields: next },
        { onConflict: 'project_id' },
      )
    if (issue) {
      setError(issue.message)
      return
    }
    setSettings((current) => ({ ...current, [projectId]: next }))
    setNotice(`${currentProject?.name ?? 'Project'} time-log fields saved.`)
  }
  const updateFields = (next: TrackerField[]) =>
    setSettings((current) => ({ ...current, [projectId]: next }))

  if (settingsOnly)
    return (
      <TrackerSettings
        projectId={projectId}
        setProjectId={setProjectId}
        projects={projects}
        fields={fields}
        updateFields={updateFields}
        saveFields={saveFields}
        notice={notice}
        error={error}
        entries={entries}
        month={month}
        setMonth={setMonth}
        calendar={calendar}
        secondsByDay={secondsByDay}
      />
    )
  return (
    <section>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-zinc-500">Evidence of where your time goes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Time tracker</h1>
          <p className="mt-2 text-zinc-500">
            Track active work in Forge or capture the page you are working on from Chrome.
          </p>
        </div>
        <Link
          to="/time-tracker/settings"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          <Settings2 className="size-4" />
          Project fields & calendar
        </Link>
      </div>
      {(error || notice) && (
        <p
          className={`mt-6 rounded-xl px-4 py-3 text-sm ${error ? 'bg-rose-400/10 text-rose-200' : 'bg-emerald-400/10 text-emerald-100'}`}
        >
          {error || notice}
        </p>
      )}
      <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl bg-white/[0.025] px-4 py-3 ring-1 ring-white/[0.06] sm:flex-row sm:items-center">
        <p className="text-sm text-zinc-500">
          Export {currentProject?.name ?? 'selected project'} time for other tools.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportEntries('csv', 'month')}
            className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-zinc-300 transition hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <Download className="size-4" /> CSV · this month
          </button>
          <button
            onClick={() => exportEntries('csv', 'all')}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            CSV · all time
          </button>
          <button
            onClick={() => exportEntries('json', 'all')}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            JSON backup
          </button>
        </div>
      </div>
      <details className="mt-4 rounded-xl bg-white/[0.025] px-4 py-3 ring-1 ring-white/[0.06]">
        <summary className="cursor-pointer text-sm text-zinc-400 hover:text-[#eee9df]">
          Connect the Chrome extension to this shared timer
        </summary>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-zinc-500">
            Pair once to show and stop this same timer from Chrome. Forge keeps only one active
            timer for your account, so every signed-in Forge session stays in sync.
          </p>
          <button
            onClick={() => void createPairingCode()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-zinc-300 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <KeyRound className="size-4" /> Generate pairing code
          </button>
        </div>
        {pairingCode && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg bg-black/25 p-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all text-xs text-emerald-100">{pairingCode}</code>
            <button
              onClick={() => void navigator.clipboard.writeText(pairingCode)}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
            >
              <Copy className="size-4" />
              Copy
            </button>
          </div>
        )}
      </details>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/[0.07]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">
                {active
                  ? `Started ${new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Ready when you are'}
              </p>
              <p className="mt-2 tabular-nums text-5xl font-semibold tracking-[-0.05em] text-[#eee9df]">
                {formatDuration(elapsed)}
              </p>
            </div>
            <button
              onClick={() => void (active ? stop() : start())}
              disabled={!projectId}
              className={`inline-flex size-14 items-center justify-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-rose-400/15 text-rose-200 hover:bg-rose-400/25' : 'bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25'}`}
              aria-label={active ? 'Stop timer' : 'Start timer'}
            >
              {active ? <CircleStop className="size-6" /> : <Play className="ml-0.5 size-6" />}
            </button>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-zinc-400">
              Project
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={Boolean(active)}
                className="mt-2 w-full px-3 py-2.5 text-zinc-100"
              >
                <option value="">Choose a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-400">
              What are you working on?
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={Boolean(active)}
                placeholder="Describe the work while it is fresh"
                className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-white/30"
              />
            </label>
          </div>
          {fields.length > 0 && (
            <details className="mt-5 rounded-xl bg-black/15 p-4">
              <summary className="cursor-pointer text-sm font-medium text-zinc-300">
                {currentProject?.name} time-log fields
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <FieldInput
                    key={field.id}
                    field={field}
                    value={values[field.id] ?? ''}
                    disabled={Boolean(active)}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, [field.id]: value }))
                    }
                  />
                ))}
              </div>
            </details>
          )}
        </div>
        <div className="rounded-2xl bg-white/[0.025] p-5 ring-1 ring-white/[0.06]">
          <h2 className="font-medium text-zinc-200">Recent time</h2>
          <div className="mt-4 space-y-1">
            {entries.slice(0, 7).map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.045]"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 text-sm text-zinc-300">
                    {entry.description || 'Untitled time entry'}
                  </p>
                  <span className="shrink-0 font-mono text-xs text-zinc-500">
                    {formatDuration(entry.duration_seconds)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {new Date(entry.started_at).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </button>
            ))}
            {entries.length === 0 && (
              <p className="py-7 text-center text-sm text-zinc-600">
                Stopped timers will appear here.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-10">
        <TimeCalendar
          month={month}
          setMonth={setMonth}
          calendar={calendar}
          secondsByDay={secondsByDay}
          entries={entries}
          onSelect={setSelectedEntry}
        />
      </div>
      {selectedEntry && (
        <TimeEntryDrawer
          entry={selectedEntry}
          projects={projects}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </section>
  )
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: TrackerField
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm text-zinc-400">
      {field.label}
      {field.type === 'select' ? (
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full px-3 py-2.5 text-zinc-100"
        >
          {(field.options ?? []).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-lg bg-black/20 px-3 py-2.5 text-zinc-100 outline-none ring-1 ring-white/[0.08] focus:ring-white/30"
        />
      )}
    </label>
  )
}

function TrackerSettings({
  projectId,
  setProjectId,
  projects,
  fields,
  updateFields,
  saveFields,
  notice,
  error,
  entries,
  month,
  setMonth,
  calendar,
  secondsByDay,
}: {
  projectId: string
  setProjectId: (id: string) => void
  projects: { id: string; name: string }[]
  fields: TrackerField[]
  updateFields: (fields: TrackerField[]) => void
  saveFields: () => Promise<void>
  notice: string | null
  error: string | null
  entries: Entry[]
  month: Date
  setMonth: (value: Date) => void
  calendar: Date[]
  secondsByDay: Record<string, number>
}) {
  const edit = (index: number, change: Partial<TrackerField>) =>
    updateFields(
      fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...change } : field)),
    )
  return (
    <section>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-zinc-500">Project-specific logging template</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Time-tracking settings</h1>
          <p className="mt-2 text-zinc-500">
            Adapt the timer to the fields each project actually needs.
          </p>
        </div>
        <Link
          to="/time-tracker"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-[#eee9df]"
        >
          <TimerReset className="size-4" />
          Back to timer
        </Link>
      </div>
      {(error || notice) && (
        <p
          className={`mt-6 rounded-xl px-4 py-3 text-sm ${error ? 'bg-rose-400/10 text-rose-200' : 'bg-emerald-400/10 text-emerald-100'}`}
        >
          {error || notice}
        </p>
      )}
      <div className="mt-8 rounded-2xl bg-white/[0.035] p-6 ring-1 ring-white/[0.07]">
        <label className="block max-w-sm text-sm text-zinc-400">
          Project
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-2 w-full px-3 py-2.5 text-zinc-100"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.1em] text-zinc-600">
              <tr>
                <th className="pb-3 font-medium">Field</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Default / options</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-t border-white/[0.06]">
                  <td className="py-3 pr-3">
                    <input
                      value={field.label}
                      onChange={(event) => edit(index, { label: event.target.value })}
                      className="w-full rounded-lg bg-black/20 px-3 py-2 text-zinc-200 outline-none ring-1 ring-white/[0.08]"
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={field.type}
                      onChange={(event) => edit(index, { type: event.target.value as FieldKind })}
                      className="w-full px-3 py-2 text-zinc-200"
                    >
                      <option value="text">Text</option>
                      <option value="select">Select</option>
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      value={
                        field.type === 'select'
                          ? (field.options ?? []).join(', ')
                          : (field.defaultValue ?? '')
                      }
                      onChange={(event) =>
                        edit(
                          index,
                          field.type === 'select'
                            ? {
                                options: event.target.value
                                  .split(',')
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }
                            : { defaultValue: event.target.value },
                        )
                      }
                      placeholder={
                        field.type === 'select' ? 'Comma-separated options' : 'Optional default'
                      }
                      className="w-full rounded-lg bg-black/20 px-3 py-2 text-zinc-200 outline-none ring-1 ring-white/[0.08]"
                    />
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() =>
                        updateFields(fields.filter((_, fieldIndex) => fieldIndex !== index))
                      }
                      aria-label={`Remove ${field.label}`}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-rose-400/10 hover:text-rose-200"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <button
            onClick={() =>
              updateFields([
                ...fields,
                { id: crypto.randomUUID(), label: 'New field', type: 'text' },
              ])
            }
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <Plus className="size-4" />
            Add field
          </button>
          <button
            onClick={() => void saveFields()}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
          >
            <Save className="size-4" />
            Save template
          </button>
        </div>
      </div>
      <div className="mt-8">
        <TimeCalendar
          month={month}
          setMonth={setMonth}
          calendar={calendar}
          secondsByDay={secondsByDay}
          entries={entries}
        />
      </div>
    </section>
  )
}

function TimeCalendar({
  month,
  setMonth,
  calendar,
  secondsByDay,
  entries,
  onSelect,
}: {
  month: Date
  setMonth: (value: Date) => void
  calendar: Date[]
  secondsByDay: Record<string, number>
  entries: Entry[]
  onSelect?: (entry: Entry) => void
}) {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-5 ring-1 ring-white/[0.07]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-zinc-200">Tracked time calendar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            See the evidence behind your weekly and monthly reporting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Today
          </button>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label="Previous month"
            className="rounded-lg p-2 text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-28 text-center text-sm text-zinc-300">
            {month.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label="Next month"
            className="rounded-lg p-2 text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-7 text-center text-xs text-zinc-600">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-white/[0.05]">
        {calendar.map((day) => {
          const key = day.toLocaleDateString('en-CA')
          const seconds = secondsByDay[key] ?? 0
          const inMonth = day.getMonth() === month.getMonth()
          const dayEntries = entries.filter((entry) => dateKey(entry.started_at) === key)
          return (
            <div
              key={key}
              className={`min-h-24 bg-[#111114] p-2 ${!inMonth ? 'bg-[#0d0d0f] text-zinc-700' : day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-400/[0.035]' : ''}`}
            >
              <span className="text-xs">{day.getDate()}</span>
              {seconds > 0 && (
                <div className="mt-2 rounded-md bg-emerald-400/10 px-1.5 py-1 text-[11px] font-medium text-emerald-100">
                  <Clock3 className="mr-1 inline size-3" />
                  {formatDuration(seconds)}
                </div>
              )}
              <div className="mt-1 space-y-1">
                {dayEntries.slice(0, 2).map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelect?.(entry)}
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-[10px] text-zinc-400 transition hover:bg-white/[0.08] hover:text-[#eee9df]"
                    title={entry.description || 'Untitled time entry'}
                  >
                    {entry.description || 'Untitled time entry'}
                  </button>
                ))}
                {dayEntries.length > 2 && (
                  <button
                    onClick={() => onSelect?.(dayEntries[0])}
                    className="px-1.5 text-[10px] text-zinc-500 hover:text-[#eee9df]"
                  >
                    +{dayEntries.length - 2} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeEntryDrawer({
  entry,
  projects,
  onClose,
}: {
  entry: Entry
  projects: { id: string; name: string }[]
  onClose: () => void
}) {
  const projectName =
    projects.find((project) => project.id === entry.project_id)?.name ?? 'Unknown project'
  const customFields = Object.entries(entry.custom_fields).filter(
    ([key]) => !['billing_status', 'approval_status'].includes(key),
  )
  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close time entry details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-[#141418] shadow-2xl ring-1 ring-white/[0.1]">
        <div className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
          <div className="min-w-0">
            <p className="text-sm text-zinc-500">{projectName}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-zinc-100">
              Time entry details
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close time entry details"
            className="rounded-lg p-2 text-zinc-500 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="rounded-xl bg-emerald-400/[0.08] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-emerald-200/70">
              Tracked
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.05em] text-emerald-100">
              {formatDuration(entry.duration_seconds)}
            </p>
            <p className="mt-2 text-sm text-emerald-100/80">
              {new Date(entry.started_at).toLocaleString([], {
                dateStyle: 'full',
                timeStyle: 'short',
              })}{' '}
              – {new Date(entry.ended_at).toLocaleTimeString([], { timeStyle: 'short' })}
            </p>
          </div>
          <section className="mt-7">
            <h3 className="text-sm font-medium text-zinc-200">Work note</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
              {entry.description || 'No work note was recorded.'}
            </p>
          </section>
          <dl className="mt-7 grid gap-4 sm:grid-cols-2">
            <Detail label="Billing status" value={entry.billing_status} />
            <Detail label="Approval status" value={entry.approval_status} />
            <Detail label="Source" value={entry.source} />
            <Detail label="Timer interval" value={`${entry.duration_seconds} seconds`} />
          </dl>
          {entry.page_url && (
            <section className="mt-7">
              <h3 className="text-sm font-medium text-zinc-200">Browser context</h3>
              <a
                href={entry.page_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm text-sky-200 underline decoration-sky-200/30 underline-offset-4 hover:text-sky-100"
              >
                {entry.page_title || entry.page_url}
              </a>
            </section>
          )}
          {customFields.length > 0 && (
            <section className="mt-7">
              <h3 className="text-sm font-medium text-zinc-200">Project fields</h3>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                {customFields.map(([label, value]) => (
                  <Detail key={label} label={label.replaceAll('_', ' ')} value={value || '—'} />
                ))}
              </dl>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs capitalize text-zinc-600">{label}</dt>
      <dd className="mt-1 break-words text-sm text-zinc-300">{value}</dd>
    </div>
  )
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function timeEntriesCsv(entries: Entry[], fields: TrackerField[]) {
  const customIds = Array.from(
    new Set([
      ...fields.map((field) => field.id),
      ...entries.flatMap((entry) => Object.keys(entry.custom_fields)),
    ]),
  )
  const headers = [
    'Date',
    'From time',
    'To time',
    'Timer Intervals',
    'Hour(s)',
    'Hours(HH:MM)',
    'Billing Status',
    'Approval Status',
    'Description',
    'Source',
    'Page URL',
    'Page title',
    ...customIds.map((id) => fields.find((field) => field.id === id)?.label ?? id),
  ]
  const row = (values: Array<string | number | null | undefined>) =>
    values.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')
  return [
    row(headers),
    ...entries.map((entry) => {
      const started = new Date(entry.started_at)
      const ended = new Date(entry.ended_at)
      return row([
        started.toLocaleDateString('en-CA'),
        started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ended.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        entry.duration_seconds,
        (entry.duration_seconds / 3600).toFixed(2),
        formatDuration(entry.duration_seconds).slice(0, 5),
        entry.billing_status,
        entry.approval_status,
        entry.description,
        entry.source,
        entry.page_url,
        entry.page_title,
        ...customIds.map((id) => entry.custom_fields[id]),
      ])
    }),
  ].join('\n')
}
