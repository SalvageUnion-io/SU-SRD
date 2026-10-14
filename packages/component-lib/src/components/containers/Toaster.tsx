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
        // The status icon's colour: `.su-toast--ok` / `--bad` in index.css; the
        // description's paper: `.su-toast__description`.
        classNames: {
          success: 'su-toast--ok',
          error: 'su-toast--bad',
          description: 'su-toast__description',
        },
      }}
    />
  )
}
