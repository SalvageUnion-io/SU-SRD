import type { CSSProperties, ReactNode } from 'react'
import type { ChipSet } from '../entity'
import { Chips } from '../entity'
import { RowBody } from '../entity/forms/RowFrame'
import { TitledBox } from './TitledBox'

const NO_CHIPS: ChipSet = { durations: [], facts: [], tags: [] }

type InsetProps = {
  /** The name on the cut-out; it also names the head. */
  title: string
  /** What the cut-out shows in place of `title`'s text: a live sheet's inline-edit field. */
  titleContent?: ReactNode
  /** The band's tone token (`--color-<tone>`): an NPC's `adversary`. */
  tone: string
  /** The chips that say what it is (a crew role), first on the band right of the name (E17). */
  marks?: ReactNode
  /** Its live reading (a crew member's `HP | 4/4`, with steppers in Edit), after them (C8). */
  state?: ReactNode
  /** Inline style on the paper body (e.g. a grid of id lines). */
  bodyStyle?: CSSProperties
  children?: ReactNode
}

/**
 * Inset — a nested entity a live sheet writes into, drawn as the SRD draws
 * the same entity nested in a Card (`NpcInset`'s crew lead, a crawler bay's
 * NPC): the cut-out head in the entity's tone, the name on the paper tab and
 * its chips on the band right of it, over a paper body. It is the Row's frame
 * and `Head` (through `TitledBox`) over the Row's own body (`RowBody`), so a
 * sheet's crew lead and the SRD's matching NPC read the same (entity display
 * language E15, hard rule R7: no hand-built entity markup).
 *
 * A `TitledBox` in the entity's tone. The body holds what the sheet tracks (keepsake, motto, detail, facts), which
 * no reference model carries; that is why this is not a `Row` over a model.
 */
export function Inset({
  title,
  titleContent,
  tone,
  marks,
  state,
  bodyStyle,
  children,
}: InsetProps) {
  // An inset with nothing to say below its head is just the head (`TitledBox`): no
  // empty paper strip under it (a read-state crew lead with every field blank).
  const hasBody = children !== null && children !== undefined && children !== false
  return (
    <TitledBox
      title={title}
      titleContent={titleContent}
      tone={tone}
      chips={
        marks || state ? (
          <Chips chips={NO_CHIPS} size="compact" marks={marks} state={state} />
        ) : undefined
      }
      body="flush"
    >
      {hasBody && <RowBody style={bodyStyle}>{children}</RowBody>}
    </TitledBox>
  )
}
