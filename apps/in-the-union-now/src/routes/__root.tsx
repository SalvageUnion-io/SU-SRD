import { useEffect } from 'react'
import { createRootRoute, Outlet, Scripts, HeadContent } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '../lib/queryClient'
import { useAuthStore } from '../stores/authStore'
import { ErrorFallback } from '../components/shared/ErrorFallback'
import '../index.css'

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorFallback,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    const cleanup = initialize()
    return cleanup
  }, [initialize])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>In The Union Now</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap"
          as="style"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <HeadContent />
      </head>
      <body
        className="min-h-dvh bg-[var(--background)] font-mono text-[var(--foreground)] antialiased"
        suppressHydrationWarning
      >
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgb(40, 32, 25)',
                border: '1px solid rgb(80, 80, 80)',
                color: 'rgb(255, 255, 255)',
                fontFamily: "'Fira Code', Monaco, Consolas, monospace",
                fontSize: '0.8125rem',
              },
              classNames: {
                success: '[&>[data-icon]]:text-su-green',
                error: '[&>[data-icon]]:text-su-rust',
              },
            }}
          />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-su-orange">404</h1>
      <p className="text-su-grey-dark">Page not found</p>
      <a href="/" className="text-su-orange underline hover:text-su-orange-dark">
        Back to roster
      </a>
    </div>
  )
}
