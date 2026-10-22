/**
 * The Starter Set landing (`/starter`): every line of every booklet's map
 * reaches a page, at the page the booklet prints it. A line is dropped when
 * the dataset loses its entry or its Starter Set citation, so a rename would
 * quietly shorten a map; these tests make it loud.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { starterPage } from '../pages/starter.page'

function landing() {
  const result = starterPage.page({ params: {}, props: {} } as never)
  return { ...result, ...render(result.children as ReactElement) }
}

/** Each map's rows, by the map's id. */
function rowsOf(container: HTMLElement, id: string) {
  return [...container.querySelectorAll(`#${id} .su-contents__row`)].map((row) => ({
    label: row.querySelector('span')?.textContent,
    href: row.getAttribute('href'),
    page: row.querySelector('.su-contents__count')?.textContent,
  }))
}

describe('the Starter Set landing', () => {
  test('maps every line it declares, none dropped', () => {
    const { container } = landing()
    expect(rowsOf(container, 'first-session')).toHaveLength(10)
    expect(rowsOf(container, 'pilots-handbook')).toHaveLength(15)
    expect(rowsOf(container, 'union-crawler')).toHaveLength(8)
    expect(rowsOf(container, 'parts-catalogue')).toHaveLength(7)
    expect(rowsOf(container, 'core-rulebook')).toHaveLength(18)
  })

  test('an entry cites the page its booklet prints it on', () => {
    const { container } = landing()
    const classes = rowsOf(container, 'pilots-handbook')
    expect(classes.find((r) => r.label === 'Engineer')).toEqual({
      label: 'Engineer',
      href: '/classes/engineer/',
      page: 'p.12',
    })
    // The first session mixes booklets, so it names each, as the campaign book does.
    expect(rowsOf(container, 'first-session')[0]?.page).toBe('p.14 CR')
  })

  test('a whole catalog opens filtered to the box, reprints included', () => {
    const { container } = landing()
    const systems = rowsOf(container, 'parts-catalogue').find((r) => r.label === 'Mech Systems')
    expect(systems?.href).toBe('/systems/?source=Salvage+Union+Starter+Set')
  })

  test('the steps open the crew, the one-tap copy, and the first session', () => {
    const { container } = landing()
    const steps = [...container.querySelectorAll('.su-start-here__step')].map((a) =>
      a.getAttribute('href')
    )
    expect(steps).toEqual(['/build/starter', '/build/starter?copy=crew', '#first-session'])
  })
})
