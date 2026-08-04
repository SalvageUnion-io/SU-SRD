/**
 * GameEntitySheet — a crewmate's build, read-only (ADR-030 §5).
 *
 * ## Why this surface exists
 *
 * A Game's roster used to be a list of rows most of which went nowhere: only
 * what you owned offered a sheet, so a player looking at their crew could see
 * four names and open one of them. That is the wrong answer to "who am I
 * playing with" — the whole point of a shared table is that the table is
 * shared. What was actually unsafe was not *reading* a crewmate's pilot but
 * being handed ITUN's live sheet for it, which is an editing surface whose
 * writes the server refuses (`assertMayWrite`).
 *
 * So the sheet opens, and it is frozen. `readOnly` suppresses every edit
 * affordance, and the store behind it is the one from `frozenSheet.ts`, which
 * holds this single entity and throws on any write. There is no path from here
 * to a mutation, which is what makes the surface honest rather than merely
 * discouraging.
 *
 * ## Nothing is cached locally
 *
 * The row is read straight from `entities.listForGame` and parsed. It is
 * deliberately NOT adopted into IndexedDB: a crewmate's pilot in the viewer's
 * own stores would show up among their builds, under a container they do not
 * control, and would go stale the moment its owner touched it. Reading is not
 * owning.
 *
 * The trade is a round trip — this re-queries the game listing rather than
 * reading a local copy — which is the correct cost for a surface you visit to
 * look something up.
 */

import { Card, Text } from 'component-lib'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import type { RosterKind } from '../../lib/games/gameRoster'
import { AppLink } from '../shared/AppLink'
import { makeFrozenStore, parseFrozenEntity } from '../sheet/frozenSheet'
import { Sheet } from '../sheet/Sheet'
import { PAGE, TITLE } from './gameChrome'

type GameEntitySheetProps = {
  gameId: string
  kind: RosterKind
  /** The Convex row id — what the crew roster addresses every row by. */
  entityId: string
}

/** A framed message with the way back to the crew, for every state but success. */
export function GameSheetNotice({
  gameId,
  children,
}: {
  gameId: string
  children: React.ReactNode
}) {
  return (
    <main className={PAGE}>
      <Text as="h1" className={TITLE}>
        Crew sheet
      </Text>
      <Card>
        <div className="flex flex-col items-start gap-3 p-4">
          <Text>{children}</Text>
          <AppLink href={`/games/${gameId}`} className="font-cond text-sm font-bold uppercase">
            ← Back to the crew
          </AppLink>
        </div>
      </Card>
    </main>
  )
}

function GameEntityBody({ gameId, kind, entityId }: GameEntitySheetProps) {
  // The same query the roster uses, so this surface is governed by exactly the
  // membership check that decides whether the row was listable in the first
  // place — a non-member gets `null` here for the same reason they get an empty
  // roster, with no second permission rule to drift from the first.
  const listing = useQuery(api.entities.listForGame, { gameId: gameId as Id<'games'> })

  const row = useMemo(() => {
    if (listing === undefined) return undefined
    const rows =
      kind === 'pilot' ? listing.pilots : kind === 'mech' ? listing.mechs : listing.crawlers
    return rows.find((r) => r._id === entityId) ?? null
  }, [listing, kind, entityId])

  const parsed = useMemo(
    () => (row === undefined || row === null ? null : parseFrozenEntity(kind, row.body)),
    [row, kind]
  )
  const store = useMemo(() => (parsed?.ok ? makeFrozenStore(parsed) : null), [parsed])

  if (listing === undefined) {
    return <GameSheetNotice gameId={gameId}>Loading this sheet…</GameSheetNotice>
  }

  if (row === null) {
    // Covers "not in this game", "no such entity", and "it was scrapped"
    // identically — a non-member must not be able to tell them apart.
    return (
      <GameSheetNotice gameId={gameId}>
        That {kind} is not in this game. It may have been removed, or you may no longer be a member.
      </GameSheetNotice>
    )
  }

  if (parsed === null || !parsed.ok || store === null) {
    return (
      <GameSheetNotice gameId={gameId}>
        This {kind}&rsquo;s data doesn&rsquo;t match anything this app knows how to show. It may
        have been built in a newer version.
      </GameSheetNotice>
    )
  }

  return (
    <div>
      {/* The read-only banner, in the same shape the snapshot surface uses.
          Saying WHY it is read-only matters more than saying that it is: a
          player who cannot edit a crewmate's pilot should understand that as
          the rule of the table, not as something broken. */}
      <div
        role="note"
        aria-label="Read-only crew sheet"
        className="border-b-2 border-ink bg-caution px-4 py-2 font-body text-sm font-semibold text-ink sm:px-[30px]"
      >
        You are reading a crewmate&rsquo;s sheet. Only whoever holds it can make changes.
      </div>

      <Sheet
        kind={parsed.kind}
        id={parsed.entity.id}
        store={store}
        back={{ href: `/games/${gameId}`, label: 'the crew' }}
        readOnly
      />
    </div>
  )
}

export function GameEntitySheet(props: GameEntitySheetProps) {
  const { mode } = useConnection()

  if (!isConvexConfigured || mode !== 'connected') {
    return (
      <GameSheetNotice gameId={props.gameId}>
        A Game is shared state, so reading a crewmate&rsquo;s sheet needs a connected account.
      </GameSheetNotice>
    )
  }

  return <GameEntityBody {...props} />
}
