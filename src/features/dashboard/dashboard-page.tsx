import { ArrowRight, CalendarDays, CircleAlert, ListTodo } from 'lucide-react'

const stats = [
  { label: 'Critical', value: '3', icon: CircleAlert },
  { label: 'In progress', value: '12', icon: ListTodo },
  { label: 'Meetings', value: '6', icon: CalendarDays },
]
const projects = ['Admired', 'QPaint', 'Forge']

export function DashboardPage() {
  return (
    <section>
      <p className="text-sm text-zinc-500">Friday, August 7</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Good evening, Christian.</h1>
      <p className="mt-2 max-w-xl text-zinc-400">
        A focused view of what needs your attention today.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <Icon className="size-4 text-violet-400" />
            <p className="mt-6 text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-sm text-zinc-400">{label}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Continue working</h2>
            <button className="text-sm text-violet-400 hover:text-violet-300">View all</button>
          </div>
          <div className="mt-4 space-y-2">
            {projects.map((project) => (
              <button
                key={project}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm hover:bg-white/[0.05]"
              >
                <span>{project}</span>
                <ArrowRight className="size-4 text-zinc-500" />
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-base font-medium">AI suggestions</h2>
          <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6">
            <p className="font-medium">Your workspace is ready.</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Connect a meeting, create a project, or capture a work item when you are ready. AI
              workflows will be added in the next milestone.
            </p>
          </div>
        </section>
      </div>
    </section>
  )
}
