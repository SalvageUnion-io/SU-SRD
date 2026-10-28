import { describe, expect, test } from 'bun:test'
import { expectsFrontDoor, FRONT_DOOR_ATTRIBUTE } from '../../../src/build/roster/frontDoor.model'
import { ACCOUNT_HINT_KEY, STORED_SESSION_KEY } from '../../../src/lib/accountHint'
import { FRONT_DOOR_SCRIPT } from '../frontDoor'

/** A `Storage` holding `entries`. */
function storageOf(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

/** Whether the head script marks a document at `pathname` with this storage. */
function scriptMarks(pathname: string, storage: Storage | null): boolean {
  const marked = new Set<string>()
  const html = { setAttribute: (name: string) => marked.add(name) }
  const window = {
    location: { pathname },
    document: { documentElement: html },
    get localStorage(): Storage {
      if (storage === null) throw new Error('blocked')
      return storage
    },
  }
  new Function('location', 'document', 'window', `with (window) { ${FRONT_DOOR_SCRIPT} }`)(
    window.location,
    window.document,
    window
  )
  return marked.has(FRONT_DOOR_ATTRIBUTE)
}

describe('FRONT_DOOR_SCRIPT', () => {
  const HINT = JSON.stringify({ name: 'Yara', avatarUrl: null })
  const storages: [string, Storage | null][] = [
    ['no storage', null],
    ['empty storage', storageOf({})],
    ['a hint alone', storageOf({ [ACCOUNT_HINT_KEY]: HINT })],
    ['a stored session alone', storageOf({ [STORED_SESSION_KEY]: 'x' })],
    ['a hint and a session', storageOf({ [ACCOUNT_HINT_KEY]: HINT, [STORED_SESSION_KEY]: 'x' })],
  ]
  const paths = ['/build', '/build/', '/build/pilots/new', '/play/', '/']

  for (const [label, storage] of storages) {
    test(`agrees with expectsFrontDoor: ${label}`, () => {
      for (const path of paths) {
        expect([path, scriptMarks(path, storage)]).toEqual([path, expectsFrontDoor(path, storage)])
      }
    })
  }
})
