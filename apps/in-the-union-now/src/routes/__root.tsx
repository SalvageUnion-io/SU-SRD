import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { EntityHrefProvider, Toaster } from 'suref-react'
import { queryClient } from '../lib/queryClient'
import { itunEntityHref } from '../lib/entityHref'
import { GameDataReady } from '../components/shared/GameDataReady'
import { BackupNudgeToast } from '../components/shared/BackupNudgeToast'
import '../index.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntityHrefProvider value={itunEntityHref}>
        <GameDataReady>
          <Outlet />
        </GameDataReady>
        <Toaster />
        <BackupNudgeToast />
      </EntityHrefProvider>
    </QueryClientProvider>
  )
}
