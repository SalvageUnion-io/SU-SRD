import { describe, expect, test } from 'bun:test'
import { rollWikiLink, WIKI_LINK_ODDS } from '../WikiLinkIsland'

describe('rollWikiLink', () => {
  test('shows the link one page load in a hundred', () => {
    expect(WIKI_LINK_ODDS).toBe(100)
    expect(rollWikiLink(() => 0)).toBe(true)
    expect(rollWikiLink(() => 0.0099)).toBe(true)
    expect(rollWikiLink(() => 0.01)).toBe(false)
    expect(rollWikiLink(() => 0.5)).toBe(false)
  })
})
