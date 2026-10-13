/**
 * LiveSheet — the Header C shared sheet shell.
 * One shell, three variants, "so the three screens cannot drift apart".
 *
 * Render-prop contract (binding):
 *   { variant, name, strip, back, condense, renderBody, syncStats }
 *
 * App bar (poster `.appbar`, design source clean-pilot.html): back + overflow
 * are bordered square icon buttons, `.su-page-action` high, either side of the
 * SU cargo mark. At rest the bar is a slim interactive strip (back + actions
 * only); the entity name lives once, in the poster hero below.
 *
 * Condense (S11 — binding): the top bar is sticky; when the hero scrolls out
 * of view (IntersectionObserver simple threshold — NOT the prototype's
 * clamp01 scroll interpolation, which is a post-beta fast-follow) the bar
 * fades in the entity name stamp + kind pill + live MiniStat strip via a CSS
 * transition, so the anchored bar keeps name + at-a-glance readouts in view
 * once the poster scrolls away. While hidden this block is aria-hidden and
 * pointer-events:none. Reducing this below "strip + fade + aria gating" needs
 * explicit design sign-off (risk R4).
 *
 * Stats are store-backed (the real ITUN replacement for the prototype's
 * single useState): the caller derives `strip` values from the same entity
 * record its hero trackers edit, so hero and strip stay in lockstep by
 * construction. `syncStats` overlays derived values (e.g. mech Cargo = hold
 * usage) onto matching strip keys.
 */

import type { StatTone } from 'component-lib'
import {
  Badge,
  buttonVariants,
  ChapterBand,
  cn,
  EntityExternalLinkProvider,
  Stat,
  tokens,
} from 'component-lib'
import { ArrowLeft } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { AppLink } from '../shared/AppLink'
import { SHEET_ICONBTN_CLASS } from './sheetChrome.model'
import type { SheetBand } from './sheetViewProps.model'

export type SheetVariant = 'pilot' | 'mech' | 'crawler'

export type LiveSheetSegment = {
  key: SheetVariant
  label: string
  href: string
  /** The segment matching the sheet being viewed — rust fill, no nav. */
  active: boolean
}

export type LiveSheetStripItem = {
  /** Stable key — also the `syncStats` overlay key (e.g. 'cargo'). */
  key: string
  label: string
  stat?: StatTone
  value: number
  max?: number
  /**
   * When false, this MiniStat hides below the sm breakpoint so the condensed
   * bar keeps only the priority readouts (Heat + SP
   * first; EP/Hold fold on phones). Defaults to true (always shown).
   */
  mobilePriority?: boolean
}

type LiveSheetProps = {
  variant: SheetVariant
  name: string
  /** Condensed-bar MiniStat readouts (values live, from the entity record). */
  strip?: LiveSheetStripItem[]
  back?: { href: string; label: string }
  /**
   * Mobile segmented Pilot/Mech/Crawler switch — rendered as a
   * full-width row of flex-1 sm btns under the top-bar controls, visible only
   * below the sm breakpoint (the 390 endpoint). Provided by the caller for
   * wired compositions; omit to hide.
   */
  segments?: LiveSheetSegment[]
  /** Sticky condense bar on scroll (default true — shipped tweak default). */
  condense?: boolean
  /**
   * The sheet body. Workshop-Manual sheets fold their identity band into the
   * body's first region, so identity + vitals stay in one component with their
   * handlers — the shell has no separate hero slot.
   */
  renderBody: () => ReactNode
  /** Derived stat overlays merged onto strip items by key (e.g. {cargo: used}). */
  syncStats?: Record<string, number>
  /** Trailing top-bar actions (Share/Publish). */
  actions?: ReactNode
  /**
   * The chapter band's line past the title (board 10): provenance beside the
   * type stamps, and the band's controls (Read | Edit, "Make a copy").
   */
  band?: SheetBand
  /** The second type stamp: a pilot's class, a mech's chassis, a crawler's type. */
  kindDetail?: string
  className?: string
}

/** The band's provenance line, beside the stamps. */
const PROVENANCE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

const BAND_ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

/** Sticky bar height — the IntersectionObserver top inset (design: 58/66px). */
/** The sheet you are on in the phone's Pilot/Mech/Crawler switch: an ink plate. */
const ACTIVE_SEGMENT = {
  backgroundColor: 'var(--color-ink)',
  borderColor: 'var(--color-ink)',
  color: 'var(--color-paper)',
} satisfies CSSProperties

const BAR_HEIGHT_PX = 58

const ROOT = { background: 'var(--color-wk-bg)', minHeight: '100vh' } satisfies CSSProperties

/** The sticky bar. Its gutter (`.su-sheet-gutter`) widens at sm. */
const BAR = {
  alignItems: 'center',
  background: 'var(--color-wk-bg)',
  columnGap: tokens.space[16],
  display: 'flex',
  flexWrap: 'wrap',
  minHeight: `${BAR_HEIGHT_PX}px`,
  paddingBlock: tokens.space[8],
  position: 'sticky',
  rowGap: tokens.space[4],
  top: 0,
  transitionDuration: '150ms',
  transitionProperty: 'border-color, box-shadow',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  zIndex: 40,
} satisfies CSSProperties

/** Scrolled past the sentinel: the bar seams (rule + drop shadow). */
const BAR_SEAMED = {
  ...BAR,
  borderBottom: `${tokens.borderWidth.pill} solid ${tokens.color.ink}`,
  boxShadow: '0 2px 0 var(--color-ink), 0 14px 20px -18px var(--color-ink-50)',
} satisfies CSSProperties

const BAR_AT_REST = {
  ...BAR,
  borderBottom: `${tokens.borderWidth.pill} solid transparent`,
} satisfies CSSProperties

const STRIP = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  minWidth: 0,
  transitionDuration: '150ms',
  transitionProperty: 'opacity, transform',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies CSSProperties

const STRIP_SHOWN = { ...STRIP, opacity: 1, translate: '0 0' } satisfies CSSProperties

// At rest it is out of the flow as well as invisible: an invisible strip
// still took the bar's first row on a phone and pushed Share and ⋯ onto a
// row of their own.
const STRIP_HIDDEN = {
  ...STRIP,
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  translate: '0 5px',
  visibility: 'hidden',
} satisfies CSSProperties

const NAME_STAMP = {
  display: 'block',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const BAR_END = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  flexWrap: 'wrap',
  gap: tokens.space[8],
  marginLeft: 'auto',
} satisfies CSSProperties

const BAR_ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: tokens.space[10],
} satisfies CSSProperties

const LINK = { textDecoration: 'none' } satisfies CSSProperties

const ICON = { height: '18px', width: '18px' } satisfies CSSProperties

/** The phone switch row; its `display` (phones only) is `.su-sheet-live-segments`. */
const SEGMENTS = {
  gap: tokens.space[8],
  order: 9999,
  paddingBottom: tokens.space[4],
  width: '100%',
} satisfies CSSProperties

const SEGMENT = { flex: '1 1 0%', textDecoration: 'none' } satisfies CSSProperties

const SENTINEL = { height: '1px', width: '100%' } satisfies CSSProperties

const BODY_FRAME = { position: 'relative' } satisfies CSSProperties

/**
 * True once `target` has scrolled behind the sticky bar. Plain threshold
 * observer per S11; environments without IntersectionObserver (happy-dom,
 * very old browsers) simply never condense.
 */
function useCondensed(target: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const el = target.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setCondensed(!entry.isIntersecting)
      },
      { rootMargin: `-${BAR_HEIGHT_PX}px 0px 0px 0px`, threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, enabled])

  return enabled && condensed
}

export function LiveSheet({
  variant,
  name,
  strip = [],
  back,
  segments,
  condense = true,
  renderBody,
  syncStats,
  actions,
  band,
  kindDetail,
  className,
}: LiveSheetProps) {
  // A 1px sentinel directly beneath the bar, NOT the identity block: the bar
  // should seam and fill the moment you scroll past IT, rather than waiting for
  // a whole region to clear the viewport.
  const topRef = useRef<HTMLDivElement | null>(null)
  const condensed = useCondensed(topRef, condense)

  const stripItems = strip.map((item) => ({
    ...item,
    value: syncStats?.[item.key] ?? item.value,
  }))

  return (
    // The page's one `<main>` landmark, on every surface that draws a sheet
    // (the live, public and Starter Set sheets): none of their routes wraps
    // one, and `Sheet`'s not-found state is itself a `<main>`, so the landmark
    // belongs here rather than around `Sheet`.
    <main className={cn(`sheet--${variant}`, className)} style={ROOT} data-variant={variant}>
      {/* Top bar — a labelled section, not a <header>: outside a <main> a
          header is a banner landmark, a second one beside the Union bar. It
          carries `data-print="hide"`, the print stylesheet's chrome rule.
          Always present (its back/share/overflow controls are always wanted),
          but UNSEAMED at rest: no bottom border while the sheet's own identity
          block is still on screen, so the bar reads as part of the page rather
          than as a lid on it. Scrolling past that block draws the border (and
          the drop shadow) and fades in the condensed name + vitals.

          `z-40`, above the entity cards' control rails (`z-30`): those rails
          ride their card's top edge and were sliding OVER the sticky bar as
          they scrolled under it.

          Its ground is the page's own workshop ground, not a tone wash: a 10%
          mech or pilot tone over paper made a pale blue-grey or pink bar that
          sat off the closed palette (ruleset §4.1). The entity's tone stays in
          the hero below. */}
      <section
        aria-label="Sheet controls"
        data-print="hide"
        className="su-sheet-gutter"
        style={condensed ? BAR_SEAMED : BAR_AT_REST}
      >
        {back && (
          <>
            {/* Back — a bordered square icon button (poster `.iconbtn`), icon
                only; the accessible name carries the destination. */}
            <AppLink
              href={back.href}
              aria-label={`Back to ${back.label.toLowerCase()}`}
              className={SHEET_ICONBTN_CLASS}
              style={LINK}
            >
              <ArrowLeft style={ICON} aria-hidden="true" />
            </AppLink>
          </>
        )}

        {/* Condensed identity + live MiniStat strip. At rest this is hidden —
            the entity name lives once, in the poster hero below (§4.1, Option
            A). Once the hero scrolls out of view it fades in the name stamp +
            kind pill + at-a-glance readouts (poster `.barname` + `.kindpill`)
            so the anchored bar keeps them in view (S11). */}
        {condense && (
          <div
            data-sheet-strip=""
            aria-hidden={!condensed}
            style={condensed ? STRIP_SHOWN : STRIP_HIDDEN}
          >
            {/* The contents mount only while condensed: an invisible copy of
                the name ahead of the hero h1 was the first match for a text
                query, and a hidden duplicate is noise to every reader. */}
            {condensed && (
              <>
                <Badge shape="stamp" size="full" style={NAME_STAMP}>
                  {name}
                </Badge>
                {stripItems.map((item) => (
                  <Stat
                    key={item.key}
                    orientation="horizontal"
                    label={item.label}
                    value={item.max !== undefined ? `${item.value}/${item.max}` : item.value}
                    // Non-priority readouts fold below sm so the condensed
                    // bar leads with Heat + SP on phones.
                    className={
                      item.mobilePriority === false ? 'su-sheet-live-stat-fold' : undefined
                    }
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* One badge PER LINKED UNIT, on the right beside the sheet actions —
            a hop straight to that pilot / mech / crawler, not a jump link to a
            section at the foot of the page. They ride the condensed state with
            the name and vitals: at rest the linked units are on screen in their
            own section, so the bar has nothing to add.

            `segments` already carries the wired set (it drives the mobile
            switcher below); the active one is this sheet, so it is skipped. */}
        <div style={BAR_END}>
          {condensed &&
            segments
              ?.filter((segment) => !segment.active)
              .map((segment) => (
                <AppLink
                  key={segment.key}
                  href={segment.href}
                  style={LINK}
                  aria-label={`Open the wired ${segment.label.toLowerCase()}`}
                >
                  {/* Tinted with the TARGET's ontology tone, not the current
                      sheet's: the badge's job is to say where it goes, and a
                      row of identical outline chips made every destination
                      look alike. `segment.key` is the target's variant, so the
                      tone is read straight off it. */}
                  <Badge shape="chip" surface="tone" tone={segment.key}>
                    {segment.label}
                  </Badge>
                </AppLink>
              ))}
          <div style={BAR_ACTIONS}>{actions}</div>
        </div>

        {/* Mobile segmented Pilot/Mech/Crawler switch — full-width
            second row inside the sticky bar so it stays thumb-reachable. The
            active segment is the sheet being viewed (an ink plate, never rust: a
            here-state is ink);
            the others navigate to their wired counterpart's sheet. */}
        {segments && segments.length > 1 && (
          <nav aria-label="Wired sheets" className="su-sheet-live-segments" style={SEGMENTS}>
            {segments.map((segment) =>
              segment.active ? (
                <span
                  key={segment.key}
                  aria-current="page"
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'compact' }),
                    'su-page-action'
                  )}
                  style={{ ...SEGMENT, ...ACTIVE_SEGMENT }}
                >
                  {segment.label}
                </span>
              ) : (
                <AppLink
                  key={segment.key}
                  href={segment.href}
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'compact' }),
                    'su-page-action'
                  )}
                  style={SEGMENT}
                >
                  {segment.label}
                </AppLink>
              )
            )}
          </nav>
        )}
      </section>

      {/* Condense sentinel — the moment this scrolls under the sticky bar, the
          bar seams (border + shadow) and fills (name + vitals). */}
      <div ref={topRef} aria-hidden="true" style={SENTINEL} />

      {/* The chapter band (board 10): the sheet's one h1, notched into a band
          in its own tone with the speckle behind it; the type stamps and where
          the sheet comes from above the name, Read | Edit beside it where the viewer
          may write (a read-only sheet has nothing to switch to). Full-bleed,
          like the SRD's. */}
      <ChapterBand
        layout="bleed"
        tone={variant}
        eyebrow={
          <>
            <Badge shape="stamp" size="full">
              {variant}
            </Badge>
            {kindDetail && (
              <Badge shape="stamp" size="full" surface="inverse">
                {kindDetail}
              </Badge>
            )}
            {band?.provenance && <span style={PROVENANCE}>{band.provenance}</span>}
          </>
        }
        aside={band?.actions ? <div style={BAND_ACTIONS}>{band.actions}</div> : undefined}
      >
        {name}
      </ChapterBand>

      {/* Body slabs. The body owns the hero, so it takes the hero's top
          padding. */}
      <div style={BODY_FRAME}>
        <div className="su-sheet-live-body">
          {/* No "View in SRD →" on a sheet. The app-wide builder is provided at
              the root (GameDataReady), and every full entity card renders it in
              its foot band — which on a sheet is EVERY installed system, module
              and piece of equipment. A sheet is a play surface you read down,
              not an index you navigate out of, so the link was a per-card exit
              hatch repeated dozens of times. Overriding the context to
              `undefined` for the sheet BODY turns it off for the whole subtree
              (including card detail modals, which are descendants) while the
              roster, Dashboard and wizards keep it. */}
          <EntityExternalLinkProvider value={undefined}>{renderBody()}</EntityExternalLinkProvider>
        </div>
      </div>
    </main>
  )
}
