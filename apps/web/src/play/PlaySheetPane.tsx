/**
 * PlaySheetPane — a unit's sheet on the player's screen (play.md §18): it
 * stands in the Actions column from `lg`, Units and Crew, Tables and Feed
 * still beside it; below `lg`, in the open pane's place, the tabs still at
 * the foot. Its head is a Slab, "Sheet", then the picker (every
 * sheet the screen may show: yours, then the table's), "Edit in Build" on a
 * unit you hold, and × back to Actions; the sheet's own band names the unit.
 *
 * Read-only, as Play only plays (ADR-052 §3): in a Game the sheet reads the
 * Game's listing (`useGameListing`) through a read-only store, as the crew
 * sheet route does, so a crewmate's stays live as they play and nothing is
 * adopted (ADR-037); a unit the listing lacks (solo) reads your own store.
 *
 * The pane is level 0's region (play.md §12): its head a Slab, the sheet's
 * own band and boxes below it.
 */

import { sheetPath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import {
  makeReadOnlySheetStore,
  sheetDataFromListing,
} from '../build/sheet/readOnlySheetStore.model'
import { Sheet } from '../build/sheet/Sheet'
import { Button, CloseButton, HeaderMenu, Pending, Slab, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { useGameListing } from '../replica/gameListing'
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
              <Button href={sheetPath(shown.kind, shown.id)} variant="ghost" size="mini">
                {playCopy('editInBuild')}
              </Button>
            ) : null}
            <CloseButton label={playCopy('backToActions')} onClick={onClose} />
          </div>
        }
      />
      {gameId === null ? (
        <Sheet key={`${shown.kind}:${shown.id}`} kind={shown.kind} id={shown.id} readOnly />
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
  if (store.getState().get(shown.kind, shown.id) === null && shown.yours)
    return <Sheet kind={shown.kind} id={shown.id} readOnly />
  return <Sheet kind={shown.kind} id={shown.id} store={store} readOnly />
}
