import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { WorkspaceProvider } from '@/features/workspace/workspace-store'
import { AuthProvider } from '@/features/auth/auth-provider'
import { PlaybooksProvider } from '@/features/playbooks/playbooks-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <PlaybooksProvider>{children}</PlaybooksProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
