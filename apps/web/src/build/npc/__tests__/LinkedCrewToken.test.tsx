/**
 * LinkedCrewToken — a bay's crew slot filled by a built NPC, inside the bay
 * card (Q2, ADR-044): the NPC as a contentful Token, stamped User-made, its
 * head a link to its sheet; an NPC this view cannot read falls back to the
 * inline crew under a badge, never a blank slot.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { CrewAssignment } from '../../../lib/npcs/npcModel'
import { npcFixture, softLinkFixture } from '../../../components/__tests__/fixtures'
import { LinkedCrewToken } from '../LinkedCrewToken'

const DOC = npcFixture({
  id: 'n1',
  name: 'Doc Ambrose',
  position: 'Doc',
  hitPoints: 4,
  motto: 'Bleed later.',
})

function assignment(npc: CrewAssignment['npc']): CrewAssignment {
  return {
    link: softLinkFixture('npc-to-crawler', 'n1', 'c1'),
    slot: { kind: 'bay', bayRef: 'med-bay' },
    npcId: 'n1',
    npc,
  }
}

describe('LinkedCrewToken', () => {
  test('a readable NPC is its crew-lead Token, stamped User-made, linking to its sheet', () => {
    render(
      <LinkedCrewToken
        slotName="Med Bay"
        assignment={assignment(DOC)}
        fallback={<span>inline crew</span>}
      />
    )
    expect(screen.getByText('User-made crew')).toBeTruthy()
    const lead = screen.getByRole('group', { name: 'Med Bay crew lead' })
    expect(lead.querySelector('.su-entity-token[data-contentful]')).toBeTruthy()
    expect(within(lead).getByText('Bleed later.')).toBeTruthy()
    expect(within(lead).getByText('4/4')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Doc Ambrose' }).getAttribute('href')).toBe(
      '/sheet/npc/n1'
    )
    expect(screen.queryByText('inline crew')).toBeNull()
  })

  test('read-only: no field edits the linked NPC from the bay', () => {
    render(
      <LinkedCrewToken
        slotName="Med Bay"
        assignment={assignment(DOC)}
        fallback={<span>inline crew</span>}
      />
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  test('an NPC this view cannot read shows the inline crew under a badge', () => {
    render(
      <LinkedCrewToken
        slotName="Med Bay"
        assignment={assignment(null)}
        fallback={<span>inline crew</span>}
      />
    )
    expect(screen.getByText('Assigned NPC unavailable')).toBeTruthy()
    expect(screen.getByText('inline crew')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
