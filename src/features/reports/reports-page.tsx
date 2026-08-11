import { Brain, HeartPulse, Lightbulb, Timer, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAutopilot } from '@/features/autopilot/autopilot-store'
import { useWorkspace } from '@/features/workspace/workspace-store'

const colors = ['#c4b5fd', '#7dd3fc', '#6ee7b7', '#fcd34d', '#fb7185', '#a1a1aa']

export function ReportsPage() {
  const { workItems, projects, meetings } = useWorkspace()
  const { focusSessions } = useAutopilot()
  const [now] = useState(() => Date.now())
  const metrics = useMemo(() => {
    const open = workItems.filter((item) => item.status !== 'done')
    const done = workItems.filter((item) => item.status === 'done')
    const idle = open.filter((item) => now - new Date(item.updatedAt).getTime() > 7 * 86_400_000)
    const critical = open.filter((item) => item.priority === 'critical')
    const focusMinutes = focusSessions.reduce((sum, entry) => sum + entry.plannedMinutes, 0)
    const projectCounts = projects.map((project) => ({
      name: project.name,
      value: workItems.filter((item) => item.projectId === project.id && item.status !== 'done')
        .length,
    }))
    return {
      open,
      done,
      idle,
      critical,
      focusMinutes,
      projectCounts,
      completedRate: workItems.length ? Math.round((done.length / workItems.length) * 100) : 0,
    }
  }, [focusSessions, now, projects, workItems])
  const heatmap = Array.from({ length: 28 }, (_, index) => {
    const day = new Date(now - (27 - index) * 86_400_000)
    const count =
      workItems.filter((entry) => new Date(entry.updatedAt).toDateString() === day.toDateString())
        .length +
      meetings.filter((entry) => new Date(entry.createdAt).toDateString() === day.toDateString())
        .length
    return { day, count }
  })
  const insight =
    metrics.critical.length > 0
      ? `${metrics.critical.length} critical item${metrics.critical.length === 1 ? '' : 's'} is still open. Protect a short finish-first block before expanding scope.`
      : metrics.idle.length > 0
        ? `${metrics.idle.length} item${metrics.idle.length === 1 ? '' : 's'} has been idle for over a week. Decide: revive, delegate, or close.`
        : metrics.open.length
          ? 'Your queue is moving. Keep the active list small enough that the next task is obvious.'
          : 'Your workspace is clear. Capture the next meaningful commitment only when it is real.'
  const donut = statusSegments(workItems.map((item) => item.status))
  return (
    <section>
      <p className="text-sm text-zinc-500">Measured patterns, not a scorecard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
        Personal intelligence report
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-500">
        Forge tracks your execution system—not your worth, IQ, personality, or mental health
        diagnosis.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={TrendingUp}
          label="Completion"
          value={`${metrics.completedRate}%`}
          detail={`${metrics.done.length} completed`}
          tone="text-emerald-300"
        />
        <Metric
          icon={Timer}
          label="Focus invested"
          value={`${metrics.focusMinutes}m`}
          detail={`${focusSessions.length} sessions`}
          tone="text-sky-300"
        />
        <Metric
          icon={Brain}
          label="Open load"
          value={`${metrics.open.length}`}
          detail={`${metrics.critical.length} critical`}
          tone="text-violet-200"
        />
        <Metric
          icon={HeartPulse}
          label="Attention debt"
          value={`${metrics.idle.length}`}
          detail="idle 7+ days"
          tone="text-amber-300"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel title="Execution web" subtitle="A balanced system needs movement, not perfection.">
          <Radar
            values={[
              score(metrics.completedRate),
              score(metrics.focusMinutes / 3),
              score(100 - metrics.idle.length * 12),
              score(100 - metrics.critical.length * 22),
              score(metrics.projectCounts.filter((item) => item.value > 0).length * 25),
            ]}
            labels={['Finish', 'Focus', 'Freshness', 'Risk', 'Balance']}
          />
        </Panel>
        <Panel title="Work flow" subtitle="Where your current work is sitting.">
          <div className="flex items-center justify-center gap-7 py-4">
            <Donut segments={donut} />
            <div className="space-y-2 text-sm">
              {donut.map((segment, index) => (
                <p key={segment.label} className="flex items-center gap-2 text-zinc-400">
                  <i className="size-2 rounded-full" style={{ backgroundColor: colors[index] }} />
                  {segment.label} <span className="text-zinc-600">{segment.value}</span>
                </p>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel
          title="Activity heatmap"
          subtitle="Work items and meeting notes captured during the last four weeks."
        >
          <div className="grid grid-cols-7 gap-2 pt-3">
            {heatmap.map(({ day, count }) => (
              <div
                key={day.toISOString()}
                title={`${day.toDateString()}: ${count} items`}
                className="aspect-square rounded-md"
                style={{
                  backgroundColor:
                    count === 0
                      ? 'rgba(255,255,255,.05)'
                      : `rgba(125, 211, 252, ${Math.min(0.25 + count * 0.22, 0.95)})`,
                }}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Darker squares mean more captured activity—not automatically better work.
          </p>
        </Panel>
        <Panel
          title="Project surface area"
          subtitle="Open work by project. A wide spread can signal context switching."
        >
          <div className="space-y-3 pt-2">
            {metrics.projectCounts.length === 0 ? (
              <p className="py-8 text-sm text-zinc-600">
                Create projects and work items to see your balance.
              </p>
            ) : (
              metrics.projectCounts.map((project, index) => (
                <div key={project.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-zinc-300">{project.name}</span>
                    <span className="text-zinc-600">{project.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, project.value * 20)}%`,
                        backgroundColor: colors[index % colors.length],
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
      <section className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] p-6">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-violet-200" />
          <div>
            <p className="font-medium text-violet-100">Forge’s candid read</p>
            <p className="mt-2 max-w-3xl leading-7 text-zinc-300">{insight}</p>
            <p className="mt-3 text-sm text-zinc-500">
              This is a productivity signal, not a diagnosis. Use the floating Forge chat for an
              unbiased review of the evidence and your next small experiment.
            </p>
          </div>
        </div>
      </section>
      <p className="mt-6 text-xs leading-5 text-zinc-600">
        Wellbeing guardrail: sustained overload, low control, and insufficient recovery can
        undermine both mental health and performance. Forge should flag patterns and invite
        reflection; it should never diagnose or pressure you to work through distress.
      </p>
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  detail: string
  tone: string
}) {
  return (
    <article className="rounded-2xl bg-white/[0.035] p-5">
      <Icon className={`size-4 ${tone}`} />
      <p className="mt-5 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-xs text-zinc-600">{detail}</p>
    </article>
  )
}
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white/[0.035] p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      {children}
    </section>
  )
}
function Radar({ values, labels }: { values: number[]; labels: string[] }) {
  const points = values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length
      const radius = 74 * (value / 100)
      return `${100 + Math.cos(angle) * radius},${100 + Math.sin(angle) * radius}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 200 200" className="mx-auto mt-4 h-56 w-full max-w-sm overflow-visible">
      <polygon
        points="100,26 170,77 143,160 57,160 30,77"
        fill="none"
        stroke="rgba(255,255,255,.13)"
      />
      <polygon points={points} fill="rgba(196,181,253,.28)" stroke="#c4b5fd" strokeWidth="2" />
      {labels.map((label, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / labels.length
        return (
          <text
            key={label}
            x={100 + Math.cos(angle) * 94}
            y={104 + Math.sin(angle) * 94}
            textAnchor="middle"
            className="fill-zinc-500 text-[9px]"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
function Donut({ segments }: { segments: { label: string; value: number }[] }) {
  const total = Math.max(
    segments.reduce((sum, segment) => sum + segment.value, 0),
    1,
  )
  return (
    <svg viewBox="0 0 42 42" className="size-32 -rotate-90">
      {segments.map((segment, index) => {
        const dash = (segment.value / total) * 100
        const offset = segments
          .slice(0, index)
          .reduce((sum, prior) => sum + (prior.value / total) * 100, 0)
        const element = (
          <circle
            key={segment.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={colors[index]}
            strokeWidth="6"
            strokeDasharray={`${dash} ${100 - dash}`}
            strokeDashoffset={-offset}
          />
        )
        return element
      })}
      <text x="21" y="23" textAnchor="middle" className="rotate-90 fill-zinc-100 text-[7px]">
        {total}
      </text>
    </svg>
  )
}
function statusSegments(statuses: string[]) {
  return ['backlog', 'in_progress', 'in_review', 'done'].map((label) => ({
    label: label.replace('_', ' '),
    value: statuses.filter((status) => status === label).length,
  }))
}
function score(value: number) {
  return Math.max(12, Math.min(100, Math.round(value)))
}
