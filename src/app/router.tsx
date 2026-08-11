import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { AuthGate } from '@/features/auth/auth-gate'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { MeetingsPage } from '@/features/meetings/meetings-page'
import { CalendarPage } from '@/features/calendar/calendar-page'
import { LogsPage } from '@/features/logs/logs-page'
import { InboxPage } from '@/features/inbox/inbox-page'
import { ProjectsPage } from '@/features/projects/projects-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { WorkItemsPage } from '@/features/work-items/work-items-page'
import { ReportsPage } from '@/features/reports/reports-page'

const rootRoute = createRootRoute({
  component: () => (
    <AuthGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGate>
  ),
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})
const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
})
const workItemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work-items',
  component: WorkItemsPage,
})
const meetingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/meetings',
  component: MeetingsPage,
})
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
})
const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsPage,
})
const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: InboxPage,
})
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})
const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: ReportsPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  workItemsRoute,
  meetingsRoute,
  calendarRoute,
  logsRoute,
  inboxRoute,
  settingsRoute,
  reportsRoute,
])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
