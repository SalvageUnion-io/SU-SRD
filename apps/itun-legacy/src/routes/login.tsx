import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { LogIn, UserPlus, ArrowLeft, Mail } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { user, loading } = useAuthStore.getState()
    if (!loading && user) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

type AuthMode = 'signin' | 'signup' | 'forgot'

function LoginPage() {
  const { signIn, signUp, resetPassword, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('signin')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-su-orange border-t-transparent" />
      </div>
    )
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      setSubmitting(false)
      return
    }

    if (mode === 'forgot') {
      const result = await resetPassword(email)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Check your email for a password reset link.')
      }
      setSubmitting(false)
      return
    }

    const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password)

    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setSuccess('Account created! Check your email to confirm.')
    }
    setSubmitting(false)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-su-orange-dark">In The Union Now</h1>
        <p className="text-sm text-su-grey-dark">Salvage Union Digital Character Sheet</p>
      </div>

      <Card className="w-full max-w-sm border-su-grey-dark/30 bg-su-sand">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-su-orange-dark">
            {mode === 'signin' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </CardTitle>
          <CardDescription className="text-su-grey-dark">
            {mode === 'signin' && 'Enter your credentials to access your roster.'}
            {mode === 'signup' && 'Create an account to start building your roster.'}
            {mode === 'forgot' && "Enter your email and we'll send a reset link."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-su-grey-dark">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="pilot@salvageunion.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-su-grey-dark/30 bg-transparent focus-visible:ring-su-orange"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium text-su-grey-dark">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-su-grey-dark/30 bg-transparent focus-visible:ring-su-orange"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="text-xs font-medium text-su-grey-dark">
                  Confirm Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-su-grey-dark/30 bg-transparent focus-visible:ring-su-orange"
                />
              </div>
            )}

            {error && (
              <p className="rounded-md bg-su-rust/10 px-3 py-2 text-center text-sm text-su-rust">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-md bg-su-green/10 px-3 py-2 text-center text-sm text-su-green">
                {success}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="bg-su-orange-dark text-white hover:bg-su-black"
            >
              {mode === 'signin' && (
                <>
                  <LogIn className="h-4 w-4" />
                  {submitting ? 'Signing in...' : 'Sign In'}
                </>
              )}
              {mode === 'signup' && (
                <>
                  <UserPlus className="h-4 w-4" />
                  {submitting ? 'Creating account...' : 'Create Account'}
                </>
              )}
              {mode === 'forgot' && (
                <>
                  <Mail className="h-4 w-4" />
                  {submitting ? 'Sending...' : 'Send Reset Link'}
                </>
              )}
            </Button>

            <div className="flex flex-col items-center gap-2 pt-1">
              {mode === 'signin' && (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-sm text-su-grey-dark hover:text-su-orange"
                  >
                    Don&apos;t have an account? Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm text-su-grey-dark hover:text-su-orange"
                  >
                    Forgot your password?
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-sm text-su-grey-dark hover:text-su-orange"
                >
                  Already have an account? Sign in
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="inline-flex items-center gap-1 text-sm text-su-grey-dark hover:text-su-orange"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
