import type { ErrorComponentProps } from '@tanstack/react-router'

export function ErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold text-su-orange">Something went wrong</h1>
      <p className="max-w-md text-center text-su-grey-dark">
        {error instanceof Error ? error.message : 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-su-orange px-4 py-2 text-sm font-medium text-white hover:bg-su-orange-dark"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-su-grey-dark px-4 py-2 text-sm font-medium text-su-grey-dark hover:bg-su-grey-dark/10"
        >
          Back to roster
        </a>
      </div>
    </div>
  )
}
