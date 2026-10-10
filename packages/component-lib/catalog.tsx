/// <reference types="vite/client" />
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Component, Fragment, StrictMode, Suspense, use, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, weight } from './src/design/tokens'
import type { CatalogRoute, StoryRef } from './src/stories/_catalogRoute'
import {
  parseRoute,
  routeHref,
  sortStories,
  storyId,
  storyLabel,
  WIDTH_PRESETS,
} from './src/stories/_catalogRoute'
import './src/styles/catalog.css'
// The faces the apps ship (apps/srd/src/runtime/styles.entry.ts, ITUN's
// __root.tsx), so a story draws in the product's type at the product's text
// widths, not a fallback.
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'

/**
 * The component catalog: a dev-only page (`bun run stories`) that this
 * package's Vite server mounts from `index.html`. It renders every story file
 * in the library and in the two apps' component folders, one story at a time
 * on the paper ground. A story is addressed as `?story=<id>`; `&mode=canvas`
 * drops the sidebar and toolbar, `&width=phone|column|page|<px>` fixes the
 * story's container width, and `?mode=index` lists every id
 * (`src/stories/_catalogRoute.ts`). `#<id>` still selects a story.
 * `bun run stories:ids` prints the ids without a browser (`listStories.ts`).
 */

type StoryFile = { default: { title: string } } & Record<string, unknown>
type Entry = StoryRef & { Story: () => ReactNode }

const files = import.meta.glob<StoryFile>([
  './src/**/*.stories.tsx',
  '../../apps/itun/src/components/**/*.stories.tsx',
  '../../apps/srd/src/components/**/*.stories.tsx',
])

const DEFAULT_STORY = 'foundations--styleguide--overview'

/**
 * Every story reads `SalvageUnionReference.*` at module top level, so no story
 * module is imported until the reference data has preloaded: an earlier read
 * throws "Schema not loaded" and the story renders blank. ITUN's
 * `GameDataReady` and srd's `useGameData` gate the same way.
 */
async function loadStories(): Promise<Entry[]> {
  await SalvageUnionReference.preload('all')
  const loaded = await Promise.all(Object.values(files).map((load) => load()))
  const entries = loaded.flatMap(({ default: { title }, ...exports }) =>
    Object.entries(exports).flatMap(([name, Story]) =>
      typeof Story === 'function'
        ? [{ id: storyId(title, name), title, name, Story: Story as Entry['Story'] }]
        : []
    )
  )
  return sortStories(entries)
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

const currentRoute = () => parseRoute(location.search, location.hash)

/** The route, kept in step with the address bar (links, back and forward). */
function useRoute(): [CatalogRoute, (route: CatalogRoute) => (e: MouseEvent) => void] {
  const [route, setRoute] = useState(currentRoute)
  useEffect(() => {
    const sync = () => setRoute(currentRoute())
    addEventListener('hashchange', sync)
    addEventListener('popstate', sync)
    return () => {
      removeEventListener('hashchange', sync)
      removeEventListener('popstate', sync)
    }
  }, [])
  // A plain click moves without reloading every story module; a modified click
  // (a new tab) falls through to the link.
  const go = (next: CatalogRoute) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    history.pushState(null, '', routeHref(next))
    setRoute(next)
  }
  return [route, go]
}

/** The story in its container: `width` px wide when set, else the space it has. */
function StoryFrame({ entry, width }: { entry: Entry; width: number | null }) {
  return (
    <div style={width === null ? fillFrameStyle : { ...fixedFrameStyle, width: `${width}px` }}>
      <StoryBoundary key={entry.id}>
        <entry.Story />
      </StoryBoundary>
    </div>
  )
}

function Index({ stories }: { stories: Entry[] }) {
  return (
    <main style={indexStyle}>
      <h1 style={indexTitleStyle}>{stories.length} stories</h1>
      <ol style={indexListStyle}>
        {stories.map((s) => (
          <li key={s.id} data-story-id={s.id}>
            <a href={routeHref({ id: s.id, mode: 'canvas', width: null })}>{s.id}</a>
          </li>
        ))}
      </ol>
    </main>
  )
}

function Toolbar({
  entry,
  route,
  go,
}: {
  entry: Entry
  route: CatalogRoute
  go: ReturnType<typeof useRoute>[1]
}) {
  const widths: [string, number | null][] = [
    ['fill', null],
    ...Object.entries(WIDTH_PRESETS).map(([name, px]): [string, number] => [`${name} ${px}`, px]),
  ]
  return (
    <div style={toolbarStyle}>
      <code>{entry.id}</code>
      {widths.map(([name, width]) => {
        const next = { ...route, id: entry.id, width }
        return (
          <a
            key={name}
            href={routeHref(next)}
            onClick={go(next)}
            style={{
              ...toolLinkStyle,
              fontWeight: route.width === width ? weight.bold : undefined,
            }}
          >
            {name}
          </a>
        )
      })}
      <a
        href={routeHref({ id: entry.id, mode: 'canvas', width: route.width })}
        style={toolLinkStyle}
      >
        canvas only ↗
      </a>
    </div>
  )
}

function Catalog() {
  const stories = use(storiesPromise)
  const [route, go] = useRoute()
  const [filter, setFilter] = useState('')

  const active =
    stories.find((s) => s.id === (route.id ?? DEFAULT_STORY)) ??
    stories.find((s) => s.id === DEFAULT_STORY) ??
    stories[0]

  useEffect(() => {
    document.title = active ? `${active.id} · stories` : 'component-lib stories'
  }, [active])

  if (route.mode === 'index') return <Index stories={stories} />
  if (!active) return null

  if (route.mode === 'canvas')
    return (
      <main style={canvasModeStyle} data-story-id={active.id}>
        <StoryFrame entry={active} width={route.width} />
      </main>
    )

  const query = filter.toLowerCase()
  const shown = stories.filter((s) =>
    `${s.title} ${storyLabel(s.name)}`.toLowerCase().includes(query)
  )

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
        {shown.map((s, i) => {
          const next = { ...route, id: s.id }
          return (
            <Fragment key={s.id}>
              {s.title !== shown[i - 1]?.title && <div style={titleStyle}>{s.title}</div>}
              <a
                href={routeHref(next)}
                onClick={go(next)}
                style={{ ...linkStyle, fontWeight: s === active ? weight.bold : weight.normal }}
              >
                {storyLabel(s.name)}
              </a>
            </Fragment>
          )
        })}
      </nav>
      <main style={browseMainStyle} data-story-id={active.id}>
        <Toolbar entry={active} route={route} go={go} />
        <StoryFrame entry={active} width={route.width} />
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

/*
 * The story's ground. It sets no font: the story inherits the product's body
 * type from `index.css` (Barlow, through `--font-body`), as it does in the apps.
 */
const browseMainStyle = {
  minWidth: 0,
  background: color.paper,
  padding: space[16],
  overflowX: 'auto',
} satisfies CSSProperties

const canvasModeStyle = {
  minHeight: '100vh',
  background: color.paper,
  overflowX: 'auto',
} satisfies CSSProperties

/* A block that fills its column, so no story is sized to its own min-content. */
const fillFrameStyle = { width: '100%', minWidth: 0 } satisfies CSSProperties
const fixedFrameStyle = { flex: 'none', maxWidth: 'none' } satisfies CSSProperties

const toolbarStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${space[4]} ${space[12]}`,
  alignItems: 'baseline',
  marginBottom: space[16],
  paddingBottom: space[8],
  borderBottom: `1px solid ${color.wkBg}`,
  color: color.wkMuted,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const toolLinkStyle = { color: color.ink } satisfies CSSProperties

const indexStyle = {
  padding: space[16],
  background: color.paper,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const indexTitleStyle = { fontSize: fontSize.title, margin: 0 } satisfies CSSProperties

const indexListStyle = { paddingLeft: space[24] } satisfies CSSProperties

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
