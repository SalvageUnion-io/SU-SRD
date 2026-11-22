/**
 * PlayFrame — every Play screen's one layout (play.md §2, ADR-063): the Play
 * bar on top, the screen's panes under it, phone first. It never scrolls as
 * a page: its host fills the window below its own top, and a pane scrolls
 * inside itself.
 *
 *  - **Below `lg`** (64rem, container queries on `.su-play-root`): one pane
 *    at a time under the pinned row (the live vitals and the Situation
 *    switch), and the tabs along the foot at thumb height, in the order the
 *    screen gives them. Closed panes stay mounted, `hidden`, so a
 *    half-typed Find, an open filter or a resolve in hand survives a switch.
 *    Toasts stand under the bar and the pinned row (`holdToastsOnTop`,
 *    `useToastsUnderHead`), so the bar's ‹ Sheet and Stop stay in reach and
 *    no toast lands on the tabs' thumb-height controls (r3 H2). Table mode's `focus` takes the panes' place, the panes kept under it;
 *    a `sheet` (play.md §18) takes the open pane's, the tabs kept under it.
 *  - **From `lg`**: the same panes as three columns, start | centre | end
 *    (the player's Units | Actions | Crew, Tables and Feed; the Mediator's
 *    table | Opposition | Rolls, Rules and Propose), then the foot. The end
 *    column stacks its panes in one scroller; a `dock` pane sits at its foot.
 *    A `sheet` stands in the centre column, its panes kept mounted under it.
 *
 * A screen with a long way to its panes gives `jumps` (r4 D6, the Mediator's):
 * skip links ahead of the bar, off screen until focused, each opening its
 * pane (its tab below `lg`) and moving focus into it.
 *
 * The arrangement is CSS (`styles/play/frame.css`); `wide` (`usePlayWide`,
 * the same rung) decides only what a reader is told, so crossing it re-lays
 * the panes without remounting them: a pane is a column's region from `lg`,
 * a tab's panel below it. The screen reads `wide` once and hands it here and
 * to its bar, which holds the Situation switch from `lg`.
 *
 * ## Nesting (the Nested Frames Audit)
 *
 * The frame is level 0. A pane is a plain region on it, not a frame: its
 * heading is a Slab, never a `TitledBox`, so what a pane lists — Compacts,
 * Cards, a unit's `TitledBox` — stays at level 1, and anything inside one of
 * those is a Mini (level 2).
 *
 * The screen is a page like the sheets: the page ground, the Play bar and
 * foot in the Cantina's band, and each pane on paper. Its ground is flat, its
 * brand-colour bands speckled as the sheet's (ruleset §1.3, §3.5.1; R10):
 * the frame sets the texture once for every entity form inside.
 *
 * Play's stylesheet bundle (`styles/play/play.css`) rides in with this
 * module, so the Play route's chunk is where it belongs. The host is the
 * page's one `<main>` landmark: no Play route wraps one (`__root.tsx` leaves
 * it to each route), and everything on a Play screen, the bar included, is
 * the screen's content.
 */

import '../styles/play/play.css'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { Tab, TabList, Tabs } from '../components/app'
import {
  capsLabel,
  EntitySurfaceProvider,
  holdToastsOnTop,
  SlabLookProvider,
  tokens,
} from '../components/index'
import { cn } from '../lib/cn'
import { playCopy } from '../messages/play'
import type { PaneSpec, PlayColumn } from './playPanes.model'
import { NOTICES_RESIZED } from './tableNotices.model'

/**
 * Play's brand-colour grounds wear the speckle as the sheet's do (ruleset
 * §3.5.1, R10): set once, for every form inside. The page ground, the paper
 * panes, buttons and fields stay clean, since only a band (the Play bar, a
 * head, a unit box's band) carries it.
 */
const SPECKLED = { texture: true } as const

/** A skip link, as the site's own (`SkipLink`): off screen until focused. */
const SKIP = cn('su-skip-link', capsLabel())

/** The Tabs root: the frame's grid fills it. */
const ROOT = { height: '100%' } satisfies CSSProperties

/** The tab row at the foot: the tabs share it, each a thumb's width. */
const TAB_LIST = {
  borderTop: `${tokens.borderWidth.chrome} solid var(--color-ink)`,
  flexWrap: 'nowrap',
  gap: 0,
} satisfies CSSProperties

/**
 * A tab: an equal share of the row, its label whole (C5, hard rule
 * K10). A label too long for its share widens its tab (no `minWidth: 0`) or
 * wraps between its words, never "…". The Compact Size, the Size of the
 * Play bar's buttons and the pinned switch that share the screen with it
 * (§4.7).
 */
const TAB = {
  border: 0,
  borderRadius: 0,
  flex: '1 1 0%',
  minHeight: tokens.size.compact,
  padding: `0 ${tokens.space[4]}`,
  whiteSpace: 'normal',
} satisfies CSSProperties

/** A pane and what it holds. */
export type PlayPane<Value extends string> = PaneSpec<Value> & { node: ReactNode }

type PlayFrameProps<Value extends string> = {
  /** From `lg` (`usePlayWide`), read once by the screen. */
  wide: boolean
  /** The Play bar (`PlayBar`). */
  bar: ReactNode
  /** Below `lg`, pinned above every pane: the live vitals and the Situation switch. */
  pinned?: ReactNode
  /** The panes, in reading order: each column's from the start. */
  panes: readonly PlayPane<Value>[]
  /** The tabs' order below `lg`, when it is not the reading order. */
  tabs?: readonly Value[]
  /** Names for the three columns' regions from `lg`, in order: "Units", "Actions", … */
  labels: readonly [string, string, string]
  /** The open pane below `lg`. */
  tab: Value
  onTab: (tab: Value) => void
  /** Below `lg`, table mode's screen, shown in the panes' place while set. */
  focus?: ReactNode
  /** A unit's sheet on the screen (play.md §18): the centre column from `lg`, the open pane's place below it. */
  sheet?: ReactNode
  /** The foot (`PlayFoot`), from `lg`. */
  foot: ReactNode
  /** Skip links ahead of the bar: each opens its pane and moves focus into it. */
  jumps?: readonly { pane: Value; label: string }[]
}

export function PlayFrame<Value extends string>({
  wide,
  bar,
  pinned,
  panes,
  tabs,
  labels,
  tab,
  onTab,
  focus,
  sheet,
  foot,
  jumps,
}: PlayFrameProps<Value>) {
  const id = useId()
  // A skip link was pressed: focus its pane once it is showing.
  const [jump, setJump] = useState<Value | null>(null)
  const hostRef = useRef<HTMLElement>(null)
  const hostH = useHostHeight(hostRef)
  // Below `lg` the controls are at thumb height, where a toast at the foot
  // lands: the toasts are held at the top instead (r2 C4), under the bar and
  // the pinned row, whose buttons stay in reach (r3 H2).
  useEffect(() => (wide ? undefined : holdToastsOnTop()), [wide])
  useToastsUnderHead(hostRef, !wide)
  const focused = !wide && focus !== undefined && focus !== null
  const sheetOn = !focused && sheet !== undefined && sheet !== null
  const tabbed = tabs ? tabs.flatMap((value) => panes.filter((p) => p.value === value)) : panes
  const open = panes.some((p) => p.value === tab) ? tab : tabbed[0]?.value
  const tabId = (value: string) => `${id}-tab-${value}`
  const paneId = (value: string) => `${id}-pane-${value}`
  useEffect(() => {
    if (jump === null) return
    document.getElementById(`${id}-pane-${jump}`)?.focus()
    setJump(null)
  }, [jump, id])

  const pane = (p: PlayPane<Value>, region: string | null) => (
    // From `lg` a start or centre pane is its column's named region; below
    // it, a tab's panel.
    <section
      key={p.value}
      id={paneId(p.value)}
      className="su-play-pane"
      data-column={p.column}
      data-dock={p.dock ? '' : undefined}
      hidden={wide ? sheetOn && p.column === 'centre' : focused || sheetOn || p.value !== open}
      role={wide ? undefined : 'tabpanel'}
      aria-label={wide ? (region ?? undefined) : undefined}
      aria-labelledby={wide ? undefined : tabId(p.value)}
      // A skip link's target: focusable by script alone.
      tabIndex={jumps?.some((j) => j.pane === p.value) ? -1 : undefined}
    >
      {p.node}
    </section>
  )
  const inColumn = (column: PlayColumn) => panes.filter((p) => p.column === column)

  return (
    // Play keeps the section stamp it was approved with.
    <SlabLookProvider value="stamp">
      <EntitySurfaceProvider value={SPECKLED}>
        <main ref={hostRef} className="su-play-root" style={{ height: hostH }}>
          <Tabs value={open ?? tab} onValueChange={onTab} style={ROOT}>
            <div className="su-play-frame">
              <div className="su-play-frame__bar">
                {jumps && jumps.length > 0 ? (
                  <nav aria-label={playCopy('jumpTo')}>
                    {jumps.map((j) => (
                      <button
                        key={j.pane}
                        type="button"
                        className={SKIP}
                        onClick={() => {
                          onTab(j.pane)
                          setJump(j.pane)
                        }}
                      >
                        {playCopy('skipTo', { name: j.label })}
                      </button>
                    ))}
                  </nav>
                ) : null}
                {bar}
              </div>
              {!wide && pinned ? <div className="su-play-frame__pinned">{pinned}</div> : null}
              {focused ? <div className="su-play-pane su-play-frame__focus">{focus}</div> : null}
              {inColumn('start').map((p) => pane(p, labels[0]))}
              {inColumn('centre').map((p) => pane(p, labels[1]))}
              {sheetOn ? (
                <section
                  className="su-play-pane su-play-sheet"
                  data-column="centre"
                  aria-label={playCopy('sheet')}
                >
                  {sheet}
                </section>
              ) : null}
              <section className="su-play-frame__end" aria-label={wide ? labels[2] : undefined}>
                {inColumn('end').map((p) => pane(p, null))}
              </section>
              {wide ? (
                <div className="su-play-frame__foot">{foot}</div>
              ) : (
                <div className="su-play-frame__tabs" hidden={focused}>
                  <TabList label={playCopy('play')} style={TAB_LIST}>
                    {tabbed.map((p) => (
                      <Tab
                        key={p.value}
                        value={p.value}
                        id={tabId(p.value)}
                        controls={paneId(p.value)}
                        style={TAB}
                      >
                        {p.label}
                        {/* A pending item marks its tab. */}
                        {p.dot ? (
                          <span
                            className="su-play-tab-dot"
                            role="img"
                            aria-label={playCopy('somethingIsWaiting')}
                          />
                        ) : null}
                      </Tab>
                    ))}
                  </TabList>
                </div>
              )}
            </div>
          </Tabs>
        </main>
      </EntitySurfaceProvider>
    </SlabLookProvider>
  )
}

/** Where a held toast starts, on the document: the foot of the frame's head (`atoms-leaves.css`). */
const HEAD_BOTTOM = '--su-toast-head'

/** The frame's head rows, either of which ends it. */
const HEAD_ROWS = ['.su-play-frame__bar', '.su-play-frame__pinned'].join()

/**
 * Publishes where the frame's head ends (the pinned row, else the bar) while
 * `on`, so a toast held at the top stands under it: never over ‹ Sheet, Stop
 * or a pinned vital's − / + (r3 H2).
 */
function useToastsUnderHead(hostRef: { current: HTMLElement | null }, on: boolean): void {
  useEffect(() => {
    const host = hostRef.current
    if (!on || !host) return
    const root = document.documentElement
    const publish = () => {
      const head =
        host.querySelector('.su-play-frame__pinned') ?? host.querySelector('.su-play-frame__bar')
      if (head === null) return
      root.style.setProperty(HEAD_BOTTOM, `${Math.max(0, head.getBoundingClientRect().bottom)}px`)
    }
    publish()
    window.addEventListener('resize', publish)
    window.addEventListener(NOTICES_RESIZED, publish)
    // The bar's line wrapping, the pinned row arriving or leaving (table mode).
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    ro?.observe(host)
    for (const part of host.querySelectorAll(HEAD_ROWS)) ro?.observe(part)
    return () => {
      window.removeEventListener('resize', publish)
      window.removeEventListener(NOTICES_RESIZED, publish)
      ro?.disconnect()
      root.style.removeProperty(HEAD_BOTTOM)
    }
  })
}

/**
 * The host's height: the window's below the host's own top, so the frame
 * fills the screen under whatever sits above it (the offline banner) and the
 * page never scrolls. Nothing on the ancestor chain establishes a height, so
 * `height: 100%` alone would collapse to the content.
 */
function useHostHeight(hostRef: { current: HTMLElement | null }): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const compute = () => {
      // The host's offset from the top of the PAGE, not the viewport, so a
      // host scrolled up never reads as a taller window.
      const top = host.getBoundingClientRect().top + window.scrollY
      setHeight(Math.max(0, window.innerHeight - top))
    }
    compute()
    // The window's resize catches its height; the observer, what moves the
    // host's top (a banner arriving). Absent in some test environments.
    window.addEventListener('resize', compute)
    // The table's notices above the host: one leaving shrinks nothing the
    // observer watches (the body keeps the window's height), so they say so.
    window.addEventListener(NOTICES_RESIZED, compute)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(compute)
    ro?.observe(document.body)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener(NOTICES_RESIZED, compute)
      ro?.disconnect()
    }
  }, [hostRef])
  return height
}
