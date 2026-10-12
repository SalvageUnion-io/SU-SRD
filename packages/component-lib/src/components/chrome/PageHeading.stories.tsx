import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { PageHeading } from './PageHeading'

export default {
  title: 'Atoms/Page Heading',
}

/** The gauge caption above each cluster. */
const CLUSTER_LABEL = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  marginBottom: space[6],
  textTransform: 'uppercase',
} satisfies CSSProperties

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={CLUSTER_LABEL}>{label}</div>
      {children}
    </div>
  )
}

/** `PageHeading` — the in-page heading rungs under a page's `ChapterBand`: the
 *  condensed-caps `subheading` (default) and the quieter in-panel `section`. */
export const Default: Story = () => (
  <div style={STACK}>
    <Cluster label="subheading (default) — the section head">
      <PageHeading>Available Schemas</PageHeading>
    </Cluster>
    <Cluster label="section — the in-panel head">
      <PageHeading variant="section">Abilities</PageHeading>
    </Cluster>
  </div>
)
