import { Avatar } from 'component-lib'
import { color, space } from 'component-lib/design/tokens'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { HeaderMenu } from './HeaderMenu'
// The app loads this through index.css; the catalog loads only the library's.
import '../../styles/headerMenu.css'

export default {
  title: 'Compositions/Shell/Header Menu',
}

/** Real crawler names standing in for Game names; a pilot class for the player. */
const crawlers = SalvageUnionReference.Crawlers.all()
  .slice(0, 2)
  .map((c) => c.name)
const player = SalvageUnionReference.Classes.all()[0]?.name ?? 'Salvager'

// The dark masthead strip both menus live on, right-aligned like AppBar's nav.
const MASTHEAD = {
  alignItems: 'center',
  backgroundColor: color.inkDeep,
  display: 'flex',
  gap: space[24],
  justifyContent: 'flex-end',
  padding: space[16],
} satisfies CSSProperties

const NAME = { textTransform: 'none' } satisfies CSSProperties

/**
 * HeaderMenu — the masthead's dropdown, as ITUN uses it: a "Games" menu
 * (the personal shelf, then each Game with the player's role) and an account
 * menu whose trigger is the player's avatar and name. Rows are data, so the
 * app supplies what each one does; the Games menu opens itself on mount by
 * pressing its own trigger, the path a player takes.
 */
export const Default: Story = () => {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click()
  }, [])

  return (
    <div>
      <Caption>Games menu · account menu · avatar-only (mobile)</Caption>
      <div ref={frameRef} style={MASTHEAD}>
        <HeaderMenu
          trigger="Games"
          sections={[
            [{ id: 'shelf', label: 'Shelves', onSelect: () => {} }],
            crawlers.map((name, i) => ({
              id: name,
              label: name,
              hint: i === 0 ? 'Mediator' : 'Player',
              onSelect: () => {},
            })),
          ]}
        />
        <HeaderMenu
          label={`Account menu for ${player}`}
          trigger={
            <>
              <Avatar name={player} />
              <span style={NAME}>{player}</span>
            </>
          }
          sections={[
            [
              { id: 'settings', label: 'Settings', onSelect: () => {} },
              { id: 'sign-out', label: 'Sign out', onSelect: () => {} },
            ],
          ]}
        />
        <HeaderMenu
          label={`Account menu for ${player}`}
          chevron={false}
          trigger={<Avatar name={player} size={32} />}
          sections={[
            [
              { id: 'settings', label: 'Settings', onSelect: () => {} },
              { id: 'sign-out', label: 'Sign out', onSelect: () => {} },
            ],
          ]}
        />
      </div>
    </div>
  )
}
