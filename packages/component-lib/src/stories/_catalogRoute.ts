import { storyGroups, storySubgroups } from './_groups'

/**
 * The story catalog's addressing, shared by `catalog.tsx` (which renders it)
 * and `listStories.ts` (which prints it without a browser), so the two cannot
 * disagree about a story's id or its order.
 *
 * A story's id is its meta title's segments and its export name, each
 * kebab-cased, joined by `--`:
 * `Compositions/Entity/Reference Entity Card` + `SystemCard` is
 * `compositions--entity--reference-entity-card--system-card`. It changes only
 * when the title or the export is renamed.
 */

/**
 * Container widths a story can be framed at, in CSS px: a phone's whole
 * viewport, one reading column, and a desktop page's content measure. A preset
 * fixes the story's container width, so a capture never depends on how wide
 * the story's own content happens to be.
 */
export const WIDTH_PRESETS = { phone: 375, column: 480, page: 1200 } as const

type WidthPreset = keyof typeof WIDTH_PRESETS

/**
 * `browse`: the sidebar and the story. `canvas`: the story alone, no sidebar
 * or toolbar, so the viewport is the story's. `index`: every id, as links.
 */
type CatalogMode = 'browse' | 'canvas' | 'index'

export type CatalogRoute = {
  /** The story to show; null for the default. */
  id: string | null
  mode: CatalogMode
  /** The story container's width in px; null to fill the space it has. */
  width: number | null
}

export type StoryRef = { id: string; title: string; name: string }

const kebab = (s: string) =>
  s
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()

export const storyId = (title: string, name: string): string =>
  [...title.split('/'), name].map(kebab).join('--')

/** `SizeByExtentLargeFull` reads as "Size By Extent Large Full". */
export const storyLabel = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

const isPreset = (value: string): value is WidthPreset => Object.hasOwn(WIDTH_PRESETS, value)

/** A preset name or a whole number of px (`phone`, `640`); anything else is no width. */
function parseWidth(value: string | null): number | null {
  if (!value) return null
  if (isPreset(value)) return WIDTH_PRESETS[value]
  const px = Number(value)
  return Number.isInteger(px) && px > 0 ? px : null
}

/**
 * Reads `?story=<id>&mode=canvas&width=phone`. A `#<id>` (the catalog's
 * original address, and what an in-story link writes) still selects a story,
 * and wins over `?story=`: following such a link adds the hash and leaves the
 * query as it was.
 */
export function parseRoute(search: string, hash: string): CatalogRoute {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const fromHash = decodeURIComponent(hash.replace(/^#/, ''))
  return {
    id: fromHash || params.get('story') || null,
    mode: mode === 'canvas' || mode === 'index' ? mode : 'browse',
    width: parseWidth(params.get('width')),
  }
}

/** The address of a route, writing a preset's name rather than its px. */
export function routeHref({ id, mode, width }: CatalogRoute): string {
  const params = new URLSearchParams()
  if (id) params.set('story', id)
  if (mode !== 'browse') params.set('mode', mode)
  if (width !== null) {
    const preset = Object.entries(WIDTH_PRESETS).find(([, px]) => px === width)?.[0]
    params.set('width', preset ?? String(width))
  }
  const query = params.toString()
  return query ? `?${query}` : './'
}

/** Sidebar order: group, then sub-group (ungrouped leaves last), then id. */
function rank({ title }: StoryRef): [number, number] {
  const [group = '', sub = '', leaf] = title.split('/')
  const g = storyGroups.indexOf(group)
  const subs = storySubgroups[group] ?? []
  const s = leaf === undefined ? -1 : subs.indexOf(sub)
  return [g === -1 ? storyGroups.length : g, s === -1 ? subs.length : s]
}

export function sortStories<T extends StoryRef>(stories: readonly T[]): T[] {
  return stories
    .map((story) => ({ story, rank: rank(story) }))
    .sort(
      (a, b) =>
        a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.story.id.localeCompare(b.story.id)
    )
    .map(({ story }) => story)
}

/**
 * Every story a story file's source declares, read without importing it: the
 * meta title is the first `title:` after `export default` (as the coverage
 * guard reads it), and each `export const` / `export function` is a story,
 * which `story-coverage.test.ts`'s conventions make true of every story file.
 * Template literals are blanked first: a code sample in one (the Styleguide's)
 * holds an `export const` that is not a story.
 */
export function storiesInSource(file: string): StoryRef[] {
  const source = file.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
  const meta = source.slice(source.indexOf('export default'))
  const title = meta.match(/title:\s*(['"])([^'"]*)\1/)?.[2]
  if (!title || !source.includes('export default')) return []
  const names = [...source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)]
  return names.flatMap(([, name]) => (name ? [{ id: storyId(title, name), title, name }] : []))
}
