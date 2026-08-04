// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--color-ink)',
          border: '1px solid var(--color-ink-2)',
          color: 'var(--color-paper)',
          fontFamily: "var(--font-body, 'Barlow', system-ui, sans-serif)",
          fontSize: '0.8125rem',
        },
        classNames: {
          success: '[&>[data-icon]]:text-status-ok',
          error: '[&>[data-icon]]:text-status-bad',
        },
      }}
    />
  )
}
