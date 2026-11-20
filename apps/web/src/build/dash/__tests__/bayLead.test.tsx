/**
 * A crawler bay's crew lead on the dashboard: their name, then their post,
 * which Peeks the book's crew NPC for the bay on a press.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { LeadCell } from '../bayLead'
import { leadOf } from '../bayLead.model'

const LEAD = { name: 'Cara Voss', position: 'Princeps', hp: '', keepsake: '', motto: '' }

describe('the crew lead cell', () => {
  test('names the lead, and their post Peeks the bay’s NPC', () => {
    render(<LeadCell lead={LEAD} peekAt="crawler-bays:abc/npc" />)
    expect(screen.getByText('Cara Voss')).toBeTruthy()
    const post = screen.getByRole('button')
    expect(post.getAttribute('data-peek')).toBe('crawler-bays:abc/npc')
    expect(post.hasAttribute('data-peek-press')).toBe(true)
  })

  test('with no NPC to Peek, the post is words', () => {
    render(<LeadCell lead={LEAD} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('an unnamed lead is their post alone', () => {
    render(<LeadCell lead={{ ...LEAD, name: '' }} peekAt="crawler-bays:abc/npc" />)
    expect(screen.getByRole('button').textContent).toContain('Princeps')
  })
})

describe('leadOf', () => {
  test('reads what the sheet wrote when no NPC is built', () => {
    const lead = leadOf(undefined, { npcName: ' Blaze ' } as never, undefined, undefined)
    expect(lead).toEqual({ name: 'Blaze', position: '', hp: '', keepsake: '', motto: '' })
  })
})
