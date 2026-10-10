import { tokens } from 'component-lib'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { chassisFact, crawlerFact, kicker, pilotFact } from '../../lib/shelves/shelfItems'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from '../../lib/starterSet/starterSet'
import { ShelfItem } from './ShelfItem'

export default {
  title: 'Compositions/Catalog/Shelf Item',
}

// The Starter Set's own builds (Leyline Press's pre-generated crew), so every
// name, class and chassis is the book's.
const bonesaw = STARTER_PILOTS[0]
const scrapper = STARTER_MECHS[0]
const tenacity = STARTER_CRAWLERS[0]
// A pattern the book prints for that chassis, standing in for a player's.
const bookPattern = scrapper
  ? resolveChassisRef(scrapper.chassisRef)?.patterns?.[0]?.name
  : undefined

const PAGE = {
  backgroundColor: tokens.color.wkBg,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  maxWidth: '36rem',
  padding: tokens.space[20],
} satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const MENU = [
  [
    { id: 'open', label: 'Open', onSelect: () => {} },
    { id: 'move', label: 'Move to a Game…', onSelect: () => {} },
    { id: 'copy', label: 'Make a copy', onSelect: () => {} },
    { id: 'export', label: 'Export', onSelect: () => {} },
  ],
  [{ id: 'delete', label: 'Delete…', tone: 'danger' as const, onSelect: () => {} }],
]

/**
 * A shelf item (Shelves, board S1): the one-line card — the unit's tone, an
 * ink stamp with its kind and what it is, the name and one reading — the chips
 * under it, and its ⋯ menu. A pattern is user-made, so dashed and quoted.
 */
export const Default: Story = () => (
  <div style={PAGE}>
    <Caption>pilot · mech · crawler (solid, canon-built) · pattern (user-made, dashed)</Caption>
    <ul style={LIST}>
      <ShelfItem
        kind="pilot"
        kicker={kicker('Pilot', bonesaw ? pilotFact(bonesaw) : undefined)}
        name={bonesaw?.name ?? 'Bonesaw'}
        reading={{ label: 'HP', value: '8/10' }}
        href="#/sheet/pilot/bonesaw"
        chips={[
          { key: 'where', label: 'Reclamation of the Wastes' },
          { key: 'linked', label: `Linked: ${scrapper?.name ?? 'Scrapper'}` },
          { key: 'origin', label: 'Copied from the Starter Set' },
        ]}
        menu={MENU}
      />
      <ShelfItem
        kind="mech"
        kicker={kicker('Mech', scrapper ? chassisFact(scrapper.chassisRef) : undefined)}
        name={scrapper?.name ?? 'Scrapper'}
        reading={{ label: 'SP', value: '7/9' }}
        href="#/sheet/mech/scrapper"
        chips={[
          { key: 'where', label: 'Reclamation of the Wastes' },
          { key: 'linked', label: `Pilot: ${bonesaw?.name ?? 'Bonesaw'}` },
        ]}
        menu={MENU}
      />
      <ShelfItem
        kind="crawler"
        kicker={kicker('Crawler', tenacity ? crawlerFact(tenacity) : undefined)}
        name={tenacity?.name ?? 'Tenacity'}
        reading={{ label: 'TL', value: '1' }}
        href="#/sheet/crawler/tenacity"
        chips={[
          { key: 'where', label: 'Reclamation of the Wastes' },
          { key: 'role', label: 'You mediate' },
        ]}
        menu={MENU}
      />
      <ShelfItem
        kind="pattern"
        kicker={kicker('Pattern', scrapper ? chassisFact(scrapper.chassisRef) : undefined)}
        name={bookPattern ?? 'Scrapper'}
        reading={{ label: 'SYS', value: '12/12' }}
        href="#/p/pattern/scrapper"
        userMade
        chips={[
          { key: 'who', label: 'Shared by link' },
          { key: 'built', label: 'Built twice' },
        ]}
        menu={MENU}
      />
    </ul>
  </div>
)
