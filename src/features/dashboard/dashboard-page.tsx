import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarClock, CheckCircle2, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { usePlaybooks } from '@/features/playbooks/playbooks-store'
import { useWorkspace } from '@/features/workspace/workspace-store'
import type { WorkItem } from '@/types/workspace'

export function DashboardPage() {
  const { user } = useAuth()
  const { workItems } = useWorkspace()
  const { specSteps, addSpec, addSpecStep, startFocus } = usePlaybooks()
  const [message, setMessage] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const activeStep = specSteps.find((step) => step.status === 'in_progress')
  const nextSpecStep = specSteps.find((step) => step.status === 'todo')
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
  }, [activeStep, nextSpecStep, now, workItems])
  const name =
    (user?.user_metadata.display_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'there'
  const blockTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(now.getTime() + 15 * 60_000))
  const createPlan = async () => {
    if (!direction?.item) return
    const item = direction.item
    const spec = await addSpec({
      title: item.title,
      projectId: item.projectId,
      priority: item.priority,
      status: 'active',
      problemStatement: item.description || `Move ${item.title} forward.`,
      desiredOutcome: `A clear, completed next result for ${item.title}.`,
      inScope: item.description,
      activePosition: 1,
    })
    if (!spec) return
    await addSpecStep({
      specId: spec.id,
      title: item.title,
      notes: item.description,
      estimateMinutes: direction.minutes,
    })
    setMessage('Autopilot created one focused plan. Nothing extra was added.')
  }
  const start = async () => {
    if (!direction) return
    await startFocus({
      title: direction.title,
      plannedMinutes: direction.minutes,
      specStepId: direction.step?.id ?? null,
      workItemId: direction.item?.id ?? null,
    })
    setMessage(`Focus block started for ${direction.minutes} minutes.`)
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
                  onClick={() => void createPlan()}
                  className="rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.13]"
                >
                  Turn this into a plan
                </button>
              )}
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
      </article>
      {message && (
        <p className="mt-4 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
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
      </div>
      <div className="mt-10 flex flex-wrap gap-x-5 gap-y-3 text-sm text-zinc-500">
        <Link to="/work-items" className="hover:text-white">
          All work <ArrowRight className="ml-1 inline size-3" />
        </Link>
        <Link to="/specs" className="hover:text-white">
          Plans <ArrowRight className="ml-1 inline size-3" />
        </Link>
        <Link to="/ideas" className="hover:text-white">
          Capture an idea <ArrowRight className="ml-1 inline size-3" />
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
