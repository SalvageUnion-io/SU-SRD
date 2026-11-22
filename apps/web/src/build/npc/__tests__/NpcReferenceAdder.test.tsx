/**
 * The designer's action and trait search (r5 B11): a search that finds
 * nothing says so, and each action names the entry it is printed on.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ReferenceAdder } from '../NpcReferenceAdder'

async function search(text: string) {
  render(
    <ReferenceAdder carriedActions={[]} carriedTraits={[]} onAction={() => {}} onTrait={() => {}} />
  )
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText('Add an action or trait from the reference'), {
      target: { value: text },
    })
  })
}

describe('ReferenceAdder', () => {
  test('a search with no match says so', async () => {
    await search('zzqq')
    expect(screen.getByRole('status').textContent).toBe('No actions match')
  })

  test('an action says where it is printed', async () => {
    await search('pistol')
    const combat = screen.getByRole('button', { name: /Pistol \(Combat Pilot\)/ })
    expect(combat.textContent).toContain('Action · Combat Pilot')
  })
})
