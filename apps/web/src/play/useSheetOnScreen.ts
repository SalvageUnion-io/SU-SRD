/**
 * useSheetOnScreen — the player's screen's one sheet on the screen (play.md
 * §18): which unit's sheet stands in the Actions column, and the units the
 * picker offers. In a Game, every pilot, mech and crawler the Game's listing
 * holds; solo, this pilot, its mechs and its crawler; each pilot's and
 * mech's companions after them. A unit your own store holds is yours, and so
 * is a companion on it.
 */

import { useState } from 'react'
import { useGameListing } from '../replica/gameListing'
import { useUnits } from '../replica/units'
import type { PlayTarget } from './play.model'
import type { SheetChoice, ShownSheet } from './sheetOnScreen.model'
import { listedName, partnerChoices, sheetChoiceSections } from './sheetOnScreen.model'
import type { Play } from './situation.model'
import type { SheetTarget } from './useOpenSheet'
import type { PlayUnits } from './usePlayUnits'

export type SheetOnScreen = {
  shown: ShownSheet
  sections: SheetChoice[][]
  /** Puts a unit's sheet on the screen. */
  show: (target: SheetTarget) => void
  close: () => void
}

export function useSheetOnScreen(target: PlayTarget, play: Play, units: PlayUnits): SheetOnScreen {
  const [shown, setShown] = useState<ShownSheet>(null)
  const store = useUnits()
  const listing = useGameListing(target.gameId)
  const held = (kind: 'pilot' | 'mech' | 'crawler', id: string) => store.get(kind, id) !== null
  const heldTarget = (t: SheetTarget) =>
    t.kind === 'partner' ? held(t.host.kind, t.host.id) : held(t.kind, t.id)

  const choices: SheetChoice[] = []
  const add = (kind: 'pilot' | 'mech' | 'crawler', id: string, name: string, body?: unknown) => {
    const yours = held(kind, id)
    choices.push({ kind, id, name, yours })
    if (kind !== 'crawler')
      choices.push(
        ...partnerChoices({ kind, id, partners: (body as { partners?: unknown })?.partners }, yours)
      )
  }
  if (play.pilot) add('pilot', play.pilot.id, play.pilot.name, play.pilot)
  if (units.mech) add('mech', units.mech.mech.id, units.mech.mech.name, units.mech.mech)
  for (const spare of units.hangar)
    add('mech', spare.mechId, spare.name, store.get('mech', spare.mechId))
  if (units.crawler) add('crawler', units.crawler.crawler.id, units.crawler.crawler.name)
  if (listing) {
    for (const row of listing.pilots)
      if (row.appId) add('pilot', row.appId, listedName(row.body), row.body)
    for (const row of listing.mechs)
      if (row.appId) add('mech', row.appId, listedName(row.body), row.body)
    for (const row of listing.crawlers)
      if (row.appId) add('crawler', row.appId, listedName(row.body))
  }

  return {
    shown,
    sections: sheetChoiceSections(choices, play.pilot?.id ?? null),
    show: (t) => setShown({ ...t, yours: heldTarget(t) }),
    close: () => setShown(null),
  }
}
