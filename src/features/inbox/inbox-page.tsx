import { Link } from '@tanstack/react-router'
import { CheckCircle2, CircleAlert, Inbox } from 'lucide-react'
import { useWorkspace } from '@/features/workspace/workspace-store'

export function InboxPage() {
  const { workItems, projects } = useWorkspace()
  const attention = workItems
    .filter((item) => item.status !== 'done')
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))

  return (
    <section>
      <p className="text-sm text-zinc-500">A focused queue, not another feed</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Inbox</h1>
      <p className="mt-2 max-w-xl text-zinc-500">
        Critical and active work that needs an intentional next step.
      </p>
      <div className="mt-10 max-w-3xl overflow-hidden rounded-2xl bg-white/[0.025]">
        {attention.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Inbox className="mx-auto size-5 text-zinc-600" />
            <p className="mt-4 text-sm text-zinc-500">Your inbox is clear.</p>
          </div>
        ) : (
          attention.map((item) => (
            <Link
              key={item.id}
              to="/work-items"
              className="flex items-start gap-4 border-b border-white/[0.05] px-6 py-5 last:border-b-0 hover:bg-white/[0.035]"
            >
              {item.priority === 'critical' ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-rose-300" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-zinc-600" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-200">{item.title}</span>
                <span className="mt-1 block text-xs text-zinc-600">
                  {projects.find((project) => project.id === item.projectId)?.name ?? 'No project'}{' '}
                  · {item.status.replace('_', ' ')}
                </span>
              </span>
              <span className="text-xs capitalize text-zinc-500">{item.priority}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

function priorityRank(priority: 'critical' | 'high' | 'medium' | 'low') {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority]
}
