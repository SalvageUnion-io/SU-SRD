/**
 * ContainerSwitcher — the hub's "Showing" select (ADR-030 §2).
 *
 * `/` shows one container at a time, and this picks it: **My stuff** (the
 * owner's personal shelf — that is the player's name for it), then every Game
 * the player is in. Picking a Game is how you get to it; there is no Games
 * page. The masthead's Games menu (`GamesMenu`) makes the same choice from
 * every other route.
 *
 * ## It renders nothing in Solo
 *
 * Games require an account. Somebody who is not signed in has one pile of
 * builds and no second container to switch to, so offering a one-option select
 * would be furniture that never does anything. Surfaces show that whole pile
 * unfiltered — which is also the only rendering that cannot hide a build (see
 * `stores/activeContainerStore.ts` on the v13 phantom-container ids).
 *
 * ## Why the Convex read lives in a child
 *
 * `useQuery` needs a `ConvexProvider` above it and a Solo build deliberately
 * has none, so the branch is made at the *component* level rather than with a
 * conditional hook — the same shape `SignInControl` and `ConnectionProvider`
 * use. `ConnectedContainerSwitcher` is only ever mounted once the mode is
 * known to be Connected, so its hook always has a provider.
 */

import { Select } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { Container } from '../../lib/container'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'

const SHELF_VALUE = 'shelf'

type ContainerSwitcherProps = {
  activeContainer: Container
  onSelect: (container: Container) => void
}

function ConnectedContainerSwitcher({ activeContainer, onSelect }: ContainerSwitcherProps) {
  const games = useQuery(api.games.listMine)

  // Option values ARE the serialized form, so the same parser the store
  // persists through decodes them — one encoding, defined in one place.
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onSelect(parseContainer(e.target.value))
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="container-switcher"
        className="font-cond text-caption font-semibold uppercase tracking-caps-tight text-ink"
      >
        Showing
      </label>
      {/* Faux-select (design-spec §2.5): the shared `Select` chevron rung — the
          same control the Workspace switcher used, so the header row keeps its
          existing weight and alignment. */}
      <Select
        chevron
        id="container-switcher"
        value={serializeContainer(activeContainer)}
        onChange={handleChange}
        className="w-[200px] sm:min-h-9"
      >
        <option value={SHELF_VALUE}>My stuff</option>
        {/* `games` is undefined while the subscription is in flight. The
            current selection must still have a matching option or the select
            would render blank, so the group is simply absent until it loads —
            at which point the value re-matches on its own. */}
        {games !== undefined && games.length > 0 && (
          <optgroup label="Games">
            {games.map((game) => (
              <option key={game._id} value={`game:${game._id}`}>
                {game.name}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
    </div>
  )
}

export function ContainerSwitcher(props: ContainerSwitcherProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedContainerSwitcher {...props} />
}
