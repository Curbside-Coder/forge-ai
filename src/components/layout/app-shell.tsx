import { Link } from '@tanstack/react-router'
import {
  Bell,
  ChartNoAxesCombined,
  CalendarDays,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Search,
  Settings,
  X,
} from 'lucide-react'
import { useMemo, useState, type PropsWithChildren } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import { useWorkspace } from '@/features/workspace/workspace-store'
import { ForgeChat } from '@/features/assistant/forge-chat'
import { ForgeMark } from '@/components/brand/forge-mark'

const navigation = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/work-items', label: 'Work items', icon: ListTodo },
  { to: '/meetings', label: 'Meetings', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
] as const

export function AppShell({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth()
  const { projects, workItems, meetings } = useWorkspace()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return [
      ...projects
        .filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(term))
        .map((project) => ({
          id: project.id,
          label: project.name,
          kind: 'Project',
          href: `/projects?project=${project.id}`,
        })),
      ...workItems
        .filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(term))
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          label: item.title,
          kind: 'Work item',
          href: `/work-items?item=${item.id}`,
        })),
      ...meetings
        .filter((meeting) => `${meeting.title} ${meeting.notes}`.toLowerCase().includes(term))
        .map((meeting) => ({
          id: meeting.id,
          label: meeting.title,
          kind: 'Meeting',
          href: `/meetings?meeting=${meeting.id}`,
        })),
    ].slice(0, 10)
  }, [meetings, projects, query, workItems])
  const closeSearch = () => {
    setIsSearchOpen(false)
    setQuery('')
  }
  const displayName =
    (user?.user_metadata.display_name as string | undefined) ?? user?.email ?? 'Forge user'
  const avatarUrl = user?.user_metadata.avatar_url as string | undefined
  const attention = workItems.filter((item) => {
    const idleDays = (now - new Date(item.updatedAt).getTime()) / 86_400_000
    return item.status !== 'done' && (item.priority === 'critical' || idleDays >= 7)
  })
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100">
      <aside className="fixed inset-y-0 hidden w-60 bg-[#0c0c0e] px-4 py-6 lg:block">
        <Link
          to="/"
          className="mb-12 flex items-center gap-3 px-2 text-lg font-semibold tracking-[-0.03em]"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-zinc-100 text-zinc-950">
            <ForgeMark className="size-[19px]" />
          </span>
          Forge
        </Link>
        <nav className="space-y-1">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: 'bg-white/[0.07] text-white' }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-[#29282b] hover:text-[#eee9df]"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          to="/settings"
          activeProps={{ className: 'bg-white/[0.07] text-white' }}
          className="absolute bottom-6 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between bg-[#0c0c0e]/90 px-5 backdrop-blur lg:px-10">
          <button
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation"
            className="grid size-10 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="mr-auto flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <Search className="size-4" />
            <span>Search</span>
            <kbd className="hidden rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline">
              ⌘ K
            </kbd>
          </button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen((value) => !value)}
                aria-label="Notifications"
                className="relative text-zinc-500 transition hover:text-white"
              >
                <Bell className="size-4" />
                {attention.length > 0 && (
                  <span className="absolute -right-2 -top-2 grid size-3.5 place-items-center rounded-full bg-rose-400 text-[9px] font-bold text-rose-950">
                    {attention.length}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 top-8 z-30 w-80 rounded-xl bg-[#19191d] p-2 shadow-2xl ring-1 ring-white/[0.08]">
                  <p className="px-3 py-2 text-xs font-medium text-zinc-500">Needs attention</p>
                  {attention.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-zinc-600">Nothing needs attention.</p>
                  ) : (
                    attention.slice(0, 5).map((item) => (
                      <a
                        key={item.id}
                        href={`/work-items?item=${item.id}`}
                        className="block rounded-lg px-3 py-3 hover:bg-white/[0.06]"
                      >
                        <span className="block text-sm text-zinc-200">{item.title}</span>
                        <span className="mt-1 block text-xs text-amber-300">
                          {item.priority === 'critical' ? 'Critical priority' : 'Idle for 7+ days'}
                        </span>
                      </a>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setIsAccountOpen((value) => !value)}
                aria-expanded={isAccountOpen}
                aria-label="Open account menu"
                className="grid size-8 place-items-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 ring-1 ring-white/[0.08] transition hover:ring-white/25"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="size-8 rounded-full object-cover" />
                ) : (
                  displayName.slice(0, 2).toUpperCase()
                )}
              </button>
              {isAccountOpen && (
                <div className="absolute right-0 top-10 z-30 w-64 rounded-xl bg-[#19191d] p-2 shadow-2xl ring-1 ring-white/[0.08]">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-zinc-200">{displayName}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">{user?.email}</p>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                  >
                    <Settings className="size-4" /> Account settings
                  </Link>
                  <div className="my-2 border-t border-white/[0.07]" />
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Sign out of Forge? You will need a new email sign-in link to return.',
                        )
                      )
                        void signOut()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-400/10"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-10 lg:px-10 lg:py-14">{children}</main>
      </div>
      {isNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            onClick={() => setIsNavOpen(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-[#121216] px-4 py-6 shadow-2xl ring-1 ring-white/[0.08]">
            <div className="mb-10 flex items-center justify-between px-2">
              <Link
                to="/"
                onClick={() => setIsNavOpen(false)}
                className="flex items-center gap-3 text-lg font-semibold tracking-[-0.03em]"
              >
                <span className="grid size-8 place-items-center rounded-xl bg-zinc-100 text-zinc-950">
                  <ForgeMark className="size-[19px]" />
                </span>
                Forge
              </Link>
              <button
                onClick={() => setIsNavOpen(false)}
                aria-label="Close navigation"
                className="p-2 text-zinc-500 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navigation.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setIsNavOpen(false)}
                  activeProps={{ className: 'bg-white/[0.07] text-white' }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <Link
              to="/settings"
              onClick={() => setIsNavOpen(false)}
              className="mt-auto flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 hover:bg-[#29282b] hover:text-[#eee9df]"
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </aside>
        </div>
      )}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/65 px-5 pt-[12vh] backdrop-blur-sm"
          onMouseDown={closeSearch}
        >
          <div
            className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-[#19191d] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
              <Search className="size-4 text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects, work items, and meetings"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={closeSearch}
                aria-label="Close search"
                className="p-2 text-zinc-500 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {!query.trim() ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-600">
                  Start typing to search Forge.
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-600">
                  No matching Forge records.
                </p>
              ) : (
                results.map((result) => (
                  <a
                    key={`${result.kind}-${result.id}`}
                    onClick={closeSearch}
                    href={result.href}
                    className="block rounded-xl px-3 py-3 hover:bg-white/[0.06]"
                  >
                    <span className="block text-sm text-zinc-200">{result.label}</span>
                    <span className="mt-1 block text-xs text-zinc-600">{result.kind}</span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <ForgeChat />
    </div>
  )
}
