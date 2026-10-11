/// <reference types="vite/client" />
import type { CSSProperties, ReactNode } from 'react'
import { Component, Fragment, StrictMode, Suspense, use, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, weight } from './src/design/tokens'
import { storyGroups, storySubgroups } from './src/stories/_groups'
import './src/styles/catalog.css'
// The faces the SRD ships (apps/srd/src/runtime/styles.entry.ts), so a story —
// the Og Card above all, which is a picture of what ships — draws in the real
// display type, not a fallback. They are dev dependencies here, as in the apps.
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'

/**
 * The component catalog: a dev-only page (`bun run stories`) that this
 * package's Vite server mounts from `index.html`. It renders every story file
 * in the library and in the two apps' component folders, one story at a time
 * on the paper canvas, addressed as `#<story-id>`.
 */

type StoryFile = { default: { title: string } } & Record<string, unknown>
type Entry = { id: string; title: string; name: string; Story: () => ReactNode }

const files = import.meta.glob<StoryFile>([
  './src/**/*.stories.tsx',
  '../../apps/itun/src/components/**/*.stories.tsx',
  '../../apps/srd/src/components/**/*.stories.tsx',
])

const DEFAULT_STORY = 'foundations--styleguide--overview'

const kebab = (s: string) =>
  s
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
const label = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

/** Sidebar order: group, then sub-group (ungrouped leaves last), then id. */
function rank({ title }: Entry): [number, number] {
  const [group = '', sub = '', leaf] = title.split('/')
  const g = storyGroups.indexOf(group)
  const subs = storySubgroups[group] ?? []
  const s = leaf === undefined ? -1 : subs.indexOf(sub)
  return [g === -1 ? storyGroups.length : g, s === -1 ? subs.length : s]
}

/**
 * Every story reads `SalvageUnionReference.*` at module top level, so no story
 * module is imported until the reference data has preloaded: an earlier read
 * throws "Schema not loaded" and the story renders blank. ITUN's
 * `GameDataReady` and srd's `useGameData` gate the same way.
 */
async function loadStories(): Promise<Entry[]> {
  await SalvageUnionReference.preload('all')
  const loaded = await Promise.all(Object.values(files).map((load) => load()))
  const entries = loaded.flatMap(({ default: meta, ...exports }) =>
    Object.entries(exports).flatMap(([name, Story]) =>
      typeof Story === 'function'
        ? [
            {
              id: [...meta.title.split('/'), name].map(kebab).join('--'),
              ...meta,
              name,
              Story: Story as Entry['Story'],
            },
          ]
        : []
    )
  )
  return entries
    .map((entry) => ({ entry, rank: rank(entry) }))
    .sort(
      (a, b) =>
        a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.entry.id.localeCompare(b.entry.id)
    )
    .map(({ entry }) => entry)
}

const storiesPromise = loadStories()

/** Keeps one broken story from unmounting the catalog. */
class StoryBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    const { error } = this.state
    return error ? <pre style={errorStyle}>{String(error)}</pre> : this.props.children
  }
}

const currentId = () => decodeURIComponent(location.hash.slice(1)) || DEFAULT_STORY

function Catalog() {
  const stories = use(storiesPromise)
  const [id, setId] = useState(currentId)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    const onHash = () => setId(currentId())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const active = stories.find((s) => s.id === id) ?? stories[0]
  const query = filter.toLowerCase()
  const shown = stories.filter((s) => `${s.title} ${label(s.name)}`.toLowerCase().includes(query))

  return (
    <div style={layoutStyle}>
      <nav style={navStyle}>
        <input
          type="search"
          aria-label="Filter stories"
          placeholder="Filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={filterStyle}
        />
        {shown.map((s, i) => (
          <Fragment key={s.id}>
            {s.title !== shown[i - 1]?.title && <div style={titleStyle}>{s.title}</div>}
            <a
              href={`#${s.id}`}
              style={{ ...linkStyle, fontWeight: s === active ? weight.bold : weight.normal }}
            >
              {label(s.name)}
            </a>
          </Fragment>
        ))}
      </nav>
      {/* The canvas every story renders on, so a story adds no paper wrapper. */}
      <main style={canvasStyle}>
        {active && (
          <StoryBoundary key={active.id}>
            <active.Story />
          </StoryBoundary>
        )}
      </main>
    </div>
  )
}

const layoutStyle = {
  display: 'grid',
  gridTemplateColumns: '16rem minmax(0, 1fr)',
  minHeight: '100vh',
} satisfies CSSProperties

const navStyle = {
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto',
  padding: space[12],
  background: color.wkBg,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const filterStyle = { width: '100%', padding: space[4] } satisfies CSSProperties

const titleStyle = {
  marginTop: space[12],
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  textTransform: 'uppercase',
} satisfies CSSProperties

const linkStyle = {
  display: 'block',
  padding: `${space[2]} ${space[8]}`,
  color: color.ink,
} satisfies CSSProperties

const canvasStyle = {
  background: color.paper,
  padding: space[16],
  fontFamily: 'Fira Code, monospace',
} satisfies CSSProperties

const errorStyle = { color: color.ink, whiteSpace: 'pre-wrap' } satisfies CSSProperties

const root = document.getElementById('root')
if (root)
  createRoot(root).render(
    <StrictMode>
      <StoryBoundary>
        <Suspense fallback={null}>
          <Catalog />
        </Suspense>
      </StoryBoundary>
    </StrictMode>
  )
