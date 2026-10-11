import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseRoute,
  routeHref,
  sortStories,
  storiesInSource,
  storyId,
  storyLabel,
  WIDTH_PRESETS,
} from './_catalogRoute'

describe('storyId', () => {
  test('kebab-cases the title segments and the export, joined by --', () => {
    expect(storyId('Compositions/Entity/Reference Entity Card', 'SystemCard')).toBe(
      'compositions--entity--reference-entity-card--system-card'
    )
    expect(storyId('Foundations/Styleguide', 'Overview')).toBe('foundations--styleguide--overview')
  })

  test('a matrix cell export reads as its size and extent', () => {
    expect(storyId('Atoms/Stat', 'SizeByExtentLargeFull')).toBe(
      'atoms--stat--size-by-extent-large-full'
    )
    expect(storyLabel('SizeByExtentLargeFull')).toBe('Size By Extent Large Full')
  })
})

describe('parseRoute', () => {
  test('reads story, mode and a width preset', () => {
    expect(parseRoute('?story=a--b&mode=canvas&width=phone', '')).toEqual({
      id: 'a--b',
      mode: 'canvas',
      width: WIDTH_PRESETS.phone,
    })
  })

  test('takes a width in whole px and ignores anything else', () => {
    expect(parseRoute('?width=640', '').width).toBe(640)
    expect(parseRoute('?width=wide', '').width).toBeNull()
    expect(parseRoute('?width=-3', '').width).toBeNull()
    expect(parseRoute('?width=12.5', '').width).toBeNull()
    expect(parseRoute('?width=toString', '').width).toBeNull()
  })

  test('an unknown mode browses', () => {
    expect(parseRoute('?mode=print', '').mode).toBe('browse')
    expect(parseRoute('?mode=index', '').mode).toBe('index')
  })

  test('a hash selects a story, and wins over ?story=', () => {
    expect(parseRoute('', '#a--b')).toEqual({ id: 'a--b', mode: 'browse', width: null })
    expect(parseRoute('?story=a--b&mode=canvas', '#c--d').id).toBe('c--d')
  })

  test('nothing selected is null, for the default', () => {
    expect(parseRoute('', '').id).toBeNull()
  })
})

describe('routeHref', () => {
  test('round-trips through parseRoute, naming a preset', () => {
    const route = { id: 'a--b', mode: 'canvas' as const, width: WIDTH_PRESETS.column }
    const href = routeHref(route)
    expect(href).toBe('?story=a--b&mode=canvas&width=column')
    expect(parseRoute(href, '')).toEqual(route)
  })

  test('omits browse, no width and no story', () => {
    expect(routeHref({ id: 'a--b', mode: 'browse', width: null })).toBe('?story=a--b')
    expect(routeHref({ id: null, mode: 'browse', width: 640 })).toBe('?width=640')
    expect(routeHref({ id: null, mode: 'browse', width: null })).toBe('./')
  })
})

describe('sortStories', () => {
  test('orders by group, then sanctioned sub-group (leaves last), then id', () => {
    const ref = (title: string, name: string) => ({ id: storyId(title, name), title, name })
    const sorted = sortStories([
      ref('Compositions/Stat Column', 'Default'),
      ref('Compositions/Shell/App Bar', 'Default'),
      ref('Compositions/Entity/Card Pennant', 'Default'),
      ref('Atoms/Stat', 'Default'),
      ref('Foundations/Theme', 'B'),
      ref('Foundations/Theme', 'A'),
    ])
    expect(sorted.map((s) => `${s.title}:${s.name}`)).toEqual([
      'Foundations/Theme:A',
      'Foundations/Theme:B',
      'Atoms/Stat:Default',
      'Compositions/Entity/Card Pennant:Default',
      'Compositions/Shell/App Bar:Default',
      'Compositions/Stat Column:Default',
    ])
  })
})

describe('storiesInSource', () => {
  test('reads the meta title and every exported story, not a body title', () => {
    const source = [
      "import { X } from './X'",
      'const helper = { title: "Not the meta" }',
      'export default {',
      "  title: 'Atoms/X',",
      '}',
      'export const Default: Story = () => <X title="Cargo Hold" />',
      'export function Sizes() { return null }',
      'export const LargeFull = cell(1)',
    ].join('\n')
    expect(storiesInSource(source).map((s) => s.id)).toEqual([
      'atoms--x--default',
      'atoms--x--sizes',
      'atoms--x--large-full',
    ])
  })

  test('an export inside a code sample is not a story', () => {
    const source = [
      "export default { title: 'Foundations/Styleguide' }",
      'export const Conventions = () => <pre>{`',
      "export default { title: 'Atoms/Stat' }",
      'export const Anatomies = () => null',
      '`}</pre>',
    ].join('\n')
    expect(storiesInSource(source).map((s) => s.id)).toEqual([
      'foundations--styleguide--conventions',
    ])
  })

  test('a file with no meta title has no stories', () => {
    expect(storiesInSource('export const Default = () => null')).toEqual([])
  })

  test('every story file in the package yields unique ids', () => {
    const src = join(import.meta.dir, '..')
    const ids = [...new Glob('**/*.stories.tsx').scanSync(src)].flatMap((file) =>
      storiesInSource(readFileSync(join(src, file), 'utf8')).map((s) => s.id)
    )
    expect(ids.length).toBeGreaterThan(100)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
