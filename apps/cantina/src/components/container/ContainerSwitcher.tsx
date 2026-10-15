/**
 * ContainerSwitcher — the Game page's "Showing" select (ADR-030 §2).
 *
 * It lists **Shelves** (everything you keep, at `/`), then every
 * Game the player is in, and picking one goes there. Shelves itself has its
 * own Showing toggle (Everything | Not in a Game) instead. The masthead's Games
 * menu (`GamesMenu`) makes the same choice from every other route.
 *
 * ## It renders nothing in Solo
 *
 * Games require an account. Somebody who is not signed in has no builds and no
 * container to switch to, so a select would be furniture that never does
 * anything. `ConnectedContainerSwitcher` holds the Convex read and mounts
 * only once the mode is Connected, so no query runs signed out.
 */

import type { Container } from 'cantina-domain/container'
import { Select } from 'component-lib'
import { color, font, fontSize, space, tracking, weight } from 'component-lib/design/tokens'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'

const SHELF_VALUE = 'shelf'

const ROW = { alignItems: 'center', display: 'flex', gap: space[8] } satisfies CSSProperties

// Paper: the select sits on the Game page's band (`GameBand`), whose
// controls are paper on the deeper crawler pink.
const LABEL = {
  color: color.paper,
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.semibold,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** Its height steps down from `sm` (`.su-container-select`, styles/controls.css). */
const SELECT = { width: '200px' } satisfies CSSProperties

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
    <div style={ROW}>
      <label htmlFor="container-switcher" style={LABEL}>
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
        className="su-container-select"
        style={SELECT}
      >
        <option value={SHELF_VALUE}>Hangar</option>
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
