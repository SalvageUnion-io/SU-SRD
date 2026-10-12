import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import type { BannerWarning } from './Banner'
import { Banner } from './Banner'

export default {
  title: 'Containers/Banner',
}

const FRAME = {
  maxWidth: '28rem',
  backgroundColor: color.paper,
  padding: space[16],
} satisfies CSSProperties

const LABEL = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  textTransform: 'uppercase',
  letterSpacing: tracking.caps,
  color: color.wkMuted,
} satisfies CSSProperties

/** Story-caption: names the variant under each cluster. */
function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  )
}

// Real Salvage Union soft-warnings: an illegal starting pattern, and a pilot
// out of Energy Points — the actual advisory copy ITUN raises on the mech sheet.
const LEGAL_PATTERN_WARNING: BannerWarning = {
  severity: 'info',
  message: 'This pattern is not a legal starting pattern.',
}
const NO_EP_WARNING: BannerWarning = {
  severity: 'warn',
  message: '0 EP — some actions unavailable.',
}
const AUTOSAVE_WARNING: BannerWarning = {
  severity: 'info',
  message: 'Auto-saved to this device.',
}

/**
 * The canonical strip: an `info` row, a `warn` row, then a second info row —
 * every row is purely informational; the Banner is advisory and never blocks.
 */
export const Default: Story = () => (
  <div style={FRAME}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[24] }}>
      <Cluster label="info">
        <Banner warnings={[LEGAL_PATTERN_WARNING]} />
      </Cluster>
      <Cluster label="warn">
        <Banner warnings={[NO_EP_WARNING]} />
      </Cluster>
      <Cluster label="info · passive">
        <Banner warnings={[AUTOSAVE_WARNING]} />
      </Cluster>
    </div>
  </div>
)

/** Multiple severities stacked in one strip. */
export const Stacked: Story = () => (
  <div style={FRAME}>
    <Banner warnings={[LEGAL_PATTERN_WARNING, NO_EP_WARNING]} />
  </div>
)

/** Empty `warnings` renders nothing — a zero-DOM strip. */
export const Empty: Story = () => (
  <div style={FRAME}>
    <Cluster label="warnings={[]} — renders nothing">
      <Banner warnings={[]} />
    </Cluster>
  </div>
)
