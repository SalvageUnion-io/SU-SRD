/**
 * The masthead's Games menu — pick what the Roster shows (ADR-030 §2).
 *
 * Every Game the player is in, each with their role in it. Picking one opens
 * the Game's own page at `/games/$gameId`. Shelves is not listed: it has its
 * own nav link beside the menu. It is the same decision the Roster's own
 * "Showing" select (`ContainerSwitcher`) makes, offered from every route
 * rather than only from the Roster.
 *
 * Two renderings of one list, because the masthead has two shapes:
 *
 * - `GamesMenu` — a `HeaderMenu` dropdown in the desktop nav, after "Buy the
 *   game".
 * - `GamesDrawerList` — plain buttons inside the mobile nav drawer. The mobile
 *   header row has room for the avatar beside the hamburger and no more, so the
 *   list moves into the drawer, and picking a row closes it.
 *
 * ## Connected only
 *
 * Games need the server of record: a Solo user has no Games, and a
 * Disconnected one cannot list theirs. Like `ContainerSwitcher`, the Convex
 * read lives in a child that is only mounted once the mode is Connected, so its
 * hook always has a provider.
 */

import type { Container } from 'cantina-domain/container'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { HeaderMenuItem } from '../index'
import { Badge, Button, EmptyState, HeaderMenu, Pending, tokens } from '../index'
import { useShowContainer } from './useShowContainer'

/** One row of the list: what it says, and the container it picks. */
type Entry = { id: string; label: string; hint?: string; container: Container }

/**
 * The Games, as rows — `undefined` while the subscription is in flight.
 *
 * The role is the base one only. Organizer is a modifier on top of it
 * (ADR-030), and a menu row is a place to recognise a Game, not to read its
 * whole membership.
 */
function useGameEntries(): Entry[] | undefined {
  const games = useQuery(api.games.listMine, {})
  return games?.map((game) => ({
    id: game._id,
    label: game.name,
    hint: game.mediator ? 'Mediator' : 'Player',
    container: { kind: 'game', gameId: game._id },
  }))
}

function ConnectedGamesMenu({ active }: { active: boolean }) {
  const games = useGameEntries()
  const pick = useShowContainer()

  const asItem = (entry: Entry): HeaderMenuItem => ({
    id: entry.id,
    label: entry.label,
    hint: entry.hint,
    onSelect: () => pick(entry.container),
  })

  // A row without `onSelect` is an inert menuitem, so the empty and loading
  // states stay inside the menu a screen reader is walking.
  const gameItems: HeaderMenuItem[] =
    games === undefined
      ? [{ id: 'loading', label: 'Loading your Games…' }]
      : games.length === 0
        ? [{ id: 'none', label: 'No Games yet' }]
        : games.map(asItem)

  return <HeaderMenu trigger="Games" active={active} sections={[gameItems]} />
}

/** `active`: the page is a Game's own (`/games/…`), so the menu is where you are. */
export function GamesMenu({ active = false }: { active?: boolean }) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedGamesMenu active={active} />
}

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

// The drawer's nav-button shape (NavDrawer renders its links as full-width
// ghost buttons), with the label allowed to wrap: a Game name is the player's,
// and can be long.
const ROW = {
  display: 'block',
  textAlign: 'center',
  whiteSpace: 'normal',
  width: '100%',
} satisfies CSSProperties

const ROLE = {
  color: tokens.color.wkMuted,
} satisfies CSSProperties

function ConnectedGamesDrawerList({ onPick }: { onPick: () => void }) {
  const games = useGameEntries()
  const pick = useShowContainer()

  const row = (entry: Entry) => (
    <Button
      key={entry.id}
      variant="ghost"
      style={ROW}
      onClick={() => {
        pick(entry.container)
        onPick()
      }}
    >
      {entry.label}
      {entry.hint && <span style={ROLE}> · {entry.hint}</span>}
    </Button>
  )

  return (
    <nav aria-label="Games" style={LIST}>
      <div>
        <Badge shape="stamp">Games</Badge>
      </div>
      {games === undefined && <Pending label="your Games" />}
      {games?.length === 0 && <EmptyState variant="inline" body="No Games yet" />}
      {games?.map(row)}
    </nav>
  )
}

/** The Games list for the mobile nav drawer; `onPick` closes the drawer. */
export function GamesDrawerList({ onPick }: { onPick: () => void }) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedGamesDrawerList onPick={onPick} />
}
