import { afterEach, describe, expect, test } from 'bun:test'
import { revealWikiLinks, rollWikiLink, WIKI_LINK_ATTRIBUTE, WIKI_LINK_ODDS } from '../wikiLink'

describe('rollWikiLink', () => {
  test('shows the link one page load in a hundred', () => {
    expect(WIKI_LINK_ODDS).toBe(100)
    expect(rollWikiLink(() => 0)).toBe(true)
    expect(rollWikiLink(() => 0.0099)).toBe(true)
    expect(rollWikiLink(() => 0.01)).toBe(false)
    expect(rollWikiLink(() => 0.5)).toBe(false)
  })
})

describe('revealWikiLinks', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function serveBar(): HTMLElement[] {
    document.body.innerHTML = `<a href="/greembeem" hidden ${WIKI_LINK_ATTRIBUTE}>WIKI</a><a href="/greembeem" hidden ${WIKI_LINK_ATTRIBUTE}>WIKI</a>`
    return [...document.querySelectorAll<HTMLElement>(`[${WIKI_LINK_ATTRIBUTE}]`)]
  }

  test('on the one load in a hundred, shows both copies together', () => {
    const links = serveBar()
    expect(revealWikiLinks(document, () => 0)).toBe(true)
    expect(links.map((link) => link.hidden)).toEqual([false, false])
  })

  test('every other load leaves them hidden', () => {
    const links = serveBar()
    expect(revealWikiLinks(document, () => 0.5)).toBe(false)
    expect(links.map((link) => link.hidden)).toEqual([true, true])
  })
})
