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
 * meta on every variant. The `rail` slot (linked-entity rail stitched inside
 * the frame's bottom edge) was the last hero-hosted region — crawler's
 * migration retired it, so it no longer exists here.
 */

import type { ReactNode, Ref } from 'react'
import { Badge } from '../chrome/Badge'
import { Stat } from '../shared/Stat'

import { cn } from '../../utils/cn'

type HeroIdentityLine = {
  label: string
  value: string
}

type SheetHeroProps = {
  /** Black category tab, e.g. 'PILOT'. */
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
  /** Extra inset under the trackers (e.g. Conditions). */
  inset?: ReactNode
  /**
   * Poster TOP REGION, left: the sheet's labeled IDENTITY block (IdentityField
   * grid with its own per-section Edit button). Slot-based — each sheet
   * supplies its own fields (redesign Task A.1).
   */
  identityBlock?: ReactNode
  /**
   * Poster TOP REGION, right: extra VITALS content beyond `trackers`
   * (e.g. a labeled gauge cluster). Rendered between trackers and inset.
   */
  vitals?: ReactNode
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
  inset,
  identityBlock,
  vitals,
  heroRef,
  className,
}: SheetHeroProps) {
  const identityLines = identity.filter((line) => line.value.trim().length > 0)
  const hasIdentityRegion = Boolean(specs || identityLines.length > 0 || identityBlock)
  const hasVitalsRegion = Boolean(trackers || vitals || inset)

  return (
    <section
      ref={heroRef}
      aria-label={`${name} sheet header`}
      className={cn('relative overflow-hidden rounded-card border-entity border-ink', className)}
      style={{ background: 'var(--tone)' }}
    >
      {/* Category tab — rides the top border like .ec__cat (StampSeam) */}
      <Badge shape="stamp" size="sm" seam className="left-[18px]">
        {cat}
      </Badge>

      {/* Band — poster top region: name row, then IDENTITY (left) vs VITALS
          (right). Collapses to a single-column stack on mobile in the poster's
          reading order (identity → vitals). */}
      <div className="flex flex-col gap-[18px] px-4 py-[18px] sm:px-5">
        <div className="min-w-0">
          <Badge
            shape="stamp"
            size="lg"
            as="h1"
            leading="leading-[1.28]"
            className="m-0 inline box-decoration-clone py-0 text-[26px] sm:text-[31px]"
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
                {identityBlock}
              </div>
            )}

            {hasVitalsRegion && (
              <div className="flex min-w-0 flex-col gap-2.5">
                {trackers && (
                  // Full-width vertical gauge stack (poster `.gauge` column): each
                  // gauge owns its row, dashed deep-40 separators between them.
                  <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
                    {trackers}
                  </div>
                )}
                {vitals}
                {inset}
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
  /** Muted header name, e.g. 'Slots'. */
  name?: string
  /** Black footer unit bar, e.g. 'SLOTS'. */
  unit?: string
  value: number
  max?: number
  /** Set false to suppress pips for big tracks (e.g. SYS 5/20). */
  pips?: boolean
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
          <Stat key={item.code} label={item.code} value={item.value} max={item.max} compact />
        )
        return item.onClick ? (
          <button
            key={item.code}
            type="button"
            aria-label={item.actionLabel ?? item.code}
            title={item.actionLabel}
            onClick={item.onClick}
            className="cursor-pointer rounded-card text-left transition-transform duration-[120ms] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25"
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
