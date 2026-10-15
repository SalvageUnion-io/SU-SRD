import type { ReactNode } from 'react'
import type { EntityArt } from 'salvageunion-reference'
import type { StatItem } from '../containers/statsBarTypes'
import { useEntitySurface } from './entitySurfaceContext'
import { Art } from './parts/Art'
import { Chips } from './parts/Chips'
import { Head } from './parts/Head'
import { paintFor } from './parts/paint'

type InfoCutoutProps = {
  title: string
  /** Names the panel (`aria-label`), when the title alone does not ("Chassis"). */
  label?: string
  /** The band's tone token (`mech`, `tl1`, …) or `ink` (the default). */
  fill?: string
  /** The art column, where there is art and room (a Row's, E10). */
  art?: EntityArt
  /** `label | value` facts, as chips on the band beside the name. */
  facts?: StatItem[]
  /** Anything else riding the band right of the name (a meta line). */
  aside?: ReactNode
  /** The body takes its content edge to edge (content that rules its own bands). */
  flush?: boolean
  /** The paper body. */
  children?: ReactNode
}

/**
 * INFO CUTOUT — the Row's container block (`Row`: the Starter Set and Shelves
 * listings) for a panel that is not a listed entity: the art column ruled off
 * in ink, the band with its name on the paper cut-out and its chips beside
 * it, and a paper body that takes any content. A sheet's Chassis card and its
 * Holds wear it (owner's call, 2026-10-14), so a panel and a list row are one
 * block.
 */
export function InfoCutout({
  title,
  label,
  fill = 'ink',
  art,
  facts,
  aside,
  flush = false,
  children,
}: InfoCutoutProps) {
  const surface = useEntitySurface()
  const paint = paintFor(fill, { texture: surface.texture })
  const chips =
    (facts && facts.length > 0) || aside ? (
      <>
        {aside}
        {facts && facts.length > 0 && (
          <Chips chips={{ durations: [], facts, tags: [] }} rung="compact" onInk={paint.ink} />
        )}
      </>
    ) : undefined
  return (
    <section aria-label={label ?? title} className="su-entity-row su-info-cutout">
      <div className="su-entity-row__frame" data-bodyless={!children || undefined}>
        {art && <Art art={art} />}
        <div className="su-entity-row__main">
          <Head title={title} paint={paint} chips={chips} notch chipsBeside />
          {children && (
            <div className="su-info-cutout__body" data-flush={flush || undefined}>
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
