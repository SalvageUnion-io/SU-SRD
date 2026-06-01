import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
  head: () => ({
    meta: [
      { title: 'Authenticating - In The Union Now' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
})

function AuthCallbackPage() {
  useEffect(() => {
    // Supabase auth listener in __root handles session from URL hash automatically.
    // Just redirect home.
    window.location.replace('/')
  }, [])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-su-orange border-t-transparent" />
      <p className="text-su-grey-dark">Confirming your account...</p>
    </div>
  )
}
