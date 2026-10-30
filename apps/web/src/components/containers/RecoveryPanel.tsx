import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import { Button } from '../atoms/Button'
import { TitledBox } from './TitledBox'

type RecoveryPanelProps = {
  /** The title on the cut-out — the failure summary (e.g. 'Something went wrong'). */
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
}

/** The card's width. */
const PANEL = { width: '100%', maxWidth: '36rem' } satisfies CSSProperties

/** Its body, centred; the padding is `.su-recovery-panel`'s, which steps up at `sm`. */
const BODY = { alignItems: 'center', gap: space[16], textAlign: 'center' } satisfies CSSProperties

const MESSAGE = {
  fontFamily: font.body,
  fontSize: fontSize.body,
  lineHeight: '20px',
  color: color.wkMuted,
} satisfies CSSProperties

/**
 * RecoveryPanel — the shared error-recovery card behind the reference site's island error
 * boundary and the app's root error component (which mirrored each other by hand).
 * A `TitledBox` with the failure on its cut-out, a muted message, optional inline
 * content, and one primary (rust) recovery Button.
 *
 * Content-agnostic (a Container, not an entity component): it knows nothing
 * about islands, routers, or IndexedDB — the app injects the copy and the
 * `action` handler. `role="alert"` lives on the card so the failure is
 * announced wherever it mounts; the app supplies only the surrounding layout
 * (full-viewport centering, inline island slot, …).
 */
export function RecoveryPanel({ title, message, action, children }: RecoveryPanelProps) {
  return (
    <div role="alert" style={PANEL}>
      <TitledBox title={title} titleAs="h1" bodyClassName="su-recovery-panel" bodyStyle={BODY}>
        <p style={MESSAGE}>{message}</p>
        {children}
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      </TitledBox>
    </div>
  )
}
