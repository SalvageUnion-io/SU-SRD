/* Ported from packages/component-lib/src/components/chrome/PageShell.stories.tsx. */
import { PageHeading, PageShell, Panel } from 'component-lib'

/**
 * The full-bleed `<main>` landmark a top-level app screen sits in: standard
 * ground, responsive gutters, and by default a stacked column.
 *
 * It renders the landmark itself, so a screen using it must not nest another
 * `<main>`.
 */
export function Stacked() {
  return (
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
}

/**
 * `stack={false}` keeps the ground and the gutters but hands layout back to the
 * screen — what the Roster (a grid) and the encounter tray need.
 */
export function Unstacked() {
  return (
    <PageShell stack={false}>
      <PageHeading>Saved Builds</PageHeading>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Panel soft>
          <div className="p-4 font-body text-caption text-wk-muted">
            Screen owns its own layout
          </div>
        </Panel>
        <Panel soft>
          <div className="p-4 font-body text-caption text-wk-muted">
            — here, a two-column grid
          </div>
        </Panel>
      </div>
    </PageShell>
  )
}
