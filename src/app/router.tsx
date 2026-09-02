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
import { SharedWorkItemsPage } from '@/features/work-items/shared-work-items-page'
import { TimeTrackerPage } from '@/features/time-tracker/time-tracker-page'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: () => (
    <AuthGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGate>
  ),
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
})
const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects',
  component: ProjectsPage,
})
const workItemsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/work-items',
  component: WorkItemsPage,
})
const meetingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/meetings',
  component: MeetingsPage,
})
const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/calendar',
  component: CalendarPage,
})
const logsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/logs',
  component: LogsPage,
})
const inboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/inbox',
  component: InboxPage,
})
const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
})
const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/reports',
  component: ReportsPage,
})
const timeTrackerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/time-tracker',
  component: TimeTrackerPage,
})
const timeTrackerSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/time-tracker/settings',
  component: () => <TimeTrackerPage settingsOnly />,
})

const sharedWorkItemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shared/work-items/$token',
  component: SharedWorkItemsPage,
})

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([
    dashboardRoute,
    projectsRoute,
    workItemsRoute,
    meetingsRoute,
    calendarRoute,
    logsRoute,
    inboxRoute,
    settingsRoute,
    reportsRoute,
    timeTrackerRoute,
    timeTrackerSettingsRoute,
  ]),
  sharedWorkItemsRoute,
])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
