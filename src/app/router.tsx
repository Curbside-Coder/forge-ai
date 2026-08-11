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
import { SpecsPage } from '@/features/playbooks/specs-page'
import { FocusPage } from '@/features/playbooks/focus-page'
import { IdeasPage } from '@/features/playbooks/ideas-page'
import { CompassPage } from '@/features/playbooks/compass-page'
import { ReviewPage } from '@/features/playbooks/review-page'

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
const specsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/specs',
  component: SpecsPage,
})
const focusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/focus',
  component: FocusPage,
})
const ideasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ideas',
  component: IdeasPage,
})
const compassRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/compass',
  component: CompassPage,
})
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  component: ReviewPage,
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
  specsRoute,
  focusRoute,
  ideasRoute,
  compassRoute,
  reviewRoute,
])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
