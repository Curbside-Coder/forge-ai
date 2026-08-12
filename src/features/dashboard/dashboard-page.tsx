import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleStop,
  ListChecks,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { useAutopilot } from '@/features/autopilot/autopilot-store'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { RichText } from '@/components/shared/rich-text'
import { supabase } from '@/lib/supabase'
import type { WorkItem } from '@/types/workspace'

type UpcomingEvent = { id: string; title: string; starts_at: string; ends_at: string }

export function DashboardPage() {
  const { user } = useAuth()
  const { workItems, updateWorkItem } = useWorkspace()
  const {
    plans,
    steps,
    focusSessions,
    aiDirection,
    createPlan,
    startFocus,
    completeFocus,
    askAi,
    error,
  } = useAutopilot()
  const [message, setMessage] = useState<string | null>(null)
  const [isAskingAi, setIsAskingAi] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [now] = useState(() => new Date())
  const [clock, setClock] = useState(() => Date.now())
  const [isCompletingFocus, setIsCompletingFocus] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'connected' | 'offline'>(
    'checking',
  )
  const isOpenStep = (workItemId: string | null) => {
    if (!workItemId) return true
    return workItems.find((item) => item.id === workItemId)?.status !== 'done'
  }
  const activeStep = steps.find(
    (step) => step.status === 'in_progress' && isOpenStep(step.workItemId),
  )
  const activeFocus = focusSessions.find((session) => !session.completedAt) ?? null
  useEffect(() => {
    if (!activeFocus) return
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeFocus])
  const nextSpecStep = steps.find((step) => step.status === 'todo' && isOpenStep(step.workItemId))
  const visiblePlanStep = activeStep ?? nextSpecStep
  const activePlan = plans.find(
    (plan) => plan.id === visiblePlanStep?.specId && plan.status === 'active',
  )
  const validAiDirection = useMemo(() => {
    if (!aiDirection) return null
    const item = workItems.find((entry) => entry.id === aiDirection.workItemId)
    return item && item.status !== 'done' ? { ...aiDirection, item } : null
  }, [aiDirection, workItems])
  const direction = useMemo(() => {
    if (activeStep)
      return {
        title: activeStep.title,
        detail: 'You already started this. Finish it before picking up anything else.',
        minutes: activeStep.estimateMinutes,
        step: activeStep,
      }
    if (nextSpecStep)
      return {
        title: nextSpecStep.title,
        detail: 'This is the next smallest action in your current plan.',
        minutes: nextSpecStep.estimateMinutes,
        step: nextSpecStep,
      }
    if (validAiDirection) {
      return {
        title: validAiDirection.item.title,
        detail: validAiDirection.reason,
        minutes: validAiDirection.minutes,
        item: validAiDirection.item,
      }
    }
    const candidate = [...workItems]
      .filter((item) => item.status !== 'done')
      .sort((a, b) => score(b, now.getTime()) - score(a, now.getTime()))[0]
    return candidate
      ? {
          title: candidate.title,
          detail: reason(candidate),
          minutes: suggestedMinutes(candidate),
          item: candidate,
        }
      : null
  }, [activeStep, nextSpecStep, now, validAiDirection, workItems])
  const nextDirections = useMemo(() => {
    const primaryId = direction?.item?.id ?? direction?.step?.workItemId
    return [...workItems]
      .filter((item) => item.status !== 'done' && item.id !== primaryId)
      .sort((a, b) => score(b, now.getTime()) - score(a, now.getTime()))
      .slice(0, 2)
  }, [direction?.item?.id, direction?.step?.workItemId, now, workItems])
  const name =
    (user?.user_metadata.display_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'there'
  const blockTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(now.getTime() + 15 * 60_000))
  useEffect(() => {
    if (!supabase || !user) return
    void supabase
      .from('calendar_events')
      .select('id, title, starts_at, ends_at')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(4)
      .then(({ data }) => setUpcomingEvents((data ?? []) as UpcomingEvent[]))
  }, [user])
  useEffect(() => {
    if (!supabase || !user) {
      const timer = window.setTimeout(() => setServiceStatus('offline'), 0)
      return () => window.clearTimeout(timer)
    }
    void supabase.auth
      .getSession()
      .then(({ error: statusError }) => setServiceStatus(statusError ? 'offline' : 'connected'))
  }, [user])
  const generatePlan = async () => {
    if (!direction?.item) return
    setIsCreatingPlan(true)
    const spec = await createPlan(direction.item, direction.minutes)
    setIsCreatingPlan(false)
    if (!spec) return
    setMessage(`Plan ready: “${spec.title}” now has one next action queued below.`)
  }
  const start = async () => {
    if (activeFocus) {
      setMessage(`A focus block is already running: ${activeFocus.title}.`)
      return
    }
    if (!direction) return
    await startFocus({
      title: direction.title,
      plannedMinutes: direction.minutes,
      specStepId: direction.step?.id ?? null,
      workItemId: direction.item?.id ?? null,
    })
    if (direction.item?.status === 'backlog')
      await updateWorkItem(direction.item.id, { status: 'in_progress' })
    setMessage(
      `Focus block started: ${direction.minutes} minutes. Keep this page open to track it.`,
    )
  }
  const finishFocus = async (finishWorkItem: boolean) => {
    if (!activeFocus) return
    setIsCompletingFocus(true)
    if (finishWorkItem && activeFocus.workItemId)
      await updateWorkItem(activeFocus.workItemId, { status: 'done' })
    await completeFocus(activeFocus.id)
    setIsCompletingFocus(false)
    if (finishWorkItem) {
      const next = [...workItems]
        .filter((item) => item.status !== 'done' && item.id !== activeFocus.workItemId)
        .sort((a, b) => score(b, now.getTime()) - score(a, now.getTime()))[0]
      setMessage(
        next
          ? `Work item completed. Your next direction is “${next.title}.”`
          : 'Work item completed. Your runway is clear.',
      )
    } else setMessage('Focus block ended. The work item remains open for later.')
  }
  const improveWithAi = async () => {
    setIsAskingAi(true)
    const result = await askAi(workItems.filter((item) => item.status !== 'done'))
    if (result) {
      setMessage('Forge AI reviewed your open work and selected one direction.')
    }
    setIsAskingAi(false)
  }
  return (
    <section className="mx-auto max-w-3xl">
      <p className="text-sm text-zinc-500">
        {new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(now)}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Good evening, {name}.</h1>
      <p className="mt-2 text-zinc-500">Forge cleared the noise. Here is your next direction.</p>
      {activeFocus && (
        <section className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-400/[.09] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-violet-200">
                <Timer className="size-3.5" /> Focus in progress
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">{activeFocus.title}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                One thing only. Finish the next concrete piece before switching contexts.
              </p>
            </div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-violet-100">
              {remainingFocusTime(activeFocus.startedAt, activeFocus.plannedMinutes, clock)}
            </p>
          </div>
          <button
            onClick={() => void finishFocus(true)}
            disabled={isCompletingFocus}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/[.1] px-3 py-2 text-sm text-zinc-100 transition hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            <CircleStop className="size-4" />
            {isCompletingFocus ? 'Finishing…' : 'Finish work item & continue'}
          </button>
          <button
            onClick={() => void finishFocus(false)}
            disabled={isCompletingFocus}
            className="mt-4 ml-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-[#29282b] hover:text-[#eee9df]"
          >
            End block, keep open
          </button>
        </section>
      )}
      <article className="mt-10 rounded-3xl bg-gradient-to-br from-violet-400/[0.12] to-white/[0.035] p-7 sm:p-10">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
          <Sparkles className="size-4" /> Forge Autopilot
        </div>
        {direction ? (
          <>
            <h2 className="mt-6 max-w-2xl text-2xl font-semibold tracking-[-0.025em] text-zinc-50">
              {direction.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">{direction.detail}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => void start()}
                className="rounded-xl bg-violet-200 px-4 py-2.5 text-sm font-medium text-violet-950"
              >
                Start {direction.minutes}-minute focus
              </button>
              {direction.item && (
                <button
                  onClick={() => void generatePlan()}
                  disabled={isCreatingPlan}
                  className="rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-[#29282b] hover:text-[#eee9df] disabled:cursor-wait disabled:opacity-60"
                >
                  {isCreatingPlan ? 'Forge is building your plan…' : 'Turn this into a plan'}
                </button>
              )}
              <button
                onClick={() => void improveWithAi()}
                disabled={isAskingAi}
                className="rounded-xl bg-white/[0.05] px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.1] disabled:opacity-50"
              >
                {isAskingAi ? 'Planning…' : 'Ask Forge AI'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-semibold">Your runway is clear.</h2>
            <p className="mt-3 text-sm text-zinc-500">
              Capture an idea, work item, or meeting note when something needs your attention.
            </p>
          </>
        )}
        {direction && nextDirections.length > 0 && (
          <div className="mt-7 border-t border-white/[.08] pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[.14em] text-zinc-500">
              Then, in this order
            </p>
            <div className="mt-3 space-y-2">
              {nextDirections.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() =>
                    window.location.assign(`/work-items?item=${encodeURIComponent(item.id)}`)
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-400 transition hover:bg-[#29282b] hover:text-[#eee9df]"
                >
                  <span className="text-xs text-violet-200">{index + 2}</span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-zinc-600">{suggestedMinutes(item)} min</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
      {activePlan && visiblePlanStep && (
        <section className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-violet-200">
                <ListChecks className="size-3.5" /> Current plan
              </p>
              <h2 className="mt-2 font-medium text-zinc-100">{activePlan.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                Outcome: {activePlan.desiredOutcome}
              </p>
            </div>
            <span className="rounded-md bg-violet-400/10 px-2 py-1 text-xs text-violet-200">
              {visiblePlanStep.estimateMinutes} min
            </span>
          </div>
          <div className="mt-4 rounded-xl bg-black/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {visiblePlanStep.status === 'in_progress' ? 'Doing now' : 'Next move'}
            </p>
            <p className="mt-1 text-sm text-zinc-200">{visiblePlanStep.title}</p>
            {visiblePlanStep.notes && (
              <p className="mt-1 text-xs leading-5 text-zinc-500">{visiblePlanStep.notes}</p>
            )}
          </div>
          {activePlan.briefMarkdown && (
            <details className="mt-4 rounded-xl bg-black/20 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-zinc-200">
                Read Forge’s analysis, approach, and references
              </summary>
              <RichText content={activePlan.briefMarkdown} className="mt-4 text-zinc-300" />
            </details>
          )}
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Checklist</p>
            <ol className="mt-2 space-y-2">
              {steps
                .filter((step) => step.specId === activePlan.id)
                .sort((a, b) => a.position - b.position)
                .map((step, index) => (
                  <li key={step.id} className="flex gap-3 text-sm">
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${step.status === 'done' ? 'bg-emerald-400/15 text-emerald-200' : step.status === 'in_progress' ? 'bg-violet-400/15 text-violet-100' : 'bg-white/[.07] text-zinc-500'}`}
                    >
                      {step.status === 'done' ? '✓' : index + 1}
                    </span>
                    <span
                      className={
                        step.status === 'done' ? 'text-zinc-600 line-through' : 'text-zinc-300'
                      }
                    >
                      {step.title}
                      <span className="ml-2 text-xs text-zinc-600">{step.estimateMinutes} min</span>
                    </span>
                  </li>
                ))}
            </ol>
          </div>
          {visiblePlanStep.workItemId && (
            <button
              onClick={() =>
                window.location.assign(
                  `/work-items?item=${encodeURIComponent(visiblePlanStep.workItemId!)}`,
                )
              }
              className="mt-4 text-sm font-medium text-violet-200 hover:text-violet-100"
            >
              Open linked work item <ArrowRight className="ml-1 inline size-3" />
            </button>
          )}
        </section>
      )}
      {validAiDirection && (
        <aside className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-violet-200">
              <Target className="size-4" /> AI direction saved
            </p>
            <p className="text-xs text-zinc-500">
              Selected{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(validAiDirection.selectedAt))}
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            <span className="font-medium text-zinc-100">Why this now:</span>{' '}
            {validAiDirection.reason}
          </p>
          <button
            onClick={() =>
              window.location.assign(
                `/work-items?item=${encodeURIComponent(validAiDirection.workItemId)}`,
              )
            }
            className="mt-4 text-sm font-medium text-violet-200 hover:text-violet-100"
          >
            Open selected work item <ArrowRight className="ml-1 inline size-3" />
          </button>
        </aside>
      )}
      {message && (
        <p className="mt-4 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-white/[0.035] p-6">
          <CalendarClock className="size-4 text-sky-300" />
          <h2 className="mt-4 font-medium">Suggested time</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Protect the next open {direction?.minutes ?? 30}-minute block, starting around{' '}
            {blockTime}. Calendar-aware scheduling will replace this suggestion once your calendar
            connection is enabled.
          </p>
        </section>
        <section className="rounded-2xl bg-white/[0.035] p-6">
          <CheckCircle2 className="size-4 text-emerald-300" />
          <h2 className="mt-4 font-medium">What Forge is filtering out</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {workItems.filter((item) => item.status !== 'done').length} open work items stay in the
            background. You only need to decide whether to start this one.
          </p>
        </section>
        <section className="rounded-2xl bg-white/[0.035] p-6">
          <span
            className={`block size-2 rounded-full ${serviceStatus === 'connected' ? 'bg-emerald-300' : serviceStatus === 'offline' ? 'bg-rose-300' : 'bg-amber-300'}`}
          />
          <h2 className="mt-4 font-medium">Forge status</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {serviceStatus === 'connected'
              ? 'Workspace, calendar, and AI connection are available.'
              : serviceStatus === 'offline'
                ? 'Forge is using local-only data or needs a connection.'
                : 'Checking your private Forge connection…'}
          </p>
        </section>
      </div>
      <section className="mt-8 rounded-2xl bg-white/[0.035] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Upcoming attention</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Your next scheduled commitments, in one place.
            </p>
          </div>
          <Link to="/calendar" className="text-sm text-sky-300 hover:text-sky-200">
            Calendar <ArrowRight className="ml-1 inline size-3" />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="mt-5 text-sm text-zinc-600">
            Nothing scheduled yet. Ask Forge to add time when you need it.
          </p>
        ) : (
          <div className="mt-5 divide-y divide-white/[0.06]">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <p className="font-medium text-zinc-200">{event.title}</p>
                <p className="shrink-0 text-xs text-sky-200">
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(event.starts_at))}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="mt-10 flex flex-wrap gap-x-5 gap-y-3 text-sm text-zinc-500">
        <Link to="/work-items" className="hover:text-white">
          All work <ArrowRight className="ml-1 inline size-3" />
        </Link>
        <Link to="/inbox" className="hover:text-white">
          Capture something <ArrowRight className="ml-1 inline size-3" />
        </Link>
      </div>
    </section>
  )
}

function score(item: WorkItem, now: number) {
  const priority = { critical: 100, high: 70, medium: 40, low: 10 }[item.priority]
  const progress = item.status === 'in_progress' ? 24 : item.status === 'in_review' ? 15 : 0
  const age = Math.min(20, Math.floor((now - new Date(item.updatedAt).getTime()) / 86_400_000))
  return priority + progress + age
}
function suggestedMinutes(item: WorkItem) {
  return item.priority === 'critical' || item.status === 'in_progress' ? 45 : 25
}
function reason(item: WorkItem) {
  if (item.priority === 'critical')
    return 'This is critical work and has the strongest claim on your attention.'
  if (item.status === 'in_progress')
    return 'You already have momentum here. Finishing beats starting something new.'
  return 'This is the highest-leverage available direction based on priority and time without movement.'
}
function remainingFocusTime(startedAt: string, plannedMinutes: number, now: number) {
  const remaining = Math.max(0, new Date(startedAt).getTime() + plannedMinutes * 60_000 - now)
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
