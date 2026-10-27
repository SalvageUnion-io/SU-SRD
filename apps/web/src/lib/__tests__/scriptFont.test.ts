import { describe, expect, test } from 'bun:test'
import { isFrontDoor, preloadScriptFont, scriptFace } from '../scriptFont'

const STACK = "'Caveat-1a2b', cursive"

function fakeFonts(result: Promise<FontFace[]> = Promise.resolve([])) {
  const asked: string[] = []
  return {
    asked,
    fonts: {
      load: (font: string) => {
        asked.push(font)
        return result
      },
    },
  }
}

describe('isFrontDoor', () => {
  test('is the base path, with or without its trailing slash', () => {
    expect(isFrontDoor('/build', '/build')).toBe(true)
    expect(isFrontDoor('/build/', '/build')).toBe(true)
  })

  test('is no other page', () => {
    expect(isFrontDoor('/build/starter', '/build')).toBe(false)
    expect(isFrontDoor('/build/pilots/x', '/build')).toBe(false)
    expect(isFrontDoor('/', '/build')).toBe(false)
  })

  test('is `/` when the app is served from the root', () => {
    expect(isFrontDoor('/', '')).toBe(true)
    expect(isFrontDoor('/starter', '')).toBe(false)
  })
})

describe('preloadScriptFont', () => {
  test("asks for the quote's face on the front door", () => {
    const { asked, fonts } = fakeFonts()
    preloadScriptFont('/build/', '/build', fonts, STACK)
    expect(asked).toEqual([scriptFace(STACK)])
  })

  test('asks for nothing on any other page', () => {
    const { asked, fonts } = fakeFonts()
    preloadScriptFont('/build/starter', '/build', fonts, STACK)
    expect(asked).toEqual([])
  })

  test('asks for nothing before the stack is declared', () => {
    const { asked, fonts } = fakeFonts()
    preloadScriptFont('/build/', '/build', fonts, '')
    expect(asked).toEqual([])
  })

  test('does nothing without a font set', () => {
    expect(() => preloadScriptFont('/build/', '/build', undefined, STACK)).not.toThrow()
  })

  test('swallows a failed load', async () => {
    const { fonts } = fakeFonts(Promise.reject(new Error('offline')))
    preloadScriptFont('/build/', '/build', fonts, STACK)
    // An unhandled rejection would fail the test run.
    await Bun.sleep(0)
  })
})
