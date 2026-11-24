/**
 * A class Page's "On this page" on a desktop's band (`PageContentsMenu`): one
 * button that opens the Page's sections as the browser's popover, so it works
 * with no script, and every entry is the same anchor the Page's own line
 * links (`ClassContents`). A Page with one section, or none, draws no menu.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { classContentsFor } from '../../components/classContents.model'
import { PAGE_CONTENTS_MENU_ID } from '../../runtime/pageContentsMenuId'
import { PageContentsMenu } from '../PageContentsMenu'

const named = (name: string): RefEntity => {
  const found = SalvageUnionReference.Classes.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found as RefEntity
}

const parse = (html: string) => {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('classContentsFor', () => {
  test("a class's sections start at Training and name its trees", () => {
    const entries = classContentsFor(named('Hacker')) ?? []
    expect(entries[0]?.href).toBe('training')
    expect(entries.length).toBeGreaterThan(2)
    expect(new Set(entries.map((entry) => entry.href)).size).toBe(entries.length)
  })

  test('an entity that is no class has none', () => {
    const trait = SalvageUnionReference.Traits.getByName('Explosive')
    if (!trait) throw new Error('fixture missing: Explosive')
    expect(classContentsFor(trait as RefEntity)).toBeUndefined()
  })
})

describe('PageContentsMenu', () => {
  test('its button opens a popover menu of the Page’s section links', () => {
    const entries = classContentsFor(named('Hacker')) ?? []
    const root = parse(renderToStaticMarkup(<PageContentsMenu entries={entries} />))
    const button = root.querySelector('button')
    expect(button?.getAttribute('popovertarget')).toBe(PAGE_CONTENTS_MENU_ID)
    const menu = root.querySelector(`#${PAGE_CONTENTS_MENU_ID}`)
    expect(menu?.tagName).toBe('NAV')
    expect(menu?.getAttribute('popover')).toBe('auto')
    expect(menu?.getAttribute('aria-label')).toBe('On this page')
    const hrefs = Array.from(menu?.querySelectorAll('a') ?? [], (a) => a.getAttribute('href'))
    expect(hrefs).toEqual(entries.map((entry) => `#${entry.href}`))
  })

  test('one section, or none, draws no menu', () => {
    expect(renderToStaticMarkup(<PageContentsMenu entries={[]} />)).toBe('')
    expect(
      renderToStaticMarkup(<PageContentsMenu entries={[{ href: 'training', label: 'Training' }]} />)
    ).toBe('')
  })
})
