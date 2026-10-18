/**
 * The masthead's Games menu — pick what the Roster shows (ADR-030 §2), on
 * `ContainerPicker`'s `menu` and `list` variants.
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
 * - `GamesDrawerList` — a list of buttons inside the mobile nav drawer. The mobile
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

import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { Badge, tokens } from '../../components/index'
import type { ContainerChoice } from './ContainerPicker'
import { ContainerPicker } from './ContainerPicker'
import { useShowContainer } from './useShowContainer'

/**
 * The Games, as rows — `undefined` while the subscription is in flight.
 *
 * The role is the base one only. Organizer is a modifier on top of it
 * (ADR-030), and a menu row is a place to recognise a Game, not to read its
 * whole membership.
 */
function useGameEntries(): ContainerChoice[] | undefined {
  const games = useQuery(api.games.listMine, {})
  return games?.map((game) => ({
    label: game.name,
    hint: game.mediator ? 'Mediator' : 'Player',
    container: { kind: 'game', gameId: game._id },
  }))
}

function ConnectedGamesMenu({ active }: { active: boolean }) {
  const games = useGameEntries()
  const pick = useShowContainer()

  return (
    <ContainerPicker
      variant="menu"
      trigger="Games"
      active={active}
      choices={games}
      onPick={(choice) => pick(choice.container)}
      loading="Loading your Games…"
      empty="No Games yet"
    />
  )
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

function ConnectedGamesDrawerList({ onPick }: { onPick: () => void }) {
  const games = useGameEntries()
  const pick = useShowContainer()

  return (
    <nav aria-label="Games" style={LIST}>
      <div>
        <Badge shape="stamp">Games</Badge>
      </div>
      <ContainerPicker
        variant="list"
        label="Your Games"
        choices={games}
        onPick={(choice) => {
          pick(choice.container)
          onPick()
        }}
        loading="your Games"
        empty="No Games yet"
      />
    </nav>
  )
}

/** The Games list for the mobile nav drawer; `onPick` closes the drawer. */
export function GamesDrawerList({ onPick }: { onPick: () => void }) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedGamesDrawerList onPick={onPick} />
}
