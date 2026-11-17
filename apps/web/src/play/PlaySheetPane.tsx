/**
 * PlaySheetPane — a unit's sheet on the player's screen (play.md §18): it
 * stands in the Actions column from `lg`, Units and Crew, Tables and Feed
 * still beside it; below `lg`, in the open pane's place, the tabs still at
 * the foot. Its head is a Slab, "Sheet", then the picker (every
 * sheet the screen may show: yours, then the table's), "Edit in Build" on a
 * unit you hold, and × back to Actions; the sheet's own band names the unit.
 * A companion shows its card, named in its head, read off its host pilot or mech.
 *
 * Read-only, as Play only plays (ADR-052 §3): in a Game the sheet reads the
 * Game's listing (`useGameListing`) through a read-only store, as the crew
 * sheet route does, so a crewmate's stays live as they play and nothing is
 * adopted (ADR-037); a unit the listing lacks (solo) reads your own store.
 *
 * The pane is level 0's region (play.md §12): its head a Slab, the sheet's
 * own band and boxes below it.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import { sheetPath } from 'game-domain/entityKinds'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { PartnerCard } from '../build/sheet/PartnerCard'
import {
  makeReadOnlySheetStore,
  sheetDataFromListing,
} from '../build/sheet/readOnlySheetStore.model'
import { Sheet } from '../build/sheet/Sheet'
import { Button, CloseButton, HeaderMenu, Pending, Slab, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { useGameListing } from '../replica/gameListing'
import type { UnitsStore } from '../replica/units'
import { useUnits } from '../replica/units'
import type { SheetChoice } from './sheetOnScreen.model'

const TOOLS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  justifyContent: 'flex-end',
} satisfies CSSProperties

const KIND_LABEL = {
  pilot: playCopy('kindPilot'),
  mech: playCopy('kindMech'),
  crawler: playCopy('kindCrawler'),
  partner: playCopy('kindCompanion'),
} as const

type PlaySheetPaneProps = {
  /** The unit on the screen. */
  shown: SheetChoice
  /** The picker's sections (`sheetChoiceSections`). */
  sections: readonly SheetChoice[][]
  /** The Game whose listing the sheet reads; null solo. */
  gameId: string | null
  onShow: (choice: SheetChoice) => void
  onClose: () => void
}

export function PlaySheetPane({ shown, sections, gameId, onShow, onClose }: PlaySheetPaneProps) {
  return (
    <>
      <Slab
        as="h2"
        flush
        label={playCopy('sheet')}
        actions={
          <div style={TOOLS}>
            <HeaderMenu
              variant="button"
              size="mini"
              trigger={playCopy('showASheet')}
              label={playCopy('showASheet')}
              sections={sections.map((section) =>
                section.map((c) => ({
                  id: `${c.kind}:${c.id}`,
                  label: c.name,
                  hint: c.yours
                    ? playCopy('kindYours', { kind: KIND_LABEL[c.kind] })
                    : KIND_LABEL[c.kind],
                  onSelect: () => onShow(c),
                }))
              )}
            />
            {shown.yours ? (
              <Button
                href={
                  shown.kind === 'partner'
                    ? sheetPath(shown.host.kind, shown.host.id)
                    : sheetPath(shown.kind, shown.id)
                }
                variant="ghost"
                size="mini"
              >
                {playCopy('editInBuild')}
              </Button>
            ) : null}
            <CloseButton label={playCopy('backToActions')} onClick={onClose} />
          </div>
        }
      />
      {gameId === null ? (
        <ShownSheetBody key={`${shown.kind}:${shown.id}`} shown={shown} store={useUnits} />
      ) : (
        <ListedSheet key={`${shown.kind}:${shown.id}`} gameId={gameId} shown={shown} />
      )}
    </>
  )
}

/** A Game's unit, read from its listing; yours from your own store when the listing lacks it. */
function ListedSheet({ gameId, shown }: { gameId: string; shown: SheetChoice }) {
  const listing = useGameListing(gameId)
  const store = useMemo(
    () => (listing ? makeReadOnlySheetStore(sheetDataFromListing(listing)) : null),
    [listing]
  )
  if (store === null) return <Pending label={playCopy('theirSheet')} />
  const [kind, id] =
    shown.kind === 'partner' ? [shown.host.kind, shown.host.id] : [shown.kind, shown.id]
  if (store.getState().get(kind, id) === null && shown.yours)
    return <ShownSheetBody shown={shown} store={useUnits} />
  return <ShownSheetBody shown={shown} store={store} />
}

/**
 * The sheet itself: a unit's `Sheet`, or a companion's `PartnerCard` (as the
 * mech sheet lists its drones), read off its host.
 */
function ShownSheetBody({ shown, store }: { shown: SheetChoice; store: UnitsStore }) {
  const state = store()
  if (shown.kind !== 'partner')
    return <Sheet kind={shown.kind} id={shown.id} store={store} readOnly />
  const host = state.get(shown.host.kind, shown.host.id)
  const partner = host?.partners?.find((p) => p.id === shown.id)
  if (!host || !partner) return <Pending label={playCopy('theirSheet')} />
  if (shown.host.kind === 'mech')
    return (
      <PartnerCard
        found={{ partner, hostKind: 'mech', host: host as Mech }}
        readOnly
        store={store}
      />
    )
  const pilot = host as Pilot
  const link = state.softLinks.find((l) => l.type === 'pilot-to-crawler' && l.from.id === pilot.id)
  const crawler = link ? state.get('crawler', link.to.id) : null
  return (
    <PartnerCard
      found={{ partner, hostKind: 'pilot', host: pilot }}
      crawler={crawler}
      crawlerTechLevel={resolveEffectiveCrawlerLevel(pilot, crawler)}
      hostAbilityRefs={pilot.abilities}
      readOnly
      crawlerReadOnly
      store={store}
    />
  )
}
