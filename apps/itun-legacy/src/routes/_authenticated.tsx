import { useEffect } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../stores/authStore'
import { AppShell } from '../components/shell/AppShell'
import { ErrorFallback } from '../components/shared/ErrorFallback'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const { user, loading } = useAuthStore.getState()
    if (!loading && !user) {
      throw redirect({ to: '/login' })
    }
  },
  errorComponent: ErrorFallback,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/login' })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-su-orange border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
