import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, CircleAlert, ListTodo } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { usePlaybooks } from '@/features/playbooks/playbooks-store'

export function DashboardPage() {
  const { user } = useAuth()
  const { projects, workItems, meetings, source } = useWorkspace()
  const { specs, specSteps } = usePlaybooks()
  const critical = workItems.filter(
    (item) => item.priority === 'critical' && item.status !== 'done',
  )
  const inProgress = workItems.filter((item) => item.status === 'in_progress')
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const name = user?.email?.split('@')[0] || 'there'
  const stats = [
    {
      label: 'Critical',
      value: critical.length,
      icon: CircleAlert,
      to: '/work-items' as const,
      color: 'text-rose-300',
    },
    {
      label: 'In progress',
      value: inProgress.length,
      icon: ListTodo,
      to: '/work-items' as const,
      color: 'text-sky-300',
    },
    {
      label: 'Meetings',
      value: meetings.length,
      icon: CalendarDays,
      to: '/meetings' as const,
      color: 'text-violet-300',
    },
    {
      label: 'Active specs',
      value: specs.filter((spec) => spec.status === 'active').length,
      icon: ListTodo,
      to: '/specs' as const,
      color: 'text-emerald-300',
    },
  ]
  const attention = workItems
    .filter((item) => item.status !== 'done')
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 5)

  return (
    <section>
      <p className="text-sm text-zinc-500">{today}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Good evening, {name}.</h1>
      <p className="mt-2 max-w-xl text-zinc-500">
        A focused view of what needs your attention today.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-4 sm:gap-0">
        {stats.map(({ label, value, icon: Icon, to, color }) => (
          <Link
            key={label}
            to={to}
            className="border-white/[0.08] transition hover:bg-white/[0.025] sm:border-r sm:px-8 sm:first:pl-0 sm:last:border-r-0"
          >
            <Icon className={`size-4 ${color}`} />
            <p className="mt-5 text-3xl font-semibold tracking-[-0.03em]">{value}</p>
            <p className="mt-1 text-sm text-zinc-500">{label}</p>
          </Link>
        ))}
      </div>
      <section className="mt-10 rounded-2xl bg-violet-400/[0.06] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-violet-100">Your 80/20 focus</p>
            <p className="mt-1 text-sm text-zinc-400">
              {specSteps.find((step) => step.status !== 'done')?.title ??
                'Choose an active spec and add its first micro-action.'}
            </p>
          </div>
          <Link
            to="/focus"
            className="rounded-lg bg-violet-200 px-3 py-2 text-sm font-medium text-violet-950"
          >
            Focus now
          </Link>
        </div>
      </section>
      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Needs attention</h2>
            <Link to="/work-items" className="text-sm text-zinc-500 transition hover:text-white">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {attention.length === 0 ? (
              <p className="rounded-xl bg-white/[0.025] px-5 py-6 text-sm text-zinc-600">
                Nothing urgent. Capture work when it comes up.
              </p>
            ) : (
              attention.map((item) => (
                <Link
                  key={item.id}
                  to="/work-items"
                  className="flex items-center justify-between rounded-lg px-4 py-3 text-left text-sm transition hover:bg-white/[0.04]"
                >
                  <span>
                    <span className="block text-zinc-200">{item.title}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                      <span className={`rounded-md px-1.5 py-0.5 ${priorityBadge(item.priority)}`}>
                        {item.priority}
                      </span>
                      <span>{item.status.replace('_', ' ')}</span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-zinc-500" />
                </Link>
              ))
            )}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Projects</h2>
            <Link to="/projects" className="text-sm text-zinc-500 transition hover:text-white">
              View all
            </Link>
          </div>
          <div className="mt-4 rounded-2xl bg-white/[0.035] p-7">
            {source === 'loading' ? (
              <p className="text-sm text-zinc-500">Loading your workspace…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm leading-6 text-zinc-500">
                Create a project to start organizing work.
              </p>
            ) : (
              <div className="space-y-4">
                {projects.slice(0, 4).map((project) => {
                  const activeCount = workItems.filter(
                    (item) => item.projectId === project.id && item.status !== 'done',
                  ).length
                  return (
                    <Link key={project.id} to="/projects" className="block group">
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-white">
                        {project.name}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">{activeCount} active work items</p>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

function priorityRank(priority: 'critical' | 'high' | 'medium' | 'low') {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority]
}

function priorityBadge(priority: 'critical' | 'high' | 'medium' | 'low') {
  return {
    critical: 'bg-rose-400/10 text-rose-300',
    high: 'bg-amber-400/10 text-amber-300',
    medium: 'bg-sky-400/10 text-sky-300',
    low: 'bg-zinc-400/10 text-zinc-400',
  }[priority]
}
