import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SIGNED_OUT_VIEW_ATTRIBUTE,
  SIGNED_OUT_VIEWS,
  signedOutViewAt,
} from '../../../src/build/account/signedOutView.model'
import { ACCOUNT_HINT_KEY, STORED_SESSION_KEY } from '../../../src/lib/accountHint'
import {
  SIGNED_OUT_FONTS_ATTRIBUTE,
  SIGNED_OUT_VIEW_SCRIPT,
  signedOutViewsMarkup,
} from '../signedOutViews'

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

/** The view the head script marks a document at `pathname` as opening on, with this storage. */
function scriptMarks(pathname: string, storage: Storage | null): string | null {
  const marked = new Map<string, string>()
  const html = { setAttribute: (name: string, value: string) => marked.set(name, value) }
  const window = {
    location: { pathname },
    document: { documentElement: html, fonts: undefined },
    get localStorage(): Storage {
      if (storage === null) throw new Error('blocked')
      return storage
    },
  }
  new Function('location', 'document', 'window', `with (window) { ${SIGNED_OUT_VIEW_SCRIPT} }`)(
    window.location,
    window.document,
    window
  )
  const view = marked.get(SIGNED_OUT_VIEW_ATTRIBUTE) ?? null
  // No `document.fonts` to wait for: a marked view is painted at once.
  expect(marked.has(SIGNED_OUT_FONTS_ATTRIBUTE)).toBe(view !== null)
  if (view !== null) expect(scriptWaits(pathname, storage)).toBe(view !== '/')
  return view
}

/** Whether the head script, with faces to wait for, holds the view's paint for them. */
function scriptWaits(pathname: string, storage: Storage | null): boolean {
  const marked = new Set<string>()
  const html = { setAttribute: (name: string) => marked.add(name) }
  const fonts = { status: 'loading', addEventListener: () => undefined }
  const window = {
    location: { pathname },
    document: { documentElement: html, fonts },
    get localStorage(): Storage {
      if (storage === null) throw new Error('blocked')
      return storage
    },
    setTimeout: () => undefined,
  }
  new Function('location', 'document', 'window', `with (window) { ${SIGNED_OUT_VIEW_SCRIPT} }`)(
    window.location,
    window.document,
    window
  )
  return !marked.has(SIGNED_OUT_FONTS_ATTRIBUTE)
}

const ROUTES = Object.keys(SIGNED_OUT_VIEWS)

describe('SIGNED_OUT_VIEW_SCRIPT', () => {
  const HINT = JSON.stringify({ name: 'Yara', avatarUrl: null })
  const storages: [string, Storage | null][] = [
    ['no storage', null],
    ['empty storage', storageOf({})],
    ['a hint alone', storageOf({ [ACCOUNT_HINT_KEY]: HINT })],
    ['a stored session alone', storageOf({ [STORED_SESSION_KEY]: 'x' })],
    ['a hint and a session', storageOf({ [ACCOUNT_HINT_KEY]: HINT, [STORED_SESSION_KEY]: 'x' })],
  ]
  const paths = [
    '/build',
    '/build/',
    ...ROUTES.map((route) => `/build${route}`),
    '/build/mechs/new/',
    '/build/mechs/x',
    '/build/constructor',
    '/buildx/mechs/new',
    '/mechs/new',
    '/play/',
    '/',
  ]

  for (const [label, storage] of storages) {
    test(`agrees with signedOutViewAt: ${label}`, () => {
      for (const path of paths) {
        expect([path, scriptMarks(path, storage)]).toEqual([path, signedOutViewAt(path, storage)])
      }
    })
  }
})

describe('signedOutViewsMarkup', () => {
  test('draws every view, each shown by its own rule', async () => {
    const markup = await signedOutViewsMarkup()
    const css = readFileSync(
      join(import.meta.dir, '../../../src/styles/build/screens.css'),
      'utf-8'
    )
    for (const route of ROUTES) {
      expect(markup).toContain(`data-view="${route}"`)
      expect(css).toContain(
        `html[data-signed-out-view='${route}'] .su-signed-out-static[data-view='${route}']`
      )
    }
    expect(markup.match(/id="main-content"/g)).toHaveLength(1)
  })
})
