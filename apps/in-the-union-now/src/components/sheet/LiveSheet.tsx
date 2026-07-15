/**
 * LiveSheet — the Header C shared sheet shell (design §4.1, plan 4.1).
 * One shell, three variants, "so the three screens cannot drift apart".
 *
 * Render-prop contract (binding, plan 4.1):
 *   { variant, name, strip, back, rail, condense, cardActions,
 *     renderHero, renderBody, syncStats }
 *
 * App bar (poster `.appbar`, design source clean-pilot.html): back + overflow
 * are bordered 38px icon buttons either side of the SU cargo mark. At rest the
 * bar is a slim interactive strip (back + actions only); the entity name lives
 * once, in the poster hero below.
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

import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Pill, StatDisplay } from 'suref-react'
import type { PillTone, StatTone } from 'suref-react'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

import { SHEET_ICONBTN_CLASS } from './sheetChrome'

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
   * bar keeps only the priority readouts (design review U-5 — Heat + SP
   * first; EP/Hold fold on phones). Defaults to true (always shown).
   */
  mobilePriority?: boolean
}

type LiveSheetHeroContext = {
  /** Must reach the hero root element — the condense sentinel observes it. */
  heroRef: RefObject<HTMLElement | null>
  /** The rail strip — slot into the hero frame (SheetHero `rail` prop). */
  rail: ReactNode
}

type LiveSheetBodyContext = {
  cardActions: 'card' | 'rail'
}

type LiveSheetProps = {
  variant: SheetVariant
  name: string
  /** Condensed-bar MiniStat readouts (values live, from the entity record). */
  strip?: LiveSheetStripItem[]
  back?: { href: string; label: string }
  /** Kind/status pill shown next to the name stamp in the condensed bar. */
  pill?: { label: string; tone?: PillTone }
  /** Linked-entity rail content (RailChip / RailEmpty row) — slotted into the hero by the caller. */
  rail?: ReactNode
  /**
   * Mobile segmented Pilot/Mech/Crawler switch (design §3.7) — rendered as a
   * full-width row of flex-1 sm btns under the top-bar controls, visible only
   * below the sm breakpoint (the 390 endpoint). Provided by the caller for
   * wired compositions; omit to hide.
   */
  segments?: LiveSheetSegment[]
  /** Sticky condense bar on scroll (default true — shipped tweak default). */
  condense?: boolean
  /** Erow action placement (default 'card' — shipped tweak default). */
  cardActions?: 'card' | 'rail'
  renderHero: (ctx: LiveSheetHeroContext) => ReactNode
  renderBody: (ctx: LiveSheetBodyContext) => ReactNode
  /** Derived stat overlays merged onto strip items by key (e.g. {cargo: used}). */
  syncStats?: Record<string, number>
  /** Trailing top-bar actions (Share/Publish). */
  actions?: ReactNode
  className?: string
}

/** Sticky bar height — the IntersectionObserver top inset (design: 58/66px). */
const BAR_HEIGHT_PX = 58

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

/** Design §2.4 `.btn.btn--sm` recipe as utilities, shared by both segment states. */
const SEGMENT_BTN_CLASS =
  'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[3px] border-chrome px-[11px] py-[6px] font-body text-xs font-medium tracking-[0.01em] no-underline transition-colors duration-[120ms]'

/** App-bar name stamp (poster `.barname .stamp`): black-on-ink, ~15px. */
const BARNAME_STAMP_CLASS =
  'block max-w-full truncate bg-ink px-2 pb-[3px] pt-[2px] font-cond text-[15px] font-bold uppercase leading-[1.5] tracking-[0.045em] text-paper'

export function LiveSheet({
  variant,
  name,
  strip = [],
  back,
  pill,
  rail,
  segments,
  condense = true,
  cardActions = 'card',
  renderHero,
  renderBody,
  syncStats,
  actions,
  className,
}: LiveSheetProps) {
  const heroRef = useRef<HTMLElement | null>(null)
  const condensed = useCondensed(heroRef, condense)

  const stripItems = strip.map((item) => ({
    ...item,
    value: syncStats?.[item.key] ?? item.value,
  }))

  return (
    <div
      className={cn(`sheet--${variant}`, 'min-h-screen', className)}
      style={{ background: 'var(--ground)' }}
      data-variant={variant}
    >
      {/* Top bar — <header> is a print-stylesheet target (nav-hide rule). */}
      <header
        className={cn(
          'sticky top-0 z-20 flex min-h-[58px] flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink px-4 py-2 sm:px-[30px]',
          condensed && 'shadow-[0_2px_0_var(--color-ink),0_14px_20px_-18px_rgba(40,32,25,0.55)]'
        )}
        style={{ background: 'var(--ground-2)' }}
      >
        {back && (
          <>
            {/* Back — a bordered 38px icon button (poster `.iconbtn`), icon
                only; the accessible name carries the destination. */}
            <AppLink
              href={back.href}
              aria-label={`Back to ${back.label.toLowerCase()}`}
              className={cn(SHEET_ICONBTN_CLASS, 'no-underline')}
            >
              <ArrowLeft className="size-[18px]" aria-hidden="true" />
            </AppLink>
            {/* SU cargo mark anchors the sheet's own chrome; the global
                AppHeader (brand chrome) sits above this sticky bar. */}
            <img
              src="/logos/su-cargo-dark.svg"
              alt=""
              width={28}
              height={28}
              className="block size-7 shrink-0 rounded-[2px]"
            />
          </>
        )}

        {/* Condensed identity + live MiniStat strip. At rest this is hidden —
            the entity name lives once, in the poster hero below (§4.1, Option
            A). Once the hero scrolls out of view it fades in the name stamp +
            kind pill + at-a-glance readouts (poster `.barname` + `.kindpill`)
            so the anchored bar keeps them in view (S11). */}
        {condense && (
          <div
            aria-hidden={!condensed}
            className={cn(
              'flex min-w-0 flex-wrap items-center gap-2 transition-[opacity,transform] duration-150',
              condensed
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-[5px] opacity-0'
            )}
          >
            <span className={BARNAME_STAMP_CLASS}>{name}</span>
            {pill && <Pill tone={pill.tone}>{pill.label}</Pill>}
            {stripItems.map((item) => (
              <StatDisplay
                key={item.key}
                orientation="horizontal"
                dots
                label={item.label}
                value={item.value}
                max={item.max}
                tone={item.stat}
                // U-5: non-priority readouts fold below sm so the condensed
                // bar leads with Heat + SP on phones.
                className={item.mobilePriority === false ? 'hidden sm:inline-flex' : undefined}
              />
            ))}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2.5">{actions}</div>

        {/* Mobile segmented Pilot/Mech/Crawler switch (design §3.7) — full-width
            second row inside the sticky bar so it stays thumb-reachable. The
            active segment is the sheet being viewed (rust fill, white text);
            the others navigate to their wired counterpart's sheet. */}
        {segments && segments.length > 1 && (
          <nav
            aria-label="Wired sheets"
            className="order-last flex w-full gap-2 pb-1 sm:hidden print:hidden"
          >
            {segments.map((segment) =>
              segment.active ? (
                <span
                  key={segment.key}
                  aria-current="page"
                  className={cn(SEGMENT_BTN_CLASS, 'border-rust bg-rust text-paper')}
                >
                  {segment.label}
                </span>
              ) : (
                <AppLink
                  key={segment.key}
                  href={segment.href}
                  className={cn(SEGMENT_BTN_CLASS, 'border-ink bg-paper text-ink hover:bg-wk-bg-2')}
                >
                  {segment.label}
                </AppLink>
              )
            )}
          </nav>
        )}
      </header>

      {/* Hero band — the rail is passed through so the hero slots it inside
          its own frame (design: hero rail strip sits under the band, inside
          the 3px entity border). */}
      <div className="px-4 pb-1.5 pt-4 sm:px-[30px] sm:pt-[22px]">
        {renderHero({ heroRef, rail })}
      </div>

      {/* Body slabs — extra phone bottom padding when the FAB floats so the
          last card's controls stay reachable behind the thumb zone. */}
      <div className={cn('px-4 pb-[34px] pt-[18px] sm:px-[30px] sm:pb-[60px] sm:pt-6')}>
        {renderBody({ cardActions })}
      </div>
    </div>
  )
}
