/**
 * ContainerSwitcher — the Game page's Games select (ADR-030 §2), on
 * `ContainerPicker`'s `select` variant.
 *
 * It lists **Shelves** (everything you keep, at `/`), then every
 * Game the player is in, and picking one goes there; its last entry,
 * **+ New Game**, opens the New Game dialog (`NewGameDialog`) and leaves the
 * select on the Game it shows. Shelves itself has its
 * own Showing toggle (Everything | Unassigned) instead. The masthead's Games
 * menu (`GamesMenu`) makes the same choice from every other route.
 *
 * ## It renders nothing in Solo
 *
 * Games require an account. Somebody who is not signed in has no builds and no
 * container to switch to, so a select would be furniture that never does
 * anything. `ConnectedContainerSwitcher` holds the Convex read and mounts
 * only once the mode is Connected, so no query runs signed out.
 */

import type { Container } from 'game-domain/container'
import { SHELF } from 'game-domain/container'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { NewGameDialog } from '../games/NewGameControl'
import type { ContainerChoice } from './ContainerPicker'
import { ContainerPicker } from './ContainerPicker'

/** Its height steps down from `sm` (`.su-container-select`, styles/controls.css). */
const SELECT = { width: '200px' } satisfies CSSProperties

type ContainerSwitcherProps = {
  activeContainer: Container
  onSelect: (container: Container) => void
}

function ConnectedContainerSwitcher({ activeContainer, onSelect }: ContainerSwitcherProps) {
  const games = useQuery(api.games.listMine)
  const [creating, setCreating] = useState(false)

  // `games` is undefined while the subscription is in flight. The current
  // selection must still have a matching option or the select would render
  // blank, so the Games are simply absent until they load — at which point the
  // value re-matches on its own. "+ New Game" acts, so the select stays on the
  // Game it shows.
  const choices: ContainerChoice[] = [
    { container: SHELF, label: 'Hangar' },
    ...(games ?? []).map((game) => ({
      container: { kind: 'game', gameId: game._id } as const,
      label: game.name,
    })),
  ]

  return (
    <>
      <ContainerPicker
        variant="select"
        id="container-switcher"
        label="Games"
        value={activeContainer}
        choices={choices}
        onPick={(choice) => onSelect(choice.container)}
        actions={[{ id: 'new-game', label: '+ New Game', onSelect: () => setCreating(true) }]}
        className="su-container-select"
        style={SELECT}
      />
      <NewGameDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

export function ContainerSwitcher(props: ContainerSwitcherProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedContainerSwitcher {...props} />
}
