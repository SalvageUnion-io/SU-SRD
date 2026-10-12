import type { CSSProperties } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { PageHeading } from './PageHeading'
import { PageShell } from './PageShell'
import { Panel } from './Panel'

export default {
  title: 'Containers/Page Shell',
}

/** `PageShell` — the full-bleed `<main>` landmark a top-level app screen sits
 *  in: standard ground, responsive gutters, and (by default) a stacked column.
 *
 *  It renders the landmark itself, so a screen using it must not nest another
 *  `<main>`. The literal it replaces was written out seven times — five Games
 *  screens plus the Roster and the encounter tray — which is why the Games
 *  surface had grown a local class-string constant for it. */
const NOTE = {
  padding: space[16],
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.wkMuted,
} satisfies CSSProperties

export const Default: Story = () => (
  <PageShell>
    <PageHeading>Games</PageHeading>
    <Panel soft>
      <div style={NOTE}>Children are stacked in a column with the standard gap.</div>
    </Panel>
    <Panel soft>
      <div style={NOTE}>Two siblings, so the gap between them is visible.</div>
    </Panel>
  </PageShell>
)

/** `stack={false}` keeps the ground and the gutters but hands layout back to
 *  the screen — what the Roster (a grid) and the encounter tray need. */
export const Unstacked: Story = () => (
  <PageShell stack={false}>
    <PageHeading>Saved Builds</PageHeading>
    <div
      style={{
        marginTop: space[24],
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: space[12],
      }}
    >
      <Panel soft>
        <div style={NOTE}>Screen owns its own layout</div>
      </Panel>
      <Panel soft>
        <div style={NOTE}>— here, a two-column grid</div>
      </Panel>
    </div>
  </PageShell>
)
