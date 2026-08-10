import { CalendarDays, FolderKanban, ListTodo } from 'lucide-react'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { timeAgo } from '@/features/work-items/work-item-utils'

type Entry = {
  id: string
  title: string
  detail: string
  at: string
  href: string
  icon: typeof ListTodo
}

export function LogsPage() {
  const { workItems, projects, meetings } = useWorkspace()
  const entries: Entry[] = [
    ...workItems.flatMap((item) => [
      {
        id: `${item.id}-created`,
        title: item.title,
        detail: 'Work item created',
        at: item.createdAt,
        href: `/work-items?item=${item.id}`,
        icon: ListTodo,
      },
      ...(item.updatedAt !== item.createdAt
        ? [
            {
              id: `${item.id}-updated`,
              title: item.title,
              detail: `Work item updated · ${item.status.replace('_', ' ')}`,
              at: item.updatedAt,
              href: `/work-items?item=${item.id}`,
              icon: ListTodo,
            },
          ]
        : []),
    ]),
    ...projects.map((project) => ({
      id: project.id,
      title: project.name,
      detail: 'Project created',
      at: project.createdAt,
      href: `/projects?project=${project.id}`,
      icon: FolderKanban,
    })),
    ...meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      detail: 'Meeting notes captured',
      at: meeting.createdAt,
      href: `/meetings?meeting=${meeting.id}`,
      icon: CalendarDays,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <section className="max-w-3xl">
      <p className="text-sm text-zinc-500">A durable trail of your work</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Logs</h1>
      <div className="mt-10 space-y-1">
        {entries.map((entry) => {
          const Icon = entry.icon
          return (
            <a
              key={entry.id}
              href={entry.href}
              className="flex items-center gap-4 rounded-xl px-4 py-4 hover:bg-white/[0.04]"
            >
              <Icon className="size-4 text-zinc-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-200">{entry.title}</span>
                <span className="mt-1 block text-xs text-zinc-600">{entry.detail}</span>
              </span>
              <span className="text-xs text-zinc-600">{timeAgo(entry.at)}</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
