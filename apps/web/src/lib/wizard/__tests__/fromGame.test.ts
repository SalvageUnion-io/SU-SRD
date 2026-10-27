import { describe, expect, test } from 'bun:test'
import { newInGameHref, parseGameParam } from '../fromGame'

/** `?game=` on a wizard: a Game room's id, or nothing. */
describe('parseGameParam', () => {
  test('keeps a Game room’s id', () => {
    const id = '3c802d02-7333-4e32-a43e-519c919fea87'
    expect(parseGameParam(id)).toBe(id)
  })

  test('drops anything else', () => {
    expect(parseGameParam(undefined)).toBeUndefined()
    expect(parseGameParam(42)).toBeUndefined()
    expect(parseGameParam('')).toBeUndefined()
    expect(parseGameParam('../admin')).toBeUndefined()
    expect(parseGameParam('g1?x=1')).toBeUndefined()
  })

  test('round-trips through the wizard link', () => {
    const id = '3c802d02-7333-4e32-a43e-519c919fea87'
    const href = newInGameHref('/pilots/new', id)
    expect(parseGameParam(new URL(href, 'https://x').searchParams.get('game'))).toBe(id)
  })
})
