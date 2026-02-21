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
    <div
      className="flex min-h-dvh flex-col"
      style={{ '--app-nav-h': '56px' } as React.CSSProperties}
    >
      <AppNav user={user} />
      <main className="flex w-full flex-1 flex-col justify-center px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer poweredBySalvageUrl="/Powered_by_Salvage_Black.webp" />
    </div>
  )
}
