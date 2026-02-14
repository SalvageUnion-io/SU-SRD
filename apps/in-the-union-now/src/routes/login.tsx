import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { user, loading } = useAuthStore.getState()
    if (!loading && user) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { signIn, signUp, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-su-orange border-t-transparent" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = isSignUp ? await signUp(email, password) : await signIn(email, password)

    if (result.error) {
      setError(result.error)
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-su-orange">In The Union Now</h1>
        <p className="text-su-grey-dark">Salvage Union Digital Character Sheet</p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-su-grey-dark/30 bg-transparent px-4 py-3 text-sm outline-none focus:border-su-orange"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-su-grey-dark/30 bg-transparent px-4 py-3 text-sm outline-none focus:border-su-orange"
        />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-lg bg-su-orange px-6 py-3 font-medium text-white transition-colors hover:bg-su-orange-dark disabled:opacity-50"
        >
          <LogIn className="h-5 w-5" />
          {submitting ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError(null)
          }}
          className="text-sm text-su-grey-dark hover:text-su-orange"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  )
}
