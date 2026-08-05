import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../chrome/Button'
import { PageHeading } from '../chrome/PageHeading'

type RecoveryPanelProps = {
  /** Stamp heading — the failure summary (e.g. 'Something went wrong'). */
  title: string
  /** Body copy: what failed, and the reassurance that saved data is safe. */
  message: ReactNode
  /**
   * The recovery affordance — label + handler the app injects. The app owns
   * what "recover" means (an island remount, a router reload, a data retry);
   * the panel only renders the button and its rust CTA treatment.
   */
  action: { label: string; onClick: () => void }
  /**
   * Optional extra content between the message and the action — e.g. a
   * DEV-only error dump. Omitted, the panel is just title / message / button.
   */
  children?: ReactNode
  className?: string
}

/**
 * RecoveryPanel — the shared error-recovery card behind srd's island error
 * boundary and itun's root error component (which mirrored each other by hand).
 * A bordered paper card with a condensed-caps title, a muted message, optional
 * inline content, and one primary (rust) recovery Button.
 *
 * Content-agnostic (a Container, not an entity component): it knows nothing
 * about islands, routers, or IndexedDB — the app injects the copy and the
 * `action` handler. `role="alert"` lives on the card so the failure is
 * announced wherever it mounts; the app supplies only the surrounding layout
 * (full-viewport centering, inline island slot, …).
 */
export function RecoveryPanel({ title, message, action, children, className }: RecoveryPanelProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex w-full max-w-xl flex-col items-center gap-4 rounded-panel border-chrome border-ink bg-paper p-6 text-center sm:p-8',
        className
      )}
    >
      <PageHeading variant="subheading" as="h1" className="tracking-caps-tight text-ink">
        {title}
      </PageHeading>
      <p className="font-body text-sm text-wk-muted">{message}</p>
      {children}
      <Button variant="primary" onClick={action.onClick}>
        {action.label}
      </Button>
    </div>
  )
}
