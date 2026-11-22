/**
 * PublicSheet — one published sheet, read-only, for a reader with no account
 * ([ADR-032](../../../../../docs/adr/032-public-read-only-sheets.md)).
 *
 * Rendered by the same live `<Sheet>` as every other surface, from a store built
 * out of `publicSheet.get` (`readOnlySheetStore.model.ts`), so it adds no rendering
 * code of its own. That query is reactive: the page reflects the sheet as it
 * stands right now, assignments included — its mech, its crawler, a crawler's
 * crew.
 *
 * It is the only account-free way to share a sheet: frozen snapshots were
 * retired (ADR-036). The banner says the page is live, because "read-only" and
 * "frozen" are different promises and a reader should not have to guess.
 *
 * When the entity at the other end of an assignment is published too, its row
 * carries its name, its vitals and a View into its own public page. When it is
 * not, the server sends its kind and nothing else, and its slot says "Not
 * shared" — publishing your pilot never names, let alone
 * republishes, your crewmate's.
 *
 * A shared mech's banner ends with the way to a build of your own
 * (`PublicMechBuild`, r4 E18), as a shared pattern's page has.
 */

import { publicPath } from 'game-domain/entityKinds'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { tokens } from '../../components/index'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { buildSheetCopy } from '../../messages/build-sheet'
import { PublicMechBuild } from './PublicMechBuild'
import { READ_ONLY_BANNER } from './readOnlyBanner.model'
import type { PublicSheetAnswer } from './readOnlySheetStore.model'
import { makeReadOnlySheetStore, sheetDataFromPublic } from './readOnlySheetStore.model'
import { Sheet } from './Sheet'
import { ShownSheetContext } from './shownSheet'

type PublicSheetProps = {
  /** The app id the page is addressed by — the published entity's own id. */
  appId: string
  /** `publicSheet.get`'s answer; bodies in it are not yet validated. */
  answer: PublicSheetAnswer & {
    /**
     * Ability refs of the pilot flying this mech, resolved server-side.
     *
     * Load-bearing, not decorative: a mech's Max SP and Cargo depend on its
     * pilot (ADR-029), and that pilot's sheet is usually not published — so
     * without this a published mech reads LOWER than the same mech on its
     * owner's sheet.
     */
    pilotAbilities?: string[]
  }
}

/** The banner's line: what the page is, then its one act, wrapping under it on a phone. */
const BANNER_LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${tokens.space[8]} ${tokens.space[16]}`,
  justifyContent: 'space-between',
} satisfies CSSProperties

export function PublicSheet({ appId, answer }: PublicSheetProps) {
  const { data, withheld, published } = useMemo(
    () => sheetDataFromPublic(answer, appId),
    [answer, appId]
  )
  const store = useMemo(() => makeReadOnlySheetStore(data), [data])
  // Only a published entity has a page a reader can open.
  const hrefFor = useMemo(
    () => (kind: EntityRef['type'], id: string) =>
      published.has(id) ? publicPath(kind, id) : undefined,
    [published]
  )
  const kind = answer.kind
  const mech = kind === 'mech' ? store.getState().get('mech', appId) : null

  if (
    (kind !== 'pilot' && kind !== 'mech' && kind !== 'crawler') ||
    store.getState().get(kind, appId) === null
  ) {
    // The body is `v.any()` on the server, so an unparseable one is a real
    // shape rather than an impossible one. `setPublic` parses before it
    // publishes precisely so the owner meets this first, but a schema that
    // moves afterwards can still land somebody here.
    return (
      <NotFoundPanel
        title={buildSheetCopy('couldNotRenderThisSheet')}
        message={buildSheetCopy('thisBuildsDataDoesntMatch')}
      />
    )
  }

  return (
    <div>
      <div
        role="note"
        aria-label={buildSheetCopy('readOnlySheet')}
        className="su-sheet-public-banner"
        // Its side padding widens at `sm` (`.su-sheet-public-banner`).
        style={READ_ONLY_BANNER}
      >
        <div style={BANNER_LINE}>
          <span>{buildSheetCopy('thisSheetIsSharedRead')}</span>
          {mech && <PublicMechBuild mech={mech} />}
        </div>
      </div>

      <ShownSheetContext.Provider value>
        <Sheet
          kind={kind}
          id={appId}
          store={store}
          pilotAbilities={kind === 'mech' ? answer.pilotAbilities : undefined}
          hrefFor={hrefFor}
          withheld={withheld}
          readOnly
        />
      </ShownSheetContext.Provider>
    </div>
  )
}
