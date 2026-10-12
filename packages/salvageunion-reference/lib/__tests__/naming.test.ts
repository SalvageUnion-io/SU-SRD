import { describe, expect, it } from 'bun:test'
import { displayTitle } from '../naming'

describe('displayTitle', () => {
  it('title-cases a lower-case glossary name, hyphenated words too', () => {
    expect(displayTitle('bio-titan')).toBe('Bio-Titan')
    expect(displayTitle('mount / dismount')).toBe('Mount / Dismount')
  })

  it('leaves a name that already carries a capital as printed', () => {
    expect(displayTitle('Mule')).toBe('Mule')
    expect(displayTitle('NPCs')).toBe('NPCs')
  })
})
