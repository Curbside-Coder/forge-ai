import { CalendarPlus, ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { supabase } from '@/lib/supabase'

type CalendarEvent = {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  icon: string
  color: string
  preparation_note: string
}
type View = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'
const views: Array<[View, string, number]> = [
  ['day', 'Day', 1],
  ['week', 'Week', 7],
  ['month', 'Month', 31],
  ['quarter', 'Quarter', 92],
  ['half', '6 months', 183],
  ['year', 'Year', 365],
]
const icons = ['calendar', 'work', 'travel', 'food', 'family', 'church', 'health', 'birthday']
const tones: Record<string, string> = {
  slate: 'bg-slate-400/15 text-slate-100 ring-slate-300/20',
  sky: 'bg-sky-400/15 text-sky-100 ring-sky-300/20',
  emerald: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/20',
  amber: 'bg-amber-400/15 text-amber-100 ring-amber-300/20',
  rose: 'bg-rose-400/15 text-rose-100 ring-rose-300/20',
  violet: 'bg-violet-400/15 text-violet-100 ring-violet-300/20',
}

export function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [dragged, setDragged] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    icon: 'calendar',
    color: 'slate',
    preparation: '',
  })
  const load = useCallback(async () => {
    if (!supabase || !user) return
    const { data, error: issue } = await supabase
      .from('calendar_events')
      .select('*')
      .order('starts_at')
    if (issue) setError(issue.message)
    else setEvents((data ?? []) as CalendarEvent[])
  }, [user])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const range = views.find(([key]) => key === view) ?? views[1]
  const days = useMemo(
    () => Array.from({ length: range[2] }, (_, i) => addDays(startFor(anchor, view), i)),
    [anchor, range, view],
  )
  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !user || !form.title || !form.startsAt || !form.endsAt) return
    const { error: issue } = await supabase.from('calendar_events').insert({
      owner_id: user.id,
      title: form.title,
      description: form.description,
      starts_at: new Date(form.startsAt).toISOString(),
      ends_at: new Date(form.endsAt).toISOString(),
      icon: form.icon,
      color: form.color,
      preparation_note: form.preparation,
      source: 'forge',
    })
    if (issue) setError(issue.message)
    else {
      setForm({
        title: '',
        description: '',
        startsAt: '',
        endsAt: '',
        icon: 'calendar',
        color: 'slate',
        preparation: '',
      })
      void load()
    }
  }
  const move = async (day: Date) => {
    if (!supabase || !dragged) return
    const event = events.find((x) => x.id === dragged)
    if (!event) return
    const old = new Date(event.starts_at),
      end = new Date(event.ends_at),
      duration = end.getTime() - old.getTime()
    const next = new Date(day)
    next.setHours(old.getHours(), old.getMinutes(), 0, 0)
    const { error: issue } = await supabase
      .from('calendar_events')
      .update({
        starts_at: next.toISOString(),
        ends_at: new Date(next.getTime() + duration).toISOString(),
      })
      .eq('id', dragged)
    if (issue) setError(issue.message)
    else void load()
    setDragged(null)
  }
  const remove = async (id: string) => {
    if (!supabase) return
    await supabase.from('calendar_events').delete().eq('id', id)
    void load()
  }
  return (
    <section>
      <p className="text-sm text-zinc-500">Schedule time with intent</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Calendar</h1>
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAnchor(addDays(anchor, -range[2]))}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/[.06]"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-lg bg-white/[.05] px-3 py-2 text-sm"
        >
          Today
        </button>
        <button
          onClick={() => setAnchor(addDays(anchor, range[2]))}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/[.06]"
        >
          <ChevronRight className="size-4" />
        </button>
        <p className="mx-2 text-sm text-zinc-400">{labelRange(days)}</p>
        <div className="ml-auto flex flex-wrap gap-1">
          {views.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs ${view === key ? 'bg-white/[.12] text-white' : 'text-zinc-500 hover:bg-white/[.05]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <form
        onSubmit={create}
        className="mt-5 grid gap-3 rounded-2xl bg-white/[.035] p-5 lg:grid-cols-4"
      >
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Event title"
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm"
        />
        <input
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm"
        />
        <input
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm"
        />
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950">
          <CalendarPlus className="size-4" />
          Block time
        </button>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Details / location"
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm lg:col-span-2"
        />
        <input
          value={form.preparation}
          onChange={(e) => setForm({ ...form, preparation: e.target.value })}
          placeholder="Preparation note"
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            className="min-w-0 flex-1 rounded-lg bg-black/20 px-2 text-sm"
          >
            {icons.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="min-w-0 flex-1 rounded-lg bg-black/20 px-2 text-sm"
          >
            {Object.keys(tones).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
      <div className="mt-6 overflow-x-auto rounded-2xl bg-white/[.025]">
        <div
          className="grid min-w-[700px] gap-px bg-white/[.06]"
          style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 31)}, minmax(7rem,1fr))` }}
        >
          {days.map((day) => (
            <div
              key={day.toISOString()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void move(day)}
              className={`min-h-44 bg-[#101014] p-2 ${dragged ? 'ring-1 ring-inset ring-sky-300/30' : ''}`}
            >
              <p className="mb-2 text-xs text-zinc-500">
                {day.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              {events
                .filter((e) => sameDay(new Date(e.starts_at), day))
                .map((event) => (
                  <article
                    key={event.id}
                    draggable
                    onDragStart={() => setDragged(event.id)}
                    onDragEnd={() => setDragged(null)}
                    className={`mb-2 cursor-grab rounded-lg p-2 text-xs ring-1 ${tones[event.color] ?? tones.slate}`}
                  >
                    <div className="flex gap-1">
                      <GripVertical className="size-3 shrink-0 opacity-60" />
                      <span className="font-medium">
                        {event.icon} · {event.title}
                      </span>
                      <button
                        onClick={() => void remove(event.id)}
                        className="ml-auto opacity-60 hover:text-rose-200"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    <p className="mt-1 opacity-70">
                      {new Date(event.starts_at).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      · {event.description}
                    </p>
                    {event.preparation_note && (
                      <p className="mt-1 opacity-60">Prep: {event.preparation_note}</p>
                    )}
                  </article>
                ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Drag an event onto another date to reschedule it. Forge attention prompts will use upcoming
        events and preparation notes.
      </p>
    </section>
  )
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function startFor(d: Date, v: View) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  if (v === 'week') {
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  }
  if (v === 'month' || v === 'quarter' || v === 'half' || v === 'year') x.setDate(1)
  if (v === 'quarter') x.setMonth(Math.floor(x.getMonth() / 3) * 3)
  if (v === 'half') x.setMonth(x.getMonth() < 6 ? 0 : 6)
  if (v === 'year') x.setMonth(0)
  return x
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}
function labelRange(days: Date[]) {
  return days.length
    ? `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${days.at(-1)!.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''
}
