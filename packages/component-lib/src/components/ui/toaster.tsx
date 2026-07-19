// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner'
import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'rgb(40, 32, 25)',
          border: '1px solid rgb(80, 80, 80)',
          color: 'rgb(255, 255, 255)',
          fontFamily: "var(--font-body, 'Barlow', system-ui, sans-serif)",
          fontSize: '0.8125rem',
        },
        classNames: {
          success: '[&>[data-icon]]:text-su-green',
          error: '[&>[data-icon]]:text-su-rust',
        },
      }}
    />
  )
}
