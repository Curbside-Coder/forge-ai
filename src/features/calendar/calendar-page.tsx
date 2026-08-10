import { useCallback, useEffect, useState } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { supabase } from '@/lib/supabase'

type CalendarEvent = {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  source: string
}

export function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!supabase || !user) return
    const { data, error: loadError } = await supabase
      .from('calendar_events')
      .select('*')
      .order('starts_at')
    if (loadError) setError(loadError.message)
    else setEvents(data as CalendarEvent[])
  }, [user])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !user || !title || !startsAt || !endsAt) return
    const { error: insertError } = await supabase.from('calendar_events').insert({
      owner_id: user.id,
      title,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      source: 'forge',
    })
    if (insertError) setError(insertError.message)
    else {
      setTitle('')
      setStartsAt('')
      setEndsAt('')
      void load()
    }
  }
  const remove = async (id: string) => {
    if (!supabase) return
    const { error: deleteError } = await supabase.from('calendar_events').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setEvents((current) => current.filter((entry) => entry.id !== id))
  }
  return (
    <section className="max-w-4xl">
      <p className="text-sm text-zinc-500">Private schedule and intentional time</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Calendar</h1>
      <form
        onSubmit={create}
        className="mt-8 grid gap-3 rounded-2xl bg-white/[0.035] p-5 md:grid-cols-[1fr_12rem_12rem_auto]"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Event title"
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08]"
        />
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08]"
        />
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          className="rounded-lg bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08]"
        />
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950">
          <CalendarPlus className="size-4" /> Add
        </button>
      </form>
      {error && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{error}</p>
      )}
      <div className="mt-8 overflow-x-auto rounded-2xl bg-white/[0.025]">
        <WeekGrid events={events} onDelete={remove} />
      </div>
      {events.length === 0 && (
        <p className="mt-4 text-sm text-zinc-600">
          Add your first Forge event after running the calendar migration.
        </p>
      )}
    </section>
  )
}

function WeekGrid({
  events,
  onDelete,
}: {
  events: CalendarEvent[]
  onDelete: (id: string) => Promise<void>
}) {
  const start = startOfWeek(new Date())
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const hours = Array.from({ length: 13 }, (_, index) => index + 8)
  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(6rem,1fr))] border-b border-white/[0.07]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="px-3 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-600">
              {day.toLocaleDateString(undefined, { weekday: 'short' })}
            </p>
            <p
              className={`mt-1 text-sm ${isToday(day) ? 'font-semibold text-sky-300' : 'text-zinc-300'}`}
            >
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(6rem,1fr))]">
        <div className="relative h-[624px] border-r border-white/[0.07]">
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute -top-2 right-2 text-[10px] text-zinc-600"
              style={{ top: `${(hour - 8) * 48}px` }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="relative h-[624px] border-r border-white/[0.07] last:border-r-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(255,255,255,0.05) 48px)',
            }}
          >
            {events
              .filter((event) => sameDay(new Date(event.starts_at), day))
              .map((event) => {
                const starts = new Date(event.starts_at)
                const ends = new Date(event.ends_at)
                const top = Math.max(0, (starts.getHours() + starts.getMinutes() / 60 - 8) * 48)
                const height = Math.max(30, ((ends.getTime() - starts.getTime()) / 3_600_000) * 48)
                return (
                  <article
                    key={event.id}
                    className="absolute left-1 right-1 overflow-hidden rounded-lg bg-sky-400/15 px-2 py-1.5 text-xs text-sky-100 ring-1 ring-sky-300/25"
                    style={{ top, height }}
                  >
                    <div className="flex justify-between gap-1">
                      <span className="truncate font-medium">{event.title}</span>
                      <button
                        onClick={() => void onDelete(event.id)}
                        aria-label={`Delete ${event.title}`}
                        className="shrink-0 text-sky-300/70 hover:text-rose-300"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-[10px] text-sky-200/60">
                      {starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </article>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}
function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}
function isToday(date: Date) {
  return sameDay(date, new Date())
}
function formatHour(hour: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2026, 0, 1, hour))
}
