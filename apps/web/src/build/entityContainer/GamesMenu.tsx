/**
 * Play's Games menu (ADR-052 §6), on `ContainerPicker`'s `menu` and `list`
 * variants.
 *
 * Every Game the player is in, each with their role in it. Picking one opens
 * the Game's page in Play (`playGamePath`). It is Play's nav's first entry;
 * Build has none, since a Game is never a place inside Build (ADR-052 §1).
 *
 * Two renderings of one list, because the masthead has two shapes:
 *
 * - `GamesMenu` — a `HeaderMenu` dropdown in Play's desktop nav, before Solo.
 * - `GamesDrawerList` — a list of buttons inside the mobile nav drawer. The mobile
 *   header row has room for the avatar beside the hamburger and no more, so the
 *   list moves into the drawer, and picking a row closes it.
 *
 * ## Connected only
 *
 * Games need the server of record: a Solo user has no Games, and a
 * Disconnected one cannot list theirs. The Convex
 * read lives in a child that is only mounted once the mode is Connected, so its
 * hook always has a provider.
 */

import type { LinkProps } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { playGamePath } from '../../lib/barLinks'
import { useConnection } from '../../lib/connection/connectionContext'
import { Badge, tokens } from '../../components/index'
import type { ContainerChoice } from './ContainerPicker'
import { ContainerPicker } from './ContainerPicker'

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

/** Open a picked Game's page in Play. */
function useOpenGame(): (choice: ContainerChoice) => void {
  const navigate = useNavigate()
  return ({ container }) => {
    if (container.kind !== 'game') return
    void navigate({ to: playGamePath(container.gameId) as LinkProps['to'] })
  }
}

function ConnectedGamesMenu({ active }: { active: boolean }) {
  const games = useGameEntries()
  const open = useOpenGame()

  return (
    <ContainerPicker
      variant="menu"
      trigger="Games"
      active={active}
      choices={games}
      onPick={open}
      loading="your Games"
      empty="No Games yet"
    />
  )
}

/** `active`: the page is Play's hub or a Game's (`unionHere`), so the menu is where you are. */
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
  const open = useOpenGame()

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
          open(choice)
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
