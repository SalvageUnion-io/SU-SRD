import type { ReactNode } from 'react'
import type { EntityArt } from 'salvageunion-reference'
import type { StatItem } from '../containers/statsBarTypes'
import { TitledBox } from '../containers/TitledBox'
import { useEntitySurface } from './entitySurfaceContext'
import { Art } from './parts/Art'
import { Chips } from './parts/Chips'
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
 * INFO CUTOUT — a `TitledBox` that carries an entity's art and facts: the art column
 * ruled off in ink, the facts as chips beside the name on the cut-out, and a
 * paper body that takes any content. A sheet's Chassis card and its Holds
 * wear it (owner's call, 2026-10-14), so a panel and a list row are one block.
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
          <Chips chips={{ durations: [], facts, tags: [] }} size="compact" />
        )}
      </>
    ) : undefined
  return (
    <TitledBox
      as="section"
      title={title}
      label={label}
      paint={paint}
      chips={chips}
      art={art && <Art art={art} />}
      body={flush ? 'flush' : 'padded'}
    >
      {children}
    </TitledBox>
  )
}
