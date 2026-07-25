/**
 * SheetHero — "the header IS the entity card writ large" (design §4.1, plan
 * 4.2). The hero is an entity-card frame at sheet scale: black category tab
 * overhanging a 3px ink border on the sheet tone, a black name chip, identity
 * mchips + quiet identity lines on the left vs the lg StatBlock tracker
 * cluster on the right, and an optional ChassisStats spec strip.
 *
 * Pure layout — all content arrives via slots so the three variant sheets
 * compose it without forking the frame. Identity/vitals/linked-unit-rail
 * content lives in each sheet's BODY poster regions now (Phase 2 — pilot,
 * mech, crawler all migrated); the hero itself carries only the name row +
 * meta on every variant.
 *
 * That migration left four slots behind that nothing ever filled again. The
 * `rail` slot went with crawler's migration; `inset`, `identityBlock` and
 * `vitals` outlived it as declared-but-unreachable props — every one of the
 * seven call sites had stopped passing them, and three sheet files carried
 * comments saying so while the props stayed on the type. They are gone now,
 * which is why the VITALS region is a plain gauge stack rather than a
 * three-child column: `trackers` is the only thing that was ever in it.
 */

import type { ReactNode, Ref } from 'react'
import { Badge } from '../chrome/Badge'
import { SheetSectionCard } from '../shared/SheetSectionCard'
import { Stat } from '../shared/Stat'

import { cn } from '../../utils/cn'
import { FOCUS_RING } from '../chrome/interaction'

type HeroIdentityLine = {
  label: string
  value: string
}

type SheetHeroProps = {
  /** Category, e.g. 'PILOT' — the edge wordmark in band mode, the black tab in legacy mode. */
  cat: string
  name: string
  /** mchip / pill row under the name. */
  meta?: ReactNode
  /** Quiet identity lines (BACKGROUND / MOTTO / …). Empty values skipped. */
  identity?: HeroIdentityLine[]
  /** ChassisStats spec strip (sm StatBlocks for static capacities). */
  specs?: ReactNode
  /** lg StatBlock tracker cluster (rendered inside the VITALS region). */
  trackers?: ReactNode
  /**
   * BAND MODE (Workshop-Manual identity band). When provided, the hero renders
   * the sheet's top region as TWO section cards side by side — a wide "thick"
   * card of identity FIELDS and a narrow "long" card of current/max GAUGES —
   * and DROPS the big name stamp (the name lives in its own field). `name`
   * still becomes the accessible `<h1>`. Legacy mode (name stamp +
   * `identity`/`specs`/`trackers`) is unchanged when `fields` is absent, so
   * snapshots and un-migrated sheets keep working.
   *
   * The two cards are `SheetSectionCard`s, the same container every other
   * input/gauge section on the sheet uses — so the card-vs-slab rule holds with
   * no third shape. The edge wordmark is NOT here: it belongs to the page
   * gutter (`LiveSheet`), outside the content column, so it differentiates the
   * sheet without occupying it.
   */
  fields?: ReactNode
  /** Band mode: the current/max gauge card (the narrow "long" one). */
  vitals?: ReactNode
  /** Band mode: title of the fields card. */
  fieldsTitle?: string
  /** Band mode: title of the gauges card (crawler passes 'Economy'). */
  vitalsTitle?: string
  /** Band mode: header-right controls (e.g. the identity Edit/Done toggle). */
  controls?: ReactNode
  /** Forwarded to the hero root for the shell's condense observer. */
  heroRef?: Ref<HTMLElement>
  className?: string
}

export function SheetHero({
  cat,
  name,
  meta,
  identity = [],
  specs,
  trackers,
  fields,
  vitals,
  fieldsTitle = 'Identity',
  vitalsTitle = 'Vitals',
  controls,
  heroRef,
  className,
}: SheetHeroProps) {
  // BAND MODE — the sheet's top region as TWO cards: a wide fields card and a
  // narrow gauges card. Drops the name stamp; the name is the accessible <h1>.
  // The wordmark is the page gutter's job (LiveSheet), not this region's.
  if (fields) {
    return (
      <section
        ref={heroRef}
        aria-label={`${name} sheet header`}
        // The gauges card is content-width ("long" — a narrow tall column);
        // the fields card takes the rest ("thick"). They stack on narrow
        // viewports so neither ever crushes.
        className={cn(
          'grid grid-cols-1 items-start gap-[22px] @3xl:grid-cols-[minmax(0,1fr)_260px] @3xl:gap-6',
          className
        )}
      >
        <h1 className="sr-only">{name}</h1>
        <SheetSectionCard title={fieldsTitle} count={meta} controls={controls}>
          {fields}
        </SheetSectionCard>
        {vitals && <SheetSectionCard title={vitalsTitle}>{vitals}</SheetSectionCard>}
      </section>
    )
  }

  const identityLines = identity.filter((line) => line.value.trim().length > 0)
  const hasIdentityRegion = Boolean(specs || identityLines.length > 0)
  const hasVitalsRegion = Boolean(trackers)

  return (
    <section
      ref={heroRef}
      aria-label={`${name} sheet header`}
      className={cn('relative overflow-hidden rounded-card border-entity border-ink', className)}
      style={{ background: 'var(--tone)' }}
    >
      {/* Category tab — rides the top border like .ec__cat (StampSeam) */}
      <Badge shape="stamp" size="mini" seam className="left-[18px]">
        {cat}
      </Badge>

      {/* Band — poster top region: name row, then IDENTITY (left) vs VITALS
          (right). Collapses to a single-column stack on mobile in the poster's
          reading order (identity → vitals). */}
      <div className="flex flex-col gap-[18px] px-4 py-[18px] sm:px-5">
        <div className="min-w-0">
          <Badge
            shape="stamp"
            size="full"
            as="h1"
            leading="leading-[1.28]"
            className="m-0 inline box-decoration-clone py-0 text-display sm:text-display-lg"
          >
            {name}
          </Badge>
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>

        {(hasIdentityRegion || hasVitalsRegion) && (
          <div
            className={cn(
              'grid grid-cols-1 gap-[18px]',
              hasIdentityRegion &&
                hasVitalsRegion &&
                'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-[22px]'
            )}
          >
            {hasIdentityRegion && (
              <div className="flex min-w-0 flex-col gap-3">
                {specs && <div className="flex flex-wrap items-center gap-2">{specs}</div>}
                {identityLines.length > 0 && (
                  <dl className="m-0 space-y-1">
                    {identityLines.map((line) => (
                      <div key={line.label} className="flex items-baseline gap-1.5">
                        <dt className="shrink-0 font-cond text-label font-bold uppercase leading-none tracking-caps text-ink">
                          {line.label}
                        </dt>
                        <dd
                          className="m-0 min-w-0 font-body text-xs leading-snug"
                          style={{ color: 'var(--tone-deep)' }}
                        >
                          {line.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}

            {hasVitalsRegion && (
              // Full-width vertical gauge stack (poster `.gauge` column): each
              // gauge owns its row, dashed deep-40 separators between them.
              <div className="flex w-full min-w-0 flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
                {trackers}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export type ChassisStatItem = {
  /** Header code, e.g. 'SYS'. */
  code: string
  value: number
  max?: number
  /**
   * Makes the lozenge actionable (design-review R-4: the UPKEEP/UPGRADE/TRADE
   * spec lozenges are the crawler-economy entry points) — the StatBlock is
   * wrapped in a button.
   */
  onClick?: () => void
  /** Accessible label + tooltip for the action, e.g. 'Pay Upkeep'. */
  actionLabel?: string
}

type ChassisStatsProps = {
  items: ChassisStatItem[]
  className?: string
}

/**
 * ChassisStats (design §2.10 `.hero__specs`): static-capacity readouts as a
 * strip of read-only sm StatBlocks inside the hero identity column.
 */
export function ChassisStats({ items, className }: ChassisStatsProps) {
  if (items.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-start gap-2', className)}>
      {items.map((item) => {
        const block = (
          <Stat key={item.code} label={item.code} value={item.value} max={item.max} size="mini" />
        )
        return item.onClick ? (
          <button
            key={item.code}
            type="button"
            aria-label={item.actionLabel ?? item.code}
            title={item.actionLabel}
            onClick={item.onClick}
            className={cn(
              'cursor-pointer rounded-card text-left transition-transform duration-[120ms] hover:-translate-y-px',
              FOCUS_RING
            )}
          >
            {block}
          </button>
        ) : (
          <span key={item.code}>{block}</span>
        )
      })}
    </div>
  )
}
