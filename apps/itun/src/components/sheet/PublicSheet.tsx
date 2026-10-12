/**
 * PublicSheet — one published sheet, read-only, for a reader with no account
 * ([ADR-032](../../../../../docs/adr/032-public-read-only-sheets.md)).
 *
 * Rendered by the same live `<Sheet>` as every other surface, from a store built
 * out of `publicSheet.get` (`readOnlySheetStore.ts`), so it adds no rendering
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
 * shared" (`WithheldUnitRow`) — publishing your pilot never names, let alone
 * republishes, your crewmate's.
 */

import { tokens } from 'component-lib'
import type { EntityRef } from 'itun-domain/schemas/entity'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { PublicSheetAnswer } from './readOnlySheetStore'
import { makeReadOnlySheetStore, sheetDataFromPublic } from './readOnlySheetStore'
import { Sheet } from './Sheet'

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

const UNRENDERABLE = {
  marginInline: 'auto',
  maxWidth: '64rem',
  padding: tokens.space[24],
} satisfies CSSProperties

const UNRENDERABLE_TITLE = {
  marginBottom: tokens.space[8],
  fontSize: tokens.fontSize.xl,
  lineHeight: 'calc(1.75 / 1.25)',
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

const UNRENDERABLE_NOTE = {
  marginBottom: tokens.space[4],
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** The read-only banner; its side padding widens at `sm` (`.su-sheet-public-banner`). */
const BANNER = {
  borderBottom: `${tokens.borderWidth.pill} solid ${tokens.color.ink}`,
  backgroundColor: tokens.color.caution,
  paddingBlock: tokens.space[8],
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: tokens.weight.semibold,
  color: tokens.color.ink,
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
      published.has(id) ? `/p/${kind}/${id}` : undefined,
    [published]
  )
  const kind = answer.kind

  if (
    (kind !== 'pilot' && kind !== 'mech' && kind !== 'crawler') ||
    store.getState().get(kind, appId) === null
  ) {
    // The body is `v.any()` on the server, so an unparseable one is a real
    // shape rather than an impossible one. `setPublic` parses before it
    // publishes precisely so the owner meets this first, but a schema that
    // moves afterwards can still land somebody here.
    return (
      <main style={UNRENDERABLE}>
        <h1 style={UNRENDERABLE_TITLE}>Could not render this sheet</h1>
        <p style={UNRENDERABLE_NOTE}>
          This build&rsquo;s data doesn&rsquo;t match anything this app knows how to show. It may
          have been made with a newer or older version.
        </p>
      </main>
    )
  }

  return (
    <div>
      <div
        role="note"
        aria-label="Read-only sheet"
        className="su-sheet-public-banner"
        style={BANNER}
      >
        This sheet is shared read-only. It updates as its owner plays.
      </div>

      <Sheet
        kind={kind}
        id={appId}
        store={store}
        pilotAbilities={kind === 'mech' ? answer.pilotAbilities : undefined}
        hrefFor={hrefFor}
        withheld={withheld}
        readOnly
      />
    </div>
  )
}
