import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { STARTER_CRAWLERS, STARTER_MECHS } from '../../lib/starterSet/starterSet'
import { LinkedUnitLink } from './LinkedUnitLink'
import { SheetModeToggle } from './SheetModeToggle'

export default {
  title: 'Compositions/Sheet Read State',
}

const STACK = {
  backgroundColor: tokens.color.wkBg,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
  maxWidth: '20rem',
  padding: tokens.space[16],
} satisfies CSSProperties

const scrapper = STARTER_MECHS[0]
const tenacity = STARTER_CRAWLERS[0]

/**
 * The sheet's read state (board 10, issue 1255): the band's Read | Edit, and a
 * linked unit as one line — the listing card's anatomy at its smallest, which
 * opens that unit's sheet. Edit keeps the full rows with Assign and Unassign.
 * Data from the Starter Set.
 */
export const Default = () => {
  const [editing, setEditing] = useState(false)
  return (
    <div style={STACK}>
      <div>
        <Caption>Read | Edit — the state you are in is the ink plate</Caption>
        <SheetModeToggle mode={{ editing, setEditing }} kind="pilot" />
      </div>
      <div>
        <Caption>Linked units, one line each</Caption>
        <LinkedUnitLink
          kind="mech"
          name={scrapper?.name ?? 'Scrapper'}
          href="#mech"
          stats={[{ label: 'SP', value: '9/9' }]}
        />
        <LinkedUnitLink
          kind="crawler"
          name={tenacity?.name ?? '#430 Tenacity'}
          href="#crawler"
          stats={[{ label: 'SP', value: '20/20' }]}
        />
      </div>
    </div>
  )
}
