import { Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../ui/button'

type AppNavProps = {
  user: User | null
}

export function AppNav({ user }: AppNavProps) {
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <nav className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-su-grey-dark/30 bg-su-black px-4">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-bold tracking-tight text-su-orange">
          In The Union Now
        </Link>
        <div className="hidden items-center gap-4 sm:flex">
          <Link
            to="/"
            className="text-sm font-medium text-su-white/70 transition-colors hover:text-su-white [&.active]:text-su-orange"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-su-white/50 sm:inline">{user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="h-8 gap-1.5 text-xs text-su-white/70 hover:bg-su-white/10 hover:text-su-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      )}
    </nav>
  )
}
