import type { ReactNode } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { Footer } from 'suref-react'
import { AppNav } from './AppNav'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6">
        {children}
      </main>
      <Footer poweredBySalvageUrl="/Powered_by_Salvage_Black.webp" />
    </div>
  )
}
