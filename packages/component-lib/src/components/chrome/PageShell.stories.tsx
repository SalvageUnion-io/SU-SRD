import type { Story } from '@ladle/react'
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
export const Default: Story = () => (
  <PageShell>
    <PageHeading>Games</PageHeading>
    <Panel soft>
      <div className="p-4 font-body text-caption text-wk-muted">
        Children are stacked in a column with the standard gap.
      </div>
    </Panel>
    <Panel soft>
      <div className="p-4 font-body text-caption text-wk-muted">
        Two siblings, so the gap between them is visible.
      </div>
    </Panel>
  </PageShell>
)

/** `stack={false}` keeps the ground and the gutters but hands layout back to
 *  the screen — what the Roster (a grid) and the encounter tray need. */
export const Unstacked: Story = () => (
  <PageShell stack={false}>
    <PageHeading>Saved Builds</PageHeading>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <Panel soft>
        <div className="p-4 font-body text-caption text-wk-muted">Screen owns its own layout</div>
      </Panel>
      <Panel soft>
        <div className="p-4 font-body text-caption text-wk-muted">— here, a two-column grid</div>
      </Panel>
    </div>
  </PageShell>
)
