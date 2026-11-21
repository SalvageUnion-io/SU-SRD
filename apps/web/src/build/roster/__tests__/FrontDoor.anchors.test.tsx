/**
 * SB-07, PT-22: signed out, Build's sub-nav links changed the address and
 * nothing else, because the front door held none of the ids they name.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { areaAnchors } from '../../../components/unionBar/areaNav.model'
import { BuildFrontDoor } from '../FrontDoor'

describe('Build’s front door', () => {
  test('holds the target of every in-page link in Build’s sub-nav', () => {
    const { container } = render(<BuildFrontDoor />)
    const anchors = areaAnchors('build')
    expect(anchors.length).toBeGreaterThan(0)
    for (const id of anchors) expect(container.querySelector(`[id="${id}"]`)).not.toBeNull()
  })
})
