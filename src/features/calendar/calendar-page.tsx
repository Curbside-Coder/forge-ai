import {
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Church,
  GripVertical,
  HeartHandshake,
  HeartPulse,
  Plane,
  Trash2,
  Utensils,
} from 'lucide-react'
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
  recurrence: Recurrence
}
type View = 'day' | 'week' | 'month' | 'rolling' | 'quarter' | 'year'
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
const views: Array<[View, string]> = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['rolling', '3 months'],
  ['quarter', 'Quarter'],
  ['year', 'Year'],
]
const tones: Record<string, string> = {
  slate: 'bg-slate-400/15 text-slate-100 ring-slate-300/20',
  sky: 'bg-sky-400/15 text-sky-100 ring-sky-300/20',
  emerald: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/20',
  amber: 'bg-amber-400/15 text-amber-100 ring-amber-300/20',
  rust: 'bg-orange-400/15 text-orange-100 ring-orange-300/20',
  indigo: 'bg-indigo-400/15 text-indigo-100 ring-indigo-300/20',
  // Keep existing events readable after the palette change.
  rose: 'bg-orange-400/15 text-orange-100 ring-orange-300/20',
  violet: 'bg-indigo-400/15 text-indigo-100 ring-indigo-300/20',
}
const icons = ['calendar', 'work', 'travel', 'food', 'family', 'church', 'health', 'birthday']
const recurrenceOptions: Array<[Recurrence, string]> = [
  ['none', 'Does not repeat'],
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
]

export function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [now] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [hoverDay, setHoverDay] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [view, setView] = useState<View>(
    () => (localStorage.getItem('forge.calendar.view') as View) || 'month',
  )
  const [anchor, setAnchor] = useState(
    () => new Date(localStorage.getItem('forge.calendar.anchor') || Date.now()),
  )
  const [form, setForm] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    icon: 'calendar',
    color: 'slate',
    preparation: '',
    recurrence: 'none' as Recurrence,
  })
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null
  useEffect(() => {
    localStorage.setItem('forge.calendar.view', view)
    localStorage.setItem('forge.calendar.anchor', anchor.toISOString())
  }, [anchor, view])
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
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])
  const months = useMemo(() => monthsFor(anchor, view), [anchor, view])
  const period = periodLabel(months, anchor, view)
  const navigate = (direction: number) => setAnchor(stepAnchor(anchor, view, direction))
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
      recurrence: form.recurrence,
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
        recurrence: 'none',
      })
      void load()
    }
  }
  const move = async (date: Date) => {
    if (!supabase || !dragged) return
    const event = events.find((x) => x.id === dragged)
    if (!event) return
    const start = new Date(event.starts_at),
      end = new Date(event.ends_at),
      next = new Date(date)
    next.setHours(start.getHours(), start.getMinutes(), 0, 0)
    const { error: issue } = await supabase
      .from('calendar_events')
      .update({
        starts_at: next.toISOString(),
        ends_at: new Date(next.getTime() + end.getTime() - start.getTime()).toISOString(),
      })
      .eq('id', dragged)
    if (issue) setError(issue.message)
    else void load()
    setDragged(null)
    setHoverDay(null)
  }
  const remove = async (id: string) => {
    if (!supabase) return
    await supabase.from('calendar_events').delete().eq('id', id)
    void load()
  }
  const openNewEvent = (date: Date) => {
    const start = new Date(date)
    start.setHours(start.getHours() || 9, 0, 0, 0)
    const end = new Date(start.getTime() + 30 * 60_000)
    setForm((current) => ({
      ...current,
      startsAt: toDateTimeLocal(start),
      endsAt: toDateTimeLocal(end),
    }))
    document.getElementById('calendar-event-title')?.focus()
  }
  const attention = events
    .filter((e) => {
      const start = new Date(e.starts_at).getTime()
      return start > now && start - now < 48 * 3600_000 && e.preparation_note
    })
    .slice(0, 2)
  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col">
      <p className="text-sm text-zinc-500">Private schedule and intentional time</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-.03em]">Calendar</h1>
        <div className="flex rounded-lg border border-white/[.08] bg-white/[.03] p-1">
          {views.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-md px-2.5 py-1.5 text-xs ${view === key ? 'bg-white/[.12] text-white' : 'text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          title="Previous period"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-white/[.08] p-2 text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-lg border border-white/[.08] px-3 py-2 text-sm text-zinc-300 hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          Today
        </button>
        <input
          type="date"
          aria-label="Jump to date"
          value={toDateInput(anchor)}
          onChange={(event) =>
            event.target.value && setAnchor(new Date(`${event.target.value}T12:00:00`))
          }
          className="forge-date-input px-3 py-2 text-sm"
        />
        <button
          title="Next period"
          onClick={() => navigate(1)}
          className="rounded-lg border border-white/[.08] p-2 text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          <ChevronRight className="size-4" />
        </button>
        <p className="ml-2 text-sm font-medium text-zinc-300">{period}</p>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-white/[.08]">
          <button
            onClick={() => setAnchor(addMonths(anchor, -1))}
            className="px-2 py-1 text-xs text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            ‹ Month
          </button>
          <button
            onClick={() => setAnchor(addMonths(anchor, 1))}
            className="border-l border-white/[.08] px-2 py-1 text-xs text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Month ›
          </button>
          <button
            onClick={() => setAnchor(addMonths(anchor, -3))}
            className="border-l border-white/[.08] px-2 py-1 text-xs text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            ‹ Quarter
          </button>
          <button
            onClick={() => setAnchor(addMonths(anchor, 3))}
            className="border-l border-white/[.08] px-2 py-1 text-xs text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Quarter ›
          </button>
        </div>
      </div>
      <form
        onSubmit={create}
        className="mt-5 grid gap-2 rounded-xl border border-white/[.07] bg-white/[.025] p-4 md:grid-cols-4"
      >
        <input
          id="calendar-event-title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Event title"
          className="rounded-lg bg-black/20 px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          className="forge-date-input px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
          className="forge-date-input px-3 py-2 text-sm"
        />
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950">
          <CalendarPlus className="size-4" />
          Block time
        </button>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Details / location"
          className="rounded-lg bg-black/20 px-3 py-2 text-sm md:col-span-2"
        />
        <input
          value={form.preparation}
          onChange={(e) => setForm({ ...form, preparation: e.target.value })}
          placeholder="Preparation note"
          className="rounded-lg bg-black/20 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            className="forge-select min-w-0 flex-1 px-2 text-sm"
          >
            {icons.map((icon) => (
              <option key={icon}>{icon}</option>
            ))}
          </select>
          <select
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="forge-select min-w-0 flex-1 px-2 text-sm"
          >
            {['slate', 'sky', 'emerald', 'amber', 'rust', 'indigo'].map((color) => (
              <option key={color}>{color}</option>
            ))}
          </select>
        </div>
        <select
          aria-label="Repeat event"
          value={form.recurrence}
          onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })}
          className="forge-select px-3 text-sm"
        >
          {recurrenceOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>
      {attention.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/[.06] px-4 py-3 text-sm text-amber-100">
          {attention.map((event) => (
            <p key={event.id}>
              Prepare for <span className="font-medium">{event.title}</span>:{' '}
              {event.preparation_note}
            </p>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
      <div className="mt-5 min-h-0 flex-1 overflow-auto rounded-xl border border-white/[.08] bg-[#101014] p-3">
        {view === 'day' || view === 'week' ? (
          <TimeCalendar
            anchor={anchor}
            view={view}
            events={events}
            dragged={dragged}
            hoverDay={hoverDay}
            onDrag={setDragged}
            onHover={setHoverDay}
            onDrop={move}
            onDelete={remove}
            onSelect={setSelectedEventId}
            onEmptyCell={openNewEvent}
          />
        ) : (
          <div
            className={`grid gap-4 ${view === 'month' ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}
          >
            {months.map((month) => (
              <MonthCalendar
                key={month.toISOString()}
                month={month}
                events={events}
                dragged={dragged}
                hoverDay={hoverDay}
                onDrag={setDragged}
                onHover={setHoverDay}
                onDrop={move}
                onDelete={remove}
                compact={months.length > 1}
                onSelect={setSelectedEventId}
                onEmptyCell={openNewEvent}
              />
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Click empty time while creating above. Drag an event to preview its drop day, then release
        to reschedule. Events show preparation notes before they are due.
      </p>
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          userId={user?.id ?? ''}
          onClose={() => setSelectedEventId(null)}
          onDelete={async () => {
            await remove(selectedEvent.id)
            setSelectedEventId(null)
          }}
          onSaved={async () => {
            await load()
            setSelectedEventId(null)
          }}
        />
      )}
    </section>
  )
}
function MonthCalendar({
  month,
  events,
  dragged,
  hoverDay,
  onDrag,
  onHover,
  onDrop,
  onDelete,
  compact,
  onSelect,
  onEmptyCell,
}: {
  month: Date
  events: CalendarEvent[]
  dragged: string | null
  hoverDay: string | null
  onDrag: (id: string | null) => void
  onHover: (day: string | null) => void
  onDrop: (date: Date) => Promise<void>
  onDelete: (id: string) => Promise<void>
  compact: boolean
  onSelect: (id: string) => void
  onEmptyCell: (date: Date) => void
}) {
  const first = startOfMonth(month),
    start = startOfWeek(first),
    days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  return (
    <section className="overflow-hidden rounded-xl border border-white/[.07] bg-[#141419]">
      <header className="border-b border-white/[.07] px-4 py-3">
        <h2 className="font-medium">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
      </header>
      <div className="grid grid-cols-7 border-b border-white/[.07]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <p
            key={day}
            className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-zinc-600"
          >
            {day}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day),
            inMonth = day.getMonth() === month.getMonth(),
            dayEvents = events.filter((event) => occursOn(event, day))
          return (
            <div
              key={key}
              onDragOver={(event) => {
                event.preventDefault()
                onHover(key)
              }}
              onDragLeave={() => onHover(null)}
              onDrop={() => void onDrop(day)}
              onClick={() => inMonth && dayEvents.length === 0 && onEmptyCell(day)}
              className={`min-h-28 border-b border-r border-white/[.05] p-1.5 ${!inMonth ? 'bg-black/25' : ''} ${hoverDay === key ? 'bg-sky-400/[.09] ring-1 ring-inset ring-sky-300/60' : dragged ? 'bg-white/[.018] ring-1 ring-inset ring-sky-300/15' : ''}`}
            >
              {inMonth && (
                <>
                  <p
                    className={`mb-1 grid size-6 place-items-center rounded-full text-xs ${sameDay(day, new Date()) ? 'bg-sky-300 text-slate-950' : 'text-zinc-400'}`}
                  >
                    {day.getDate()}
                  </p>
                  {dayEvents.map((event) => (
                    <EventBar
                      key={event.id}
                      event={event}
                      onDrag={onDrag}
                      onDelete={onDelete}
                      compact={compact}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
function TimeCalendar({
  anchor,
  view,
  events,
  dragged,
  hoverDay,
  onDrag,
  onHover,
  onDrop,
  onDelete,
  onSelect,
  onEmptyCell,
}: {
  anchor: Date
  view: View
  events: CalendarEvent[]
  dragged: string | null
  hoverDay: string | null
  onDrag: (id: string | null) => void
  onHover: (key: string | null) => void
  onDrop: (date: Date) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSelect: (id: string) => void
  onEmptyCell: (date: Date) => void
}) {
  const start = view === 'week' ? startOfWeek(anchor) : startOfDay(anchor),
    days = Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => addDays(start, i)),
    now = new Date(),
    showingToday = view === 'day' && sameDay(anchor, now)
  return (
    <div className="relative min-w-[700px]">
      <div
        className="grid border-b border-white/[.07]"
        style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(8rem,1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div key={dateKey(day)} className="px-3 py-3 text-center">
            <p className="text-xs text-zinc-500">
              {day.toLocaleDateString(undefined, { weekday: 'short' })}
            </p>
            <p className="mt-1 text-sm">{day.getDate()}</p>
          </div>
        ))}
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(8rem,1fr))` }}
      >
        {Array.from({ length: 24 }, (_, hour) => {
          const pastHour = showingToday && hour < now.getHours()
          return (
            <div key={`row-${hour}`} className="contents">
              <p
                className={`border-r border-t border-white/[.05] pr-2 pt-1 text-right text-[10px] text-zinc-600 ${pastHour ? 'bg-black/20 text-zinc-700' : ''}`}
              >
                {`${String(hour).padStart(2, '0')}:00`}
              </p>
              {days.map((day) => {
                const key = `${dateKey(day)}-${hour}`,
                  block = events.filter(
                    (event) =>
                      occursOn(event, day) && new Date(event.starts_at).getHours() === hour,
                  )
                return (
                  <div
                    key={key}
                    onDragOver={(event) => {
                      event.preventDefault()
                      onHover(key)
                    }}
                    onDragLeave={() => onHover(null)}
                    onDrop={() => void onDrop(day)}
                    onClick={() => block.length === 0 && onEmptyCell(withHour(day, hour))}
                    className={`min-h-16 border-r border-t border-white/[.05] p-1 ${isWeekend(day) ? 'bg-sky-400/[.025]' : ''} ${pastHour ? 'bg-black/20' : ''} ${hoverDay === key ? 'bg-sky-400/[.09] ring-1 ring-inset ring-sky-300/60' : dragged ? 'bg-white/[.018] ring-1 ring-inset ring-sky-300/15' : ''}`}
                  >
                    {block.map((event) => (
                      <EventBar
                        key={event.id}
                        event={event}
                        onDrag={onDrag}
                        onDelete={onDelete}
                        onSelect={onSelect}
                        muted={showingToday && hasEnded(event, day, now)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {showingToday && <NowLine now={now} />}
    </div>
  )
}
function EventBar({
  event,
  onDrag,
  onDelete,
  compact = false,
  onSelect,
  muted = false,
}: {
  event: CalendarEvent
  onDrag: (id: string | null) => void
  onDelete: (id: string) => Promise<void>
  compact?: boolean
  onSelect: (id: string) => void
  muted?: boolean
}) {
  return (
    <article
      draggable
      onDragStart={() => onDrag(event.id)}
      onDragEnd={() => onDrag(null)}
      onClick={(click) => {
        click.stopPropagation()
        onSelect(event.id)
      }}
      title={`${event.title}${event.description ? ` — ${event.description}` : ''}\nDrag to move. Click delete to remove.`}
      className={`group mb-1 cursor-grab overflow-hidden rounded-md px-1.5 py-1 text-[10px] ring-1 transition-opacity ${tones[event.color] ?? tones.slate} ${muted ? 'opacity-40 grayscale-[.3]' : ''}`}
    >
      <div className="flex min-w-0 items-start gap-1">
        <GripVertical className="mt-px size-3 shrink-0 opacity-50" />
        <EventIcon icon={event.icon} />
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate font-medium">{event.title}</span>
          {!compact && (
            <span className="block opacity-65">
              {new Date(event.starts_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
        </span>
        <button
          onClick={(click) => {
            click.stopPropagation()
            void onDelete(event.id)
          }}
          aria-label={`Delete ${event.title}`}
          className="shrink-0 opacity-0 transition group-hover:opacity-70 hover:text-rose-200"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </article>
  )
}
function EventIcon({ icon }: { icon: string }) {
  const classes = 'mt-px size-3 shrink-0 opacity-80'
  switch (icon) {
    case 'work':
      return <BriefcaseBusiness className={classes} />
    case 'travel':
      return <Plane className={classes} />
    case 'food':
      return <Utensils className={classes} />
    case 'family':
      return <HeartHandshake className={classes} />
    case 'church':
      return <Church className={classes} />
    case 'health':
      return <HeartPulse className={classes} />
    case 'birthday':
      return <Cake className={classes} />
    default:
      return <CalendarDays className={classes} />
  }
}
function NowLine({ now }: { now: Date }) {
  const top = 3.75 + now.getHours() * 4 + (now.getMinutes() / 60) * 4
  return (
    <div
      className="pointer-events-none absolute left-10 right-0 z-10 flex items-center"
      style={{ top: `${top}rem` }}
    >
      <span className="-translate-x-1/2 rounded bg-[#101014] px-1 text-[9px] font-medium text-rose-200 ring-1 ring-rose-300/50">
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </span>
      <span className="h-px flex-1 bg-rose-300/80" />
    </div>
  )
}
function EventDrawer({
  event,
  userId,
  onClose,
  onDelete,
  onSaved,
}: {
  event: CalendarEvent
  userId: string
  onClose: () => void
  onDelete: () => Promise<void>
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(new Date(event.starts_at)))
  const [endsAt, setEndsAt] = useState(toDateTimeLocal(new Date(event.ends_at)))
  const [recurrence, setRecurrence] = useState<Recurrence>(event.recurrence ?? 'none')
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Array<{ id: string; body: string; created_at: string }>>(
    [],
  )
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('calendar_event_comments')
      .select('id,body,created_at')
      .eq('event_id', event.id)
      .order('created_at')
      .then(({ data }) => setComments(data ?? []))
  }, [event.id])
  const save = async () => {
    if (!supabase || !title.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: title.trim(),
        description,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        recurrence,
      })
      .eq('id', event.id)
    setSaving(false)
    if (!error) await onSaved()
  }
  const addComment = async () => {
    if (!supabase || !userId || !comment.trim()) return
    const { data } = await supabase
      .from('calendar_event_comments')
      .insert({ event_id: event.id, owner_id: userId, body: comment.trim() })
      .select('id,body,created_at')
      .single()
    if (data) {
      setComments((current) => [...current, data])
      setComment('')
    }
  }
  return (
    <>
      <button
        aria-label="Close event details"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-black/45"
      />
      <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl overflow-y-auto bg-[#121216] p-5 shadow-2xl ring-1 ring-white/[0.08] sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">Calendar event</p>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            Close
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-6 w-full bg-transparent text-2xl font-semibold outline-none"
        />
        <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          When
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="forge-date-input px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="forge-date-input px-3 py-2 text-sm"
          />
        </div>
        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Repeat
        </label>
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence)}
          className="forge-select mt-2 w-full px-3 py-2 text-sm"
        >
          {recurrenceOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Details
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl bg-black/20 p-3 text-sm text-zinc-200 outline-none ring-1 ring-white/[.08]"
        />
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => void onDelete()}
            className="rounded-lg px-4 py-2 text-sm text-rose-300 hover:bg-rose-400/10"
          >
            Delete
          </button>
        </div>
        <section className="mt-8 border-t border-white/[.07] pt-6">
          <h2 className="font-medium">Comments</h2>
          <div className="mt-3 space-y-2">
            {comments.map((entry) => (
              <p key={entry.id} className="rounded-lg bg-white/[.04] p-3 text-sm text-zinc-300">
                {entry.body}
                <span className="mt-1 block text-[10px] text-zinc-600">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </p>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void addComment())}
              placeholder="Add a comment"
              className="min-w-0 flex-1 rounded-lg bg-black/20 px-3 py-2 text-sm outline-none ring-1 ring-white/[.08]"
            />
            <button
              onClick={() => void addComment()}
              className="rounded-lg bg-white/[.08] px-3 text-sm text-zinc-200 hover:bg-[#29282b]"
            >
              Add
            </button>
          </div>
        </section>
      </aside>
    </>
  )
}
function monthsFor(anchor: Date, view: View) {
  const current = startOfMonth(anchor)
  if (view === 'month') return [current]
  if (view === 'rolling') return [addMonths(current, -1), current, addMonths(current, 1)]
  if (view === 'quarter') {
    const start = new Date(current.getFullYear(), Math.floor(current.getMonth() / 3) * 3, 1)
    return [0, 1, 2].map((x) => addMonths(start, x))
  }
  if (view === 'year')
    return Array.from({ length: 12 }, (_, x) => new Date(current.getFullYear(), x, 1))
  return [current]
}
function stepAnchor(d: Date, v: View, n: number) {
  if (v === 'day') return addDays(d, n)
  if (v === 'week') return addDays(d, 7 * n)
  if (v === 'quarter') return addMonths(d, 3 * n)
  if (v === 'year') return addMonths(d, 12 * n)
  return addMonths(d, n)
}
function periodLabel(months: Date[], anchor: Date, view: View) {
  if (view === 'day')
    return anchor.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  if (view === 'week') {
    const start = startOfWeek(anchor),
      end = addDays(start, 6)
    return `Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return months.length === 1
    ? months[0].toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${months[0].toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – ${months.at(-1)!.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function startOfWeek(d: Date) {
  const x = startOfDay(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function toDateTimeLocal(date: Date) {
  return `${toDateInput(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function withHour(day: Date, hour: number) {
  const value = new Date(day)
  value.setHours(hour, 0, 0, 0)
  return value
}
function isWeekend(day: Date) {
  return day.getDay() === 0 || day.getDay() === 6
}

function occursOn(event: CalendarEvent, day: Date) {
  const start = startOfDay(new Date(event.starts_at))
  const target = startOfDay(day)
  if (target.getTime() < start.getTime()) return false
  const daysSinceStart = Math.round((target.getTime() - start.getTime()) / 86_400_000)
  switch (event.recurrence ?? 'none') {
    case 'daily':
      return true
    case 'weekly':
      return daysSinceStart % 7 === 0
    case 'monthly':
      return target.getDate() === start.getDate()
    case 'yearly':
      return target.getMonth() === start.getMonth() && target.getDate() === start.getDate()
    default:
      return daysSinceStart === 0
  }
}

function hasEnded(event: CalendarEvent, day: Date, now: Date) {
  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)
  const occurrenceEnd = new Date(day)
  occurrenceEnd.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds())
  if (end.getDate() !== start.getDate()) occurrenceEnd.setDate(occurrenceEnd.getDate() + 1)
  return occurrenceEnd.getTime() < now.getTime()
}
