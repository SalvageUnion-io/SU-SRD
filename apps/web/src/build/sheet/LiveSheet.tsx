/**
 * LiveSheet — the Header C shared sheet shell.
 * One shell, three variants, "so the three screens cannot drift apart".
 *
 * Render-prop contract (binding):
 *   { variant, name, strip, renderBody, syncStats }
 *
 * The page starts with the chapter band: there is no back link and no bar
 * above it at rest. The sheet's controls — Read | Edit, "Make a copy", Share,
 * "⋯" — sit in the band's top-right corner; the type stamp sits right of the
 * name, and the phone's Pilot/Mech/Crawler switch below it.
 *
 * Condense (S11 — binding): the top bar is sticky and takes no room at rest;
 * when the hero scrolls out
 * of view (IntersectionObserver simple threshold — NOT the prototype's
 * clamp01 scroll interpolation, which is a post-beta fast-follow) the bar
 * fades in the entity name stamp + kind pill + live MiniStat strip via a CSS
 * transition, so the anchored bar keeps name + at-a-glance readouts in view
 * once the poster scrolls away. While hidden this block is aria-hidden and
 * pointer-events:none. Reducing this below "strip + fade + aria gating" needs
 * explicit design sign-off (risk R4).
 *
 * Stats are store-backed (the real app replacement for the prototype's
 * single useState): the caller derives `strip` values from the same entity
 * record its hero trackers edit, so hero and strip stay in lockstep by
 * construction. `syncStats` overlays derived values (e.g. mech Cargo = hold
 * usage) onto matching strip keys.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { StatTone } from '../../components/index'
import {
  Badge,
  Button,
  ChapterBand,
  Cluster,
  cn,
  EntityExternalLinkProvider,
  EntityStat,
  KindLabel,
  relation,
  Stat,
  Tags,
  tokens,
} from '../../components/index'
import type { BandStamp } from './bandStamps.model'
import type { SheetBand } from './sheetViewProps.model'

/** The four sheets that share this shell (hard rule R11): a unit's, and a built NPC's. */
type SheetVariant = SheetKind | 'npc'

/** A unit that is out of play: its stamp ("Killed in Action") and what that means. */
type SheetUnitOut = { stamp: string; note: string }

/** Each sheet's kind, for its h1's screen-reader text (never a stamp, EDL E9). */
const KIND_LABEL: Record<SheetVariant, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Union Crawler',
  npc: 'NPC',
}

/** The chapter band each sheet wears: its own tone, and Denizens navy for an NPC. */
const BAND_TONE = {
  pilot: 'pilot',
  mech: 'mech',
  crawler: 'crawler',
  npc: 'denizen',
} as const satisfies Record<SheetVariant, string>

export type LiveSheetSegment = {
  key: SheetVariant
  label: string
  /** The unit's own name: its relation chip in the condensed bar. */
  name: string
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
  /**
   * Mobile segmented Pilot/Mech/Crawler switch — rendered as a
   * full-width row of flex-1 sm btns under the name, the band's last line,
   * visible only below the sm breakpoint (the 390 endpoint). Provided by the
   * caller for wired compositions; omit to hide.
   */
  segments?: LiveSheetSegment[]
  /**
   * The sheet body. Workshop-Manual sheets fold their identity band into the
   * body's first region, so identity + vitals stay in one component with their
   * handlers — the shell has no separate hero slot.
   */
  renderBody: () => ReactNode
  /** Derived stat overlays merged onto strip items by key (e.g. {cargo: used}). */
  syncStats?: Record<string, number>
  /** The sheet's own actions (Share, "⋯"), after the band's controls. */
  actions?: ReactNode
  /** The chapter band's controls (Read | Edit, "Make a copy"), in its corner. */
  band?: SheetBand
  /**
   * What it is built as: a pilot's class, a mech's chassis, a crawler's type —
   * a `CLASS | Engineer` chip that opens and Peeks the entity it names. Not
   * shown when it only repeats the name (the Starter Set's Scrapper).
   */
  kindDetail?: BandStamp
  /**
   * The unit is out (hard rule R11's one unit-out treatment): a pilot killed
   * in action, a destroyed mech, an NPC down. Its stamp rides the band right
   * of the name with what it is built as, and its consequence is the body's
   * first line; the sheet stays readable and writable, so a bookkeeping slip
   * can be undone.
   */
  out?: SheetUnitOut
  /**
   * A player-made thing that could pass for the book (a built NPC; ruleset
   * §3.9): the hatched band, its User-made stamp, and "Made by [maker]".
   */
  userMade?: { madeBy: string }
  /**
   * The name is a mech's pattern name, which the book prints in quotes: the
   * band's title and the condensed bar read “Mazona”.
   */
  quoted?: boolean
}

/** Sticky bar height — the IntersectionObserver top inset (design: 58/66px). */
const BAR_HEIGHT_PX = 58

const ROOT = { background: 'var(--color-wk-bg)', minHeight: '100vh' } satisfies CSSProperties

/**
 * The sticky bar's anchor: sticky at the top, but no height, so at rest the
 * page starts with the band and nothing above it.
 */
const BAR_ANCHOR = {
  height: 0,
  position: 'sticky',
  top: 0,
  zIndex: tokens.layer.sticky,
} satisfies CSSProperties

/** The bar, over the page from its anchor. Its gutter (`.su-sheet-gutter`) widens at sm. */
const BAR = {
  alignItems: 'center',
  background: 'var(--color-wk-bg)',
  // No black rule under the app's nav (owner, 2026-10-19): the lift alone
  // sets it off the page it floats over.
  boxShadow: tokens.shadow.lift,
  columnGap: tokens.space[16],
  display: 'flex',
  flexWrap: 'wrap',
  insetInline: 0,
  minHeight: `${BAR_HEIGHT_PX}px`,
  paddingBlock: tokens.space[8],
  position: 'absolute',
  rowGap: tokens.space[4],
  top: 0,
  transitionDuration: tokens.duration.fast,
  transitionProperty: 'opacity, visibility',
  transitionTimingFunction: tokens.ease,
} satisfies CSSProperties

/** Scrolled past the sentinel: the bar fades in. */
const BAR_SHOWN = { ...BAR, opacity: 1, visibility: 'visible' } satisfies CSSProperties

/** At rest it is not there to see, click or read. */
const BAR_HIDDEN = {
  ...BAR,
  opacity: 0,
  pointerEvents: 'none',
  visibility: 'hidden',
} satisfies CSSProperties

const STRIP = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  minWidth: 0,
  transitionDuration: tokens.duration.base,
  transitionProperty: 'opacity, transform',
  transitionTimingFunction: tokens.ease,
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

/** The condensed name wraps rather than cutting to "…" (EDL E18). */
const NAME_STAMP = {
  display: 'block',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
} satisfies CSSProperties

const BAR_END = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  flexWrap: 'wrap',
  gap: tokens.space[8],
  marginLeft: 'auto',
} satisfies CSSProperties

/** The phone switch row; its `display` (phones only) is `.su-sheet-live-segments`. */
const SEGMENTS = {
  gap: tokens.space[8],
  width: '100%',
} satisfies CSSProperties

const SEGMENT = { flex: '1 1 0%' } satisfies CSSProperties

// The band pulls back over its 1px, so no strip of page ground shows between
// the Union bar and the band (the band paints over it: it is positioned).
const SENTINEL = {
  height: '1px',
  marginBottom: '-1px', // design-tokens-ignore: a fit, the sentinel takes back its own 1px
  width: '100%',
} satisfies CSSProperties

const BODY_FRAME = { position: 'relative' } satisfies CSSProperties

/** The unit-out line sits over the body, a block's gap above its first region. */
const OUT_NOTE = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  margin: `0 0 ${tokens.space[16]}`,
} satisfies CSSProperties

/**
 * True once `target` has scrolled behind the sticky bar. Plain threshold
 * observer per S11; environments without IntersectionObserver (happy-dom,
 * very old browsers) simply never condense.
 */
function useCondensed(target: RefObject<HTMLElement | null>): boolean {
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
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
  }, [target])

  return condensed
}

export function LiveSheet({
  variant,
  name,
  strip = [],
  segments,
  renderBody,
  syncStats,
  actions,
  band,
  kindDetail,
  out,
  userMade,
  quoted = false,
}: LiveSheetProps) {
  // A 1px sentinel directly beneath the bar, NOT the identity block: the bar
  // should seam and fill the moment you scroll past IT, rather than waiting for
  // a whole region to clear the viewport.
  const topRef = useRef<HTMLDivElement | null>(null)
  const condensed = useCondensed(topRef)

  // A chip that only repeats the name says nothing (the Starter Set's Scrapper).
  const stamp =
    kindDetail && kindDetail.name.toLowerCase() !== name.trim().toLowerCase()
      ? kindDetail
      : undefined

  const title = quoted ? `“${name}”` : name

  const stripItems = strip.map((item) => ({
    ...item,
    value: syncStats?.[item.key] ?? item.value,
  }))

  return (
    // The page's one `<main>` landmark, on every surface that draws a sheet
    // (the live, public and Starter Set sheets): none of their routes wraps
    // one, and `Sheet`'s not-found state is itself a `<main>`, so the landmark
    // belongs here rather than around `Sheet`.
    <main
      className={cn(`su-sheet--${variant}`, 'su-page-gutters')}
      style={ROOT}
      data-variant={variant}
    >
      {/* Top bar — a labelled section, not a <header>: outside a <main> a
          header is a banner landmark, a second one beside the Union bar. It
          carries `data-print="hide"`, the print stylesheet's chrome rule.
          At rest it is not there: the page starts with the chapter band, whose
          corner holds the sheet's controls. Its anchor is sticky with no
          height, so scrolling past the band fades the bar in over the page —
          seamed (rule + drop shadow), with the condensed name + vitals —
          without moving anything under it.

          `layer.sticky`, above the entity cards' control rails (a local z 3):
          those rails ride their card's top edge and were sliding OVER the
          sticky bar as they scrolled under it.

          Its ground is the page's own workshop ground, not a tone wash: a 10%
          mech or pilot tone over paper made a pale blue-grey or pink bar that
          sat off the closed palette (ruleset §4.1). The entity's tone stays in
          the hero below. */}
      <div style={BAR_ANCHOR}>
        <section
          aria-label="Sheet controls"
          aria-hidden={!condensed}
          data-print="hide"
          className="su-sheet-gutter"
          style={condensed ? BAR_SHOWN : BAR_HIDDEN}
        >
          {/* Condensed identity + live MiniStat strip. At rest this is hidden —
            the entity name lives once, in the poster hero below (§4.1, Option
            A). Once the hero scrolls out of view it fades in the name stamp +
            kind pill + at-a-glance readouts (poster `.barname` + `.kindpill`)
            so the anchored bar keeps them in view (S11). */}
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
                  {title}
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

          {/* Each LINKED UNIT as its relation chip (`chips-and-actions.md`
            C11), `PILOT | Bonesaw`, on the right beside the sheet actions: a
            hop straight to that pilot / mech / crawler, not a jump link to a
            section at the foot of the page. They ride the condensed state with
            the name and vitals, at the strip's chip size (C1a): at rest the
            linked units are on screen in their own section, so the bar has
            nothing to add.

            `segments` already carries the wired set (it drives the mobile
            switcher below); the active one is this sheet, so it is skipped. */}
          <div style={BAR_END}>
            {condensed && segments && (
              <Tags
                tags={segments
                  .filter((segment) => !segment.active)
                  .map((segment) =>
                    relation(segment.key, segment.label, segment.name, { href: segment.href })
                  )}
                linkable
                size="compact"
              />
            )}
          </div>
        </section>
      </div>

      {/* Condense sentinel — the moment this scrolls under the sticky bar, the
          bar seams (border + shadow) and fills (name + vitals). */}
      <div ref={topRef} aria-hidden="true" style={SENTINEL} />

      {/* The chapter band (board 10): the sheet's one h1, notched into a band
          in its own tone with the speckle behind it. The controls — Read |
          Edit where the viewer may write, "Make a copy", Share and "⋯" — sit
          in its top-right corner. Right of the name (EDL E20), what it is
          built as, and on a phone the Pilot/Mech/Crawler switch, below the
          name there. Full-bleed, like the SRD's. */}
      <ChapterBand
        tone={BAND_TONE[variant]}
        userMade={userMade !== undefined}
        asideAt="notch"
        corner={
          band?.actions || actions ? (
            <>
              {band?.actions}
              {actions}
            </>
          ) : undefined
        }
        aside={
          <>
            {(stamp || out || userMade) && (
              <Cluster gap={8}>
                {userMade && <Stat orientation="horizontal" label="User-made" wrap />}
                {stamp &&
                  (stamp.entityRef ? (
                    <EntityStat label={stamp.label} entityRef={stamp.entityRef} />
                  ) : (
                    <Stat orientation="horizontal" label={stamp.label} value={stamp.name} wrap />
                  ))}
                {userMade && (
                  <Stat orientation="horizontal" label="Made by" value={userMade.madeBy} wrap />
                )}
                {out && <Stat orientation="horizontal" label={out.stamp} state="critical" wrap />}
              </Cluster>
            )}
            {/* The phone's segmented Pilot/Mech/Crawler switch, full width
                under the name so it stays thumb-reachable. The active segment
                is the sheet being viewed (an ink plate, never rust: a
                here-state is ink); the others navigate to their wired
                counterpart's sheet. */}
            {segments && segments.length > 1 && (
              <nav aria-label="Assigned sheets" className="su-sheet-live-segments" style={SEGMENTS}>
                {segments.map((segment) =>
                  segment.active ? (
                    // The sheet you are on: marked, and no link (there is
                    // nowhere to go); an ink plate, as a here-state is ink.
                    <Button
                      key={segment.key}
                      aria-current="page"
                      variant="ink"
                      size="compact"
                      className="su-page-action"
                      style={SEGMENT}
                    >
                      {segment.label}
                    </Button>
                  ) : (
                    <Button
                      key={segment.key}
                      href={segment.href}
                      size="compact"
                      className="su-page-action"
                      style={SEGMENT}
                    >
                      {segment.label}
                    </Button>
                  )
                )}
              </nav>
            )}
          </>
        }
      >
        {title}
        {/* The kind is never stamped (EDL E9): the h1 says it to screen readers. */}
        <KindLabel kind={KIND_LABEL[variant]} />
      </ChapterBand>

      {/* Body slabs. The body owns the hero, so it takes the hero's top
          padding. */}
      <div style={BODY_FRAME}>
        <div className="su-sheet-live-body">
          {/* No "View in the Reference" on a sheet. The app-wide builder is provided at
              the root (GameDataReady), and every full entity card renders it in
              its foot band — which on a sheet is EVERY installed system, module
              and piece of equipment. A sheet is a play surface you read down,
              not an index you navigate out of, so the link was a per-card exit
              hatch repeated dozens of times. Overriding the context to
              `undefined` for the sheet BODY turns it off for the whole subtree
              (including card detail modals, which are descendants) while the
              roster, Play and wizards keep it. */}
          <EntityExternalLinkProvider value={undefined}>
            {out && (
              // A state the sheet is in, not an error: a polite status (chrome K8).
              <p role="status" style={OUT_NOTE}>
                {out.note}
              </p>
            )}
            {renderBody()}
          </EntityExternalLinkProvider>
        </div>
      </div>
    </main>
  )
}
