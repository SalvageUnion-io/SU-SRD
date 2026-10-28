import { describe, expect, test } from 'bun:test'
import { ACCOUNT_HINT_KEY, STORED_SESSION_KEY } from '../../../lib/accountHint'
import { expectsFrontDoor, FRONT_DOOR_ATTRIBUTE, FRONT_DOOR_SCRIPT } from '../frontDoorData'

/**
 * The front door renders the same with only `FRONT_DOOR_SCHEMAS` loaded as
 * with the whole dataset, and reads nothing it does not hold for (a reader
 * that falls back on a missing schema degrades silently, `readReference`).
 *
 * In a SUBPROCESS on purpose: every bunfig here preloads the whole dataset
 * (`tools/testPreload.ts`) and a loaded schema is never unloaded, so in-process
 * the subset could not be told from everything. A bare `bun -e` child has no
 * preload, the way the app's first paint has only what it asked for.
 */
function renderFrontDoor(schemas: 'subset' | 'all'): { markup: string; stderr: string } {
  const script = `
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { SalvageUnionReference } = await import('salvageunion-reference')
    const { FRONT_DOOR_SCHEMAS } = await import('${import.meta.dir}/../frontDoorData.ts')
    await SalvageUnionReference.preload(${schemas === 'all' ? "'all'" : 'FRONT_DOOR_SCHEMAS'})
    const { FrontDoor } = await import('${import.meta.dir}/../FrontDoor.tsx')
    process.stdout.write(renderToStaticMarkup(createElement(FrontDoor)))
  `
  const proc = Bun.spawnSync(['bun', '-e', script], {
    cwd: import.meta.dir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  expect(proc.exitCode).toBe(0)
  return { markup: proc.stdout.toString(), stderr: proc.stderr.toString() }
}

describe('FRONT_DOOR_SCHEMAS', () => {
  test('are all the front door reads', () => {
    const subset = renderFrontDoor('subset')
    const all = renderFrontDoor('all')
    expect(subset.stderr).toBe('')
    expect(all.markup).toContain('data-peek="classes:')
    expect(subset.markup).toBe(all.markup)
  })
})

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
