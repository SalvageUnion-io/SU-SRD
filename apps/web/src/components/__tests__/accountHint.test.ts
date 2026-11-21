import { describe, expect, test } from 'bun:test'
import {
  ACCOUNT_HINT_KEY,
  clearAccountHint,
  LAST_GAME_KEY,
  readAccountHint,
  readLastGame,
  STORED_SESSION_KEY,
  writeAccountHint,
  writeLastGame,
} from '../../lib/accountHint'
import { markLastGame } from '../../lib/accountState'
import { SESSION_KEY } from '../../lib/auth/storedSession'

/** A `Storage` over a Map, so each test starts from nothing. */
function memoryStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key)
    },
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

const SESSION = { [SESSION_KEY]: 'user123' }

describe('account hint', () => {
  test("reads the stored session under the app's own key", () => {
    expect(STORED_SESSION_KEY).toBe(SESSION_KEY)
  })

  test('reads back what was written while a session is stored', () => {
    const storage = memoryStorage(SESSION)
    writeAccountHint({ name: 'Rae Voss', avatarUrl: 'https://cdn.example/a.png' }, storage)
    expect(readAccountHint(storage)).toEqual({
      name: 'Rae Voss',
      avatarUrl: 'https://cdn.example/a.png',
    })
  })

  test('a hint with no session is signed out', () => {
    const storage = memoryStorage()
    writeAccountHint({ name: 'Rae Voss', avatarUrl: null }, storage)
    expect(readAccountHint(storage)).toBeNull()
  })

  test('an emptied stored session is no session', () => {
    const storage = memoryStorage({ [SESSION_KEY]: '' })
    writeAccountHint({ name: 'Rae Voss', avatarUrl: null }, storage)
    expect(readAccountHint(storage)).toBeNull()
  })

  test('clearing it signs the bar out', () => {
    const storage = memoryStorage(SESSION)
    writeAccountHint({ name: 'Rae Voss', avatarUrl: null }, storage)
    clearAccountHint(storage)
    expect(readAccountHint(storage)).toBeNull()
  })

  test('a malformed hint reads as signed out, and blank fields as null', () => {
    expect(readAccountHint(memoryStorage({ ...SESSION, [ACCOUNT_HINT_KEY]: '{oops' }))).toBeNull()
    expect(readAccountHint(memoryStorage({ ...SESSION, [ACCOUNT_HINT_KEY]: 'null' }))).toBeNull()
    expect(
      readAccountHint(
        memoryStorage({ ...SESSION, [ACCOUNT_HINT_KEY]: '{"name":"","avatarUrl":7}' })
      )
    ).toEqual({ name: null, avatarUrl: null })
  })

  test('no storage is signed out, and writing to none is harmless', () => {
    expect(readAccountHint(null)).toBeNull()
    expect(() => writeAccountHint({ name: 'x', avatarUrl: null }, null)).not.toThrow()
    expect(() => clearAccountHint(null)).not.toThrow()
  })

  test('the last Game opened reads back while a session is stored, and goes with the hint (r2 H6)', () => {
    const storage = memoryStorage(SESSION)
    expect(readLastGame(storage)).toBeNull()
    writeLastGame({ id: 'g1', name: 'Rust Run' }, storage)
    expect(readLastGame(storage)).toEqual({ id: 'g1', name: 'Rust Run' })
    // A session that ended anywhere: no Game is named.
    expect(
      readLastGame(memoryStorage({ [LAST_GAME_KEY]: '{"id":"g1","name":"Rust Run"}' }))
    ).toBeNull()
    expect(readLastGame(memoryStorage({ ...SESSION, [LAST_GAME_KEY]: '{"id":"g1"}' }))).toBeNull()
    expect(readLastGame(memoryStorage({ ...SESSION, [LAST_GAME_KEY]: 'not json' }))).toBeNull()
    clearAccountHint(storage)
    expect(readLastGame(storage)).toBeNull()
    expect(readLastGame(null)).toBeNull()
    expect(() => writeLastGame({ id: 'g1', name: 'x' }, null)).not.toThrow()
  })

  test('the home’s strip names the last Game and links to it; with none the link stays out', () => {
    document.body.innerHTML = '<a data-last-game href="/build/games/" hidden></a>'
    const link = document.querySelector('a') as HTMLAnchorElement
    markLastGame(document, null, (id) => `/build/games/${id}`)
    expect(link.hidden).toBe(true)
    markLastGame(document, { id: 'g1', name: 'Rust Run' }, (id) => `/build/games/${id}`)
    expect(link.hidden).toBe(false)
    expect(link.textContent).toBe('Rust Run')
    expect(link.getAttribute('href')).toBe('/build/games/g1')
    document.body.replaceChildren()
  })
})
