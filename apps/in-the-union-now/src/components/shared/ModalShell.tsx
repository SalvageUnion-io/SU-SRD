import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { DisplayCard, Text } from 'suref-react'

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
  children,
}: ModalShellProps) {
  const isLightClose = headerBg === 'bg-su-rust'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={`fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${align === 'center' ? 'flex items-center justify-center' : ''}`}
        >
          <div
            className={`flex min-h-full w-full ${align === 'center' ? '' : 'items-start'} justify-center px-4 py-8`}
          >
            <DialogPrimitive.Content
              className={`relative w-full ${maxWidth} bg-transparent outline-none`}
            >
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                {description ?? title}
              </DialogPrimitive.Description>

              <DisplayCard
                headerBg={headerBg}
                bodyPadding="p-0"
                headerContent={
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Text
                        as="span"
                        variant="pseudoheader"
                        className={`${headerBg === 'bg-su-rust' ? 'text-xl' : 'text-[1.75rem]'} text-su-white`}
                      >
                        {title}
                      </Text>
                      {subtitle && (
                        <Text as="span" variant="pseudoheader" className="text-xs text-su-white/80">
                          {subtitle}
                        </Text>
                      )}
                    </div>
                    <DialogPrimitive.Close
                      className={`flex shrink-0 cursor-pointer items-center justify-center rounded p-1 transition-colors ${
                        isLightClose
                          ? 'text-su-white/60 hover:bg-su-black/20 hover:text-su-white'
                          : 'text-su-black/60 hover:bg-su-black/20 hover:text-su-black'
                      }`}
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                }
              >
                {children}
              </DisplayCard>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
