import { CheckCircle2, Clock3, RefreshCw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { usePlaybooks } from './playbooks-store'
export function ReviewPage() {
  const { workItems, projects } = useWorkspace()
  const { specs, specSteps, focusSessions, ideas, compassGoals } = usePlaybooks()
  const [reviewedAt] = useState(() => Date.now())
  const summary = useMemo(() => {
    const active = workItems.filter((item) => item.status !== 'done')
    const stale = active.filter(
      (item) => reviewedAt - new Date(item.updatedAt).getTime() > 7 * 86400000,
    )
    const completedSteps = specSteps.filter((step) => step.status === 'done').length
    const sessions = focusSessions.filter((session) => session.completedAt).length
    return {
      active: active.length,
      stale: stale.length,
      completedSteps,
      sessions,
      activeSpecs: specs.filter((spec) => spec.status === 'active').length,
    }
  }, [focusSessions, reviewedAt, specSteps, specs, workItems])
  const prompts = [
    summary.stale
      ? `${summary.stale} work item${summary.stale === 1 ? ' is' : 's are'} idle. Decide: finish, split, defer, or delete.`
      : 'No work items are rotting—keep your active list small.',
    summary.active > 8
      ? `You have ${summary.active} active work items. Protect attention by pausing lower-value work.`
      : 'Your active workload is within a focused range.',
    compassGoals.filter((goal) => goal.active).length === 0
      ? 'Add one Compass direction so daily execution has a destination.'
      : 'Review whether this week’s work supports your Compass directions.',
  ]
  return (
    <section>
      <p className="text-sm text-zinc-500">Reflect, then re-enter the work</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Weekly review</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        A calm reset inspired by GTD: capture, clarify, organize, reflect, then engage.
      </p>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Active work', value: summary.active, icon: Clock3 },
          { label: 'Idle items', value: summary.stale, icon: RefreshCw },
          { label: 'Active specs', value: summary.activeSpecs, icon: Sparkles },
          { label: 'Steps done', value: summary.completedSteps, icon: CheckCircle2 },
          { label: 'Focus sessions', value: summary.sessions, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-white/[0.035] p-5">
            <Icon className="size-4 text-violet-300" />
            <p className="mt-4 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-9 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white/[0.035] p-6">
          <h2 className="font-medium">Review prompts</h2>
          <div className="mt-4 space-y-3">
            {prompts.map((prompt) => (
              <p
                key={prompt}
                className="rounded-xl bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-400"
              >
                {prompt}
              </p>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white/[0.035] p-6">
          <h2 className="font-medium">Your system, at a glance</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-zinc-500">
              <dt>Projects</dt>
              <dd className="text-zinc-200">{projects.length}</dd>
            </div>
            <div className="flex justify-between text-zinc-500">
              <dt>Captured ideas</dt>
              <dd className="text-zinc-200">{ideas.length}</dd>
            </div>
            <div className="flex justify-between text-zinc-500">
              <dt>Open micro-actions</dt>
              <dd className="text-zinc-200">
                {specSteps.filter((step) => step.status !== 'done').length}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-sm leading-6 text-zinc-500">
            Close the review by choosing one active spec and its next micro-action. Forge should
            simplify your choices, not create more of them.
          </p>
        </section>
      </div>
    </section>
  )
}
