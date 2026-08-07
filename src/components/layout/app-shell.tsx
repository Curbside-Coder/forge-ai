import { Link } from '@tanstack/react-router'
import {
  Bell,
  Boxes,
  CalendarDays,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
} from 'lucide-react'
import type { PropsWithChildren } from 'react'

const navigation = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/work-items', label: 'Work items', icon: ListTodo },
  { to: '/meetings', label: 'Meetings', icon: CalendarDays },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
] as const

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 hidden w-64 border-r border-white/10 bg-zinc-950 px-4 py-5 lg:block">
        <Link
          to="/"
          className="mb-10 flex items-center gap-3 px-2 text-lg font-semibold tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-violet-500">
            <Boxes className="size-4" />
          </span>
          Forge
        </Link>
        <nav className="space-y-1">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: 'bg-white/10 text-white' }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          to="/settings"
          activeProps={{ className: 'bg-white/10 text-white' }}
          className="absolute bottom-5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/90 px-5 backdrop-blur lg:px-8">
          <button className="flex items-center gap-2 text-sm text-zinc-400">
            <Search className="size-4" />
            Search Forge
          </button>
          <div className="flex items-center gap-4">
            <button aria-label="Notifications" className="text-zinc-400 hover:text-white">
              <Bell className="size-4" />
            </button>
            <div className="grid size-8 place-items-center rounded-full bg-violet-500 text-xs font-semibold">
              CF
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
