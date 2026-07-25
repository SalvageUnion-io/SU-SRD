/**
 * LiveSheet — the Header C shared sheet shell (design §4.1, plan 4.1).
 * One shell, three variants, "so the three screens cannot drift apart".
 *
 * Render-prop contract (binding, plan 4.1):
 *   { variant, name, strip, back, rail, condense,
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
import { Badge, buttonVariants, Stat } from 'component-lib'
import type { BadgeTone, StatTone } from 'component-lib'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

import { SHEET_ICONBTN_CLASS } from 'component-lib'

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
  /**
   * The condense sentinel ref. Sheets that own their identity band inside the
   * BODY (no `renderHero`) wrap that band's frame with this so the sticky bar
   * still condenses when the band scrolls away (Workshop-Manual layout).
   */
  heroRef: RefObject<HTMLElement | null>
}

type LiveSheetProps = {
  variant: SheetVariant
  name: string
  /** Condensed-bar MiniStat readouts (values live, from the entity record). */
  strip?: LiveSheetStripItem[]
  back?: { href: string; label: string }
  /**
   * Kind/status pill. NO LONGER RENDERED in the bar: the gutter wordmark names
   * the sheet's kind permanently, and repeating it in the condensed bar said
   * the same word twice on one screen. Kept on the type because callers still
   * pass it and a status pill may earn a place here later.
   */
  pill?: { label: string; tone?: BadgeTone }
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
  /**
   * The hero band. Optional: Workshop-Manual sheets fold their identity band
   * into the BODY's first region (so identity + vitals stay in one component
   * with their handlers), pass no `renderHero`, and wrap that band with the
   * `heroRef` handed to `renderBody` instead.
   */
  renderHero?: (ctx: LiveSheetHeroContext) => ReactNode
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

export function LiveSheet({
  variant,
  name,
  strip = [],
  back,
  rail,
  segments,
  condense = true,
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
      {/* Top bar — <header> is a print-stylesheet target (nav-hide rule).
          Always present (its back/share/overflow controls are always wanted),
          but UNSEAMED at rest: no bottom border while the sheet's own identity
          block is still on screen, so the bar reads as part of the page rather
          than as a lid on it. Scrolling past that block draws the border (and
          the drop shadow) and fades in the condensed name + vitals.

          `z-40`, above the entity cards' control rails (`z-30`): those rails
          ride their card's top edge and were sliding OVER the sticky bar as
          they scrolled under it.

          Tinted with the same wash the ENTITY ROWS use — a 10% tone over paper,
          not the full tone — so it reads as this entity's chrome without
          fighting the ink on it. */}
      <header
        className={cn(
          'sticky top-0 z-40 flex min-h-[58px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 transition-[border-color,box-shadow] duration-150 sm:px-[30px]',
          condensed
            ? 'border-b-2 border-ink shadow-[0_2px_0_var(--color-ink),0_14px_20px_-18px_var(--color-ink-50)]'
            : 'border-b-2 border-transparent'
        )}
        style={{ background: 'color-mix(in srgb, var(--tone) 10%, var(--color-paper))' }}
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
            <Badge shape="stamp" size="full" className="block max-w-full truncate">
              {name}
            </Badge>
            {stripItems.map((item) => (
              <Stat
                key={item.key}
                orientation="horizontal"
                label={item.label}
                value={item.max !== undefined ? `${item.value}/${item.max}` : item.value}
                // U-5: non-priority readouts fold below sm so the condensed
                // bar leads with Heat + SP on phones.
                className={item.mobilePriority === false ? 'hidden sm:inline-flex' : undefined}
              />
            ))}
          </div>
        )}

        {/* A badge-level jump to the linked units, which sit at the very foot
            of the sheet — the one thing you scroll past everything to reach. */}
        <AppLink href="#linked-units" className="no-underline" aria-label="Jump to linked units">
          <Badge shape="chip" surface="outline">
            Linked Units
          </Badge>
        </AppLink>

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
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'compact' }),
                    'flex-1 no-underline'
                  )}
                >
                  {segment.label}
                </span>
              ) : (
                <AppLink
                  key={segment.key}
                  href={segment.href}
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'compact' }),
                    'flex-1 no-underline'
                  )}
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
          the 3px entity border). Optional: Workshop-Manual sheets own their
          identity band in the body and pass no renderHero. */}
      {renderHero && (
        <div className="px-4 pb-1.5 pt-4 sm:px-[30px] sm:pt-[22px]">
          {renderHero({ heroRef, rail })}
        </div>
      )}

      {/* Body slabs — extra phone bottom padding when the FAB floats so the
          last card's controls stay reachable behind the thumb zone. When the
          body owns the hero (no renderHero), it takes the hero's top padding. */}
      <div className="relative">
        {/* Edge wordmark — PILOT / MECH / CRAWLER running up the page gutter.
            It sits in the shell's own padding, outside the content column, so
            it differentiates the sheet at a glance without taking part in (or
            stealing width from) the content. Sticky, so it stays with you as
            the sheet scrolls. Hidden below xl, where the gutter is only wide
            enough for the content's own breathing room. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[68px] select-none xl:block"
        >
          {/* The glyphs are as tall as the gutter is wide — in vertical writing
              the font-size IS the column width, so one value drives both and the
              wordmark can never outgrow or rattle around in its channel.
              It sticks BELOW the bar (`top-[58px]`, the bar's own min-height)
              so it travels with the sheet instead of scrolling away: the block
              runs bottom-to-top, so its top edge is the word's LAST letter,
              which sits tucked right under the bar. */}
          <span
            className="sticky top-[58px] block rotate-180 text-center font-cond text-[68px] font-extrabold uppercase leading-none tracking-caps-tight opacity-45 [writing-mode:vertical-rl]"
            style={{ color: 'var(--tone-deep)' }}
          >
            {variant}
          </span>
        </span>
        <div
          className={cn(
            'px-4 pb-[34px] sm:px-[30px] sm:pb-[60px] xl:pl-[84px]',
            renderHero ? 'pt-[18px] sm:pt-6' : 'pt-4 sm:pt-[22px]'
          )}
        >
          {renderBody({ heroRef })}
        </div>
      </div>
    </div>
  )
}
