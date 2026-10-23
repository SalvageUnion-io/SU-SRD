/**
 * NpcSheetView — `/npcs/:id`'s body: which NPC, and whether the viewer
 * may edit it (ADR-044).
 *
 * The same three answers `SheetView` gives a pilot, from the same
 * `useLocatedSheet`, worded the same (`SheetFallback`):
 *
 *  - **Yours** — the local copy, editable, unless the server says otherwise.
 *  - **A crewmate's, in a Game you belong to** — read live and read-only from
 *    `entities.listForGame`, never cached (ADR-037), under the crew sheet's
 *    caution banner (`CrewSheetBanner`).
 *  - **Neither** — not found.
 */

import { useNavigate } from '@tanstack/react-router'
import { NpcSchema } from 'game-domain/schemas/npc'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { useMemo } from 'react'
import { useConfirm } from '../../components/shared/useConfirm'
import { useSoftLinkList } from '../../lib/entities'
import { softLinkFromServer } from '../../lib/links/linkSync'
import { crewLinkOf } from '../../lib/npcs/npcModel'
import { useEntityStore } from '../../stores/entityStore'
import { CrewSheetBanner } from '../sheet/CrewSheetBanner'
import { rowAppId } from '../sheet/readOnlySheetStore.model'
import { SheetFallback } from '../sheet/SheetFallback'
import { SheetModeContext } from '../sheet/sheetMode.model'
import { useLocatedSheet } from '../sheet/useLocatedSheet'
import type { NpcCrewing } from './NpcSheet'
import { NpcSheet } from './NpcSheet'

/** The crawler slot an NPC fills, named from whichever crawlers this view can read. */
function crewingOf(
  links: readonly SoftLink[],
  npcId: string,
  crawlerName: (id: string) => string | undefined
): NpcCrewing | undefined {
  const link = crewLinkOf(links, npcId)
  if (link?.slot === undefined) return undefined
  return {
    crawlerId: link.to.id,
    crawlerName: crawlerName(link.to.id) ?? 'a crawler',
    slot: link.slot,
  }
}

export function NpcSheetView({ id }: { id: string }) {
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  const links = useSoftLinkList()
  const crawlers = useEntityStore((s) => s.crawlers)
  const { status, held, listing, listedRow, members, me, sheetMode, crew } = useLocatedSheet(
    'npc',
    id
  )

  /** A crewmate's NPC, parsed from the Game's listing; null when it cannot be read. */
  const theirs = useMemo(() => {
    if (listedRow === undefined) return undefined
    const parsed = NpcSchema.safeParse(listedRow.body)
    return parsed.success ? { ...parsed.data, id } : null
  }, [listedRow, id])

  // Yours: the local copy, editable.
  if (status === 'yours' && held !== null) {
    const crawlerName = (crawlerId: string) => crawlers.find((c) => c.id === crawlerId)?.name
    return (
      <SheetModeContext.Provider value={sheetMode}>
        <NpcSheet
          npc={held}
          madeBy={me?.displayName ?? 'you'}
          readOnly={false}
          crewing={crewingOf(links, id, crawlerName)}
          confirm={confirm}
          onDeleted={() => void navigate({ to: '/' })}
        />
        {dialog}
      </SheetModeContext.Provider>
    )
  }
  if (status !== 'listed' || theirs === undefined || listedRow === undefined) {
    return (
      <SheetFallback
        kind="npc"
        status={status === 'listed' || status === 'yours' ? 'loading' : status}
        back={crew}
      />
    )
  }
  if (theirs === null) return <SheetFallback kind="npc" status="unreadable" back={crew} />

  const gameLinks = (listing?.softLinks ?? []).map(softLinkFromServer)
  const gameCrawlerName = (crawlerId: string) => {
    const row = listing?.crawlers.find((c) => rowAppId(c) === crawlerId)
    const crawlerBodyName = (row?.body as { name?: unknown } | undefined)?.name
    return typeof crawlerBodyName === 'string' ? crawlerBodyName : undefined
  }
  const maker = members?.find((m) => m.userId === listedRow.ownerId)?.displayName
  return (
    <CrewSheetBanner kind="npc">
      <NpcSheet
        npc={theirs}
        madeBy={maker ?? 'a player'}
        readOnly
        crewing={crewingOf(gameLinks, id, gameCrawlerName)}
      />
    </CrewSheetBanner>
  )
}
