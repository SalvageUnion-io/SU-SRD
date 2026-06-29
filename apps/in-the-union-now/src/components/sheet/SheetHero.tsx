/**
 * SheetHero — "the header IS the entity card writ large" (design §4.1, plan
 * 4.2). The hero is an entity-card frame at sheet scale: black category tab
 * overhanging a 3px ink border on the sheet tone, a black name chip, identity
 * mchips + quiet identity lines on the left vs the lg StatBlock tracker
 * cluster on the right, an optional ChassisStats spec strip, and the linked-
 * entity rail strip stitched inside the frame's bottom edge.
 *
 * Pure layout — all content arrives via slots so the three variant sheets
 * compose it without forking the frame.
 */

import type { ReactNode, Ref } from 'react'
import { StatBlock } from 'suref-react'

import { cn } from '../../lib/utils'

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
  /** lg StatBlock tracker cluster (right column). */
  trackers?: ReactNode
  /** Extra inset under the trackers (e.g. Conditions). */
  inset?: ReactNode
  /** Linked-entity rail strip — rendered inside the frame, under the band. */
  rail?: ReactNode
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
  rail,
  heroRef,
  className,
}: SheetHeroProps) {
  const identityLines = identity.filter((line) => line.value.trim().length > 0)

  return (
    <section
      ref={heroRef}
      aria-label={`${name} sheet header`}
      className={cn('relative overflow-hidden rounded-[3px] border-[3px] border-ink', className)}
      style={{ background: 'var(--tone)' }}
    >
      {/* Category tab — overhangs the top border like .ec__cat */}
      <span className="absolute -top-px left-[18px] bg-ink px-[7px] pb-px pt-[2px] font-cond text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-su-white">
        {cat}
      </span>

      {/* Band: identity column vs tracker cluster */}
      <div className="flex flex-wrap gap-x-[22px] gap-y-[18px] px-4 pb-[15px] pt-6 sm:px-5">
        <div className="min-w-0 flex-[1_1_300px]">
          <h1 className="m-0 inline bg-ink box-decoration-clone px-2 font-cond text-[26px] font-bold uppercase leading-[1.28] text-su-white sm:text-[31px]">
            {name}
          </h1>
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
          {specs && <div className="mt-3 flex flex-wrap items-center gap-2">{specs}</div>}
          {identityLines.length > 0 && (
            <dl className="mt-3 space-y-1">
              {identityLines.map((line) => (
                <div key={line.label} className="flex items-baseline gap-1.5">
                  <dt className="shrink-0 font-cond text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-ink">
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

        {(trackers || inset) && (
          <div className="flex flex-col items-end gap-2.5 sm:ml-auto">
            {trackers && <div className="flex flex-wrap justify-end gap-2">{trackers}</div>}
            {inset}
          </div>
        )}
      </div>

      {/* Rail strip — inside the frame, stitched under the band */}
      {rail && (
        <div
          className="flex flex-col gap-3 border-t-2 border-ink px-3 py-3 sm:flex-row sm:px-4"
          style={{ background: 'var(--ground-2)' }}
        >
          {rail}
        </div>
      )}
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
      {items.map((item) => (
        <StatBlock
          key={item.code}
          code={item.code}
          name={item.name}
          unit={item.unit}
          size="sm"
          value={item.value}
          max={item.max}
          pips={item.pips ?? true}
          editable={false}
        />
      ))}
    </div>
  )
}
