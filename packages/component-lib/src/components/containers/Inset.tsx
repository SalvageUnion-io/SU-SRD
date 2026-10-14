import type { CSSProperties, ReactNode } from 'react'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import { Head } from '../../entity/parts/Head'
import { paintFor } from '../../entity/parts/paint'

type InsetProps = {
  /** The name on the cut-out; it also names the head. */
  title: string
  /** What the cut-out shows in place of `title`'s text: a live sheet's inline-edit field. */
  titleContent?: ReactNode
  /** The band's tone token (`--color-<tone>`): an NPC's `adversary`. */
  tone: string
  /** The chips (horizontal `Stat` cells, E17), one group on the band right of the name. */
  chips?: ReactNode
  /** Inline style on the paper body (e.g. a grid of id lines). */
  bodyStyle?: CSSProperties
  children?: ReactNode
}

/**
 * Inset — a nested entity a live sheet writes into, drawn as the SRD draws
 * the same entity nested in a Card (`NpcInset`'s crew lead, a crawler bay's
 * NPC): the cut-out head in the entity's tone, the name on the paper tab and
 * its chips on the band right of it, over a paper body. It is the Row's frame
 * and `Head`, so a sheet's crew lead and the SRD's matching NPC read the same
 * (entity display language E15: no hand-built entity markup).
 *
 * The body holds what the sheet tracks (keepsake, motto, detail, facts), which
 * no reference model carries; that is why this is not a `Row` over a model.
 */
export function Inset({ title, titleContent, tone, chips, bodyStyle, children }: InsetProps) {
  const surface = useEntitySurface()
  const paint = paintFor(tone, { texture: surface.texture })
  // An inset with nothing to say below its head is just the head: no empty
  // paper strip under it (a read-state crew lead with every field blank).
  const hasBody = children !== null && children !== undefined && children !== false
  return (
    <div className="su-entity-row">
      <div className="su-entity-row__frame" data-bodyless={hasBody ? undefined : true}>
        <div className="su-entity-row__main">
          <Head
            title={title}
            titleContent={titleContent}
            paint={paint}
            chips={
              chips ? (
                <div data-chip-group="" className="su-chips">
                  {chips}
                </div>
              ) : undefined
            }
            notch
            chipsBeside
          />
          {hasBody && (
            <div className="su-entity-row__body" style={bodyStyle}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
