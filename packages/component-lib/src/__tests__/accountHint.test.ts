import { describe, expect, test } from 'bun:test'
import {
  ACCOUNT_HINT_KEY,
  clearAccountHint,
  readAccountHint,
  writeAccountHint,
} from '../accountHint'

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

const SESSION = { __convexAuthRefreshToken_happyconvexcloud: 'refresh' }

describe('account hint', () => {
  test('reads back what was written while a Convex Auth session is stored', () => {
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

  test('an emptied refresh token is no session', () => {
    const storage = memoryStorage({ __convexAuthRefreshToken_x: '' })
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
})
