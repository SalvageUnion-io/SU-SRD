/**
 * NpcSheetView — `/sheet/npc/:id`'s body: which NPC, and whether the viewer
 * may edit it (ADR-043).
 *
 * The same three answers `SheetView` gives a pilot, read the same way:
 *
 *  - **Yours** — the local copy, editable, unless the server says otherwise.
 *  - **A crewmate's, in a Game you belong to** — read live and read-only from
 *    `entities.listForGame`, never cached (ADR-037).
 *  - **Neither** — not found.
 *
 * `entities.locate` tells them apart, as it does for every sheet.
 */

import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { useNpc, useSoftLinkList } from '../../hooks/entities'
import { useConnection } from '../../lib/connection/connectionContext'
import { softLinkFromServer } from '../../lib/links/linkSync'
import { crewLinkOf } from '../../lib/npcs/npcModel'
import { pageTitle } from '../../lib/pageTitle'
import type { Npc } from '../../lib/schemas/npc'
import { NpcSchema } from '../../lib/schemas/npc'
import type { SoftLink } from '../../lib/schemas/softLink'
import { useEntityStore } from '../../stores/entityStore'
import { NotFoundPanel } from '../shared/RouteFallbacks'
import { useConfirm } from '../shared/useConfirm'
import { SheetSkeleton } from '../sheet/SheetSkeleton'
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
  const { mode } = useConnection()
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  const held = useNpc(id)
  const links = useSoftLinkList()
  const crawlers = useEntityStore((s) => s.crawlers)

  const online = mode === 'connected'
  const located = useQuery(api.entities.locate, online ? { kind: 'npc', id } : 'skip')
  const gameId = located?.gameId ?? null
  const listing = useQuery(api.entities.listForGame, gameId === null ? 'skip' : { gameId })
  const members = useQuery(api.games.members, gameId === null ? 'skip' : { gameId })
  const me = useQuery(api.account.me, online ? {} : 'skip')

  const name = held?.name ?? null
  useEffect(() => {
    document.title = pageTitle(name || 'NPC')
  }, [name])

  /** A crewmate's NPC, parsed from the Game's listing; null when it is not there. */
  const theirs = useMemo(() => {
    if (listing === undefined) return undefined
    const row = listing.npcs.find(
      (n) => (n.appId ?? (n.body as { id?: unknown } | null)?.id) === id
    )
    if (row === undefined) return null
    const parsed = NpcSchema.safeParse(row.body)
    return parsed.success ? { npc: { ...parsed.data, id } as Npc, ownerId: row.ownerId } : null
  }, [listing, id])

  // Yours: the local copy, editable — unless the server says otherwise.
  if (held !== null && (located == null || located.mayEdit)) {
    const crawlerName = (crawlerId: string) => crawlers.find((c) => c.id === crawlerId)?.name
    return (
      <>
        <NpcSheet
          npc={held}
          madeBy={me?.displayName ?? 'you'}
          readOnly={false}
          crewing={crewingOf(links, id, crawlerName)}
          confirm={confirm}
          onDeleted={() => void navigate({ to: '/' })}
        />
        {dialog}
      </>
    )
  }

  if (!online) {
    if (mode === 'connecting') return <SheetSkeleton />
    return (
      <NotFoundPanel
        title="NPC not found"
        message="This NPC is not saved in this browser. Reading a crewmate's NPC needs a connection."
      />
    )
  }
  if (located === undefined) return <SheetSkeleton />
  if (located === null) {
    return (
      <NotFoundPanel
        title="NPC not found"
        message="It may have been deleted, or it is in a Game you are not part of."
      />
    )
  }
  // Yours, on its way into this browser's cache: wait for it.
  if (located.mayEdit) return <SheetSkeleton />
  if (theirs === undefined) return <SheetSkeleton />
  if (theirs === null) {
    return (
      <NotFoundPanel
        title="Could not show this NPC"
        message="This NPC's data doesn't match anything this app knows how to show. It may have been built in a newer version."
      />
    )
  }

  const gameLinks = (listing?.softLinks ?? []).map(softLinkFromServer)
  const gameCrawlerName = (crawlerId: string) => {
    const row = listing?.crawlers.find(
      (c) => (c.appId ?? (c.body as { id?: unknown } | null)?.id) === crawlerId
    )
    const crawlerBodyName = (row?.body as { name?: unknown } | undefined)?.name
    return typeof crawlerBodyName === 'string' ? crawlerBodyName : undefined
  }
  const maker = members?.find((m) => m.userId === theirs.ownerId)?.displayName
  return (
    <NpcSheet
      npc={theirs.npc}
      madeBy={maker ?? 'a player'}
      readOnly
      crewing={crewingOf(gameLinks, id, gameCrawlerName)}
      back={gameId === null ? undefined : { href: `/games/${gameId}`, label: 'The crew' }}
    />
  )
}
