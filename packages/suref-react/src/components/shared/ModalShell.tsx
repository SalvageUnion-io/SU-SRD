import type { ReactNode, RefObject } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { DisplayCard } from './DisplayCard'
import { Text } from '../base/Text'

type ModalShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  /** sr-only accessibility description */
  description?: string
  headerBg?: string
  maxWidth?: string
  align?: 'center' | 'top'
  /** Element to focus when the dialog opens (defaults to base-ui's first
   *  tabbable — the header close button). Pass a ref for input-first dialogs
   *  like search. */
  initialFocus?: RefObject<HTMLElement | null>
  children?: ReactNode
}

export function ModalShell({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  headerBg = 'bg-su-orange',
  maxWidth = 'max-w-3xl',
  align = 'top',
  initialFocus,
  children,
}: ModalShellProps) {
  const isLightClose = headerBg === 'bg-su-rust'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup
          initialFocus={initialFocus}
          className={`fixed inset-0 z-50 h-fit max-h-[calc(100vh-4rem)] w-full ${maxWidth} overflow-y-auto bg-transparent outline-none ${align === 'center' ? 'm-auto' : 'mx-auto mt-8 mb-auto'}`}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>

          <DisplayCard
            headerBg={headerBg}
            headerContent={
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text
                    as="span"
                    variant="pseudoheader"
                    className={`${headerBg === 'bg-su-rust' ? 'text-xl' : 'text-[1.75rem]'} text-paper`}
                  >
                    {title}
                  </Text>
                  {subtitle && (
                    <Text as="span" variant="pseudoheader" className="text-xs text-paper/80">
                      {subtitle}
                    </Text>
                  )}
                </div>
                <Dialog.Close
                  className={`flex shrink-0 cursor-pointer items-center justify-center rounded p-1 transition-colors ${
                    isLightClose
                      ? 'text-paper/60 hover:bg-su-black/20 hover:text-paper'
                      : 'text-su-black/60 hover:bg-su-black/20 hover:text-su-black'
                  }`}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Dialog.Close>
              </div>
            }
          >
            {children}
          </DisplayCard>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
