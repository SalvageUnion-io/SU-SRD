/**
 * A document page's endpoint or command (`/api`, `/discord`) is a titled
 * block, so a TitledBox: its name a cut-out on its band, its stamps beside
 * it, its prose in the paper body under it, never a ruled strip (hard rule R42).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DocPanel } from '../DocPanel'

describe('DocPanel', () => {
  test("its name is the head's cut-out, its stamps beside it, its prose in the body", () => {
    const { container } = render(
      <DocPanel title="GET /schema/" chips={<span>GET</span>}>
        <p>Every schema.</p>
      </DocPanel>
    )
    const box = container.querySelector('section.su-box')
    const cut = box?.querySelector('.su-entity-compact__head .su-entity-compact__heading--cut')
    expect(cut?.querySelector('h3')?.textContent).toBe('GET /schema/')
    expect(cut?.querySelector('[data-chip-group]')?.textContent).toBe('GET')
    expect(box?.querySelector('.su-box__body')?.textContent).toBe('Every schema.')
  })
})
