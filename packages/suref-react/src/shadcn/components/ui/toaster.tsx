// eslint-disable-next-line react-refresh/only-export-components
export { toast } from 'sonner'
import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'font-mono bg-su-white text-su-black border border-su-grey-light shadow-lg',
          title: 'font-bold',
          description: 'text-su-grey-dark',
        },
      }}
    />
  )
}
