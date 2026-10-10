// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner'

import type { ToasterProps as SonnerToasterProps } from 'sonner'
import { Toaster as SonnerToaster } from 'sonner'

type ToasterProps = {
  /**
   * Distance from the viewport edges (desktop / below 600px). Sonner's defaults
   * apply to any edge left out.
   */
  offset?: SonnerToasterProps['offset']
  mobileOffset?: SonnerToasterProps['mobileOffset']
}

export function Toaster({ offset, mobileOffset }: ToasterProps = {}) {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={offset}
      mobileOffset={mobileOffset}
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
