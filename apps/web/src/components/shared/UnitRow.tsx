/**
 * UnitRow — a player unit (pilot, mech, crawler, NPC) in a list: the library
 * Row (`<Entity form="row">`) over `unitRowModel`, with the host's controls in
 * its head's trailing slot (EDL E7). The name sits on the Row's paper
 * cut-out, the readings are label-first chips (`SP | 9/9`), the note and any
 * host labels (an owner seal, ★ Primary, HOMEBREW) sit right of the title
 * (ruleset §3.9, §7.2), and View / Unassign are the last controls.
 *
 * View is a control rather than the Row's own link because the Row carries
 * other controls (Assign, Make a copy): a host that wants the whole Row to
 * open passes a `mode` instead.
 */

import { Unlink } from 'lucide-react'
import type { ReactNode } from 'react'
import { iconSize } from '../../design/tokens'
import type { UnitKind, UnitReading } from '../../lib/units/unitModel'
import { unitChipOf, unitRowModel } from '../../lib/units/unitModel'
import type { EntityMode, TagItem } from '../index'
import { Button, Entity, relation, Stat } from '../index'

type UnitRowProps = {
  kind: UnitKind
  name: string
  /** A stamp right of the name that says more than the kind ("Home Crawler"). */
  note?: string | undefined
  readings?: readonly UnitReading[] | undefined
  /** A player-made unit (an NPC): dashed, its name quoted, HOMEBREW (§3.9). */
  userMade?: boolean
  /** Labels after the note (an owner seal, ★ Primary). */
  labels?: ReactNode
  /** The units it is linked to, relation chips after its readings (`chips-and-actions.md` C11). */
  relations?: TagItem[]
  /** The host's last chip, on the name's line: the unit's "⋯" menu. */
  trailing?: ReactNode
  /** The unit's sheet: a View control. Omit when there is nothing to open. */
  href?: string | undefined
  /** Ends the assignment (never deletes the unit). Omit to hide it. */
  onUnassign?: (() => void) | undefined
  /** Controls before View and Unassign (Assign, Make a copy). */
  controls?: ReactNode
  /** Default `read`: the controls are the Row's doors. */
  mode?: EntityMode
}

export function UnitRow({
  kind,
  name,
  note,
  readings,
  userMade = false,
  labels,
  relations,
  trailing,
  href,
  onUnassign,
  controls,
  mode,
}: UnitRowProps) {
  const all =
    controls || href !== undefined || onUnassign ? (
      <>
        {controls}
        {href !== undefined && (
          <Button
            href={href}
            // The visible label is "View" on every row; the name says which
            // unit it opens (WCAG 2.4.4).
            aria-label={`View ${name}`}
            size="mini"
          >
            View
          </Button>
        )}
        {onUnassign && (
          <Button
            variant="ghost"
            size="mini"
            aria-label={`Unassign ${name}`}
            onClick={onUnassign}
            glyph={<Unlink size={iconSize.mini} />}
          >
            Unassign
          </Button>
        )}
      </>
    ) : undefined
  // Each reading in its class's lane (C2): the rank and measures are the
  // model's facts, kept to its budget (a roster's lead vital, C3); a relation,
  // a mark and a state are the Row's own chips.
  const byChip = (chip: string) => (readings ?? []).filter((r) => unitChipOf(r) === chip)
  const cell = (r: UnitReading) => (
    <Stat key={String(r.label)} label={r.label} value={r.value} size="compact" />
  )
  const allRelations = [
    ...byChip('relation').map((r) =>
      relation(`reading-${r.label}`, String(r.label), String(r.value))
    ),
    ...(relations ?? []),
  ]
  const marks = byChip('mark')
  const state = byChip('state')
  return (
    <Entity
      form="row"
      context="roster"
      model={unitRowModel({ kind, name, note, userMade, readings: readings ?? [] })}
      mode={mode}
      labels={marks.length > 0 ? [...(labels ? [labels] : []), ...marks.map(cell)] : labels}
      {...(allRelations.length > 0 ? { relations: allRelations } : {})}
      {...(state.length > 0 ? { state: state.map(cell) } : {})}
      trailing={trailing}
      controls={all}
    />
  )
}
