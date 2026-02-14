import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '../stores/authStore'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const { user, loading } = useAuthStore.getState()
    if (!loading && !user) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, loading } = useAuthStore()

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

  return <Outlet />
}
