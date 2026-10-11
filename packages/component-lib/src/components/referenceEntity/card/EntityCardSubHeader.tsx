import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { color, fontSize, space } from '../../../design/tokens'
import type { CardSize } from '../../shared/displayMode'
import { EntityTooltip } from '../EntityTooltip'

/** One segment of the "//" line — a trait, an action facet or a datavalue
 * (`label` with an optional `value`; label-only for a keyword like "Immobile").
 * The MODIFIED-STATS language marks a segment a choice or the Tech Level
 * changed (`borderColor`) or added (`labelBg`). */
export type EntityCardSubHeaderCell = {
  key: string
  label: string
  value?: string | number
  /** Marks an upgraded stat (the modified-stats language). */
  borderColor?: string
  /** Marks an added / modified trait. */
  labelBg?: string
  /**
   * The rules entity this cell NAMES — a trait ("Explosive"), a keyword. When
   * set, the segment summons that entity's hovercard on hover, the same as an
   * in-prose `[[trait]]` reference does. Unresolvable refs render as plain text,
   * so a cell never loses its reading to a missing entity.
   */
  entityRef?: { schemaName: SURefEnumSchemaName; name: string }
}

type EntityCardSubHeaderProps = {
  /** The segments — entity traits, or an action's type / range / damage / traits. */
  cells: EntityCardSubHeaderCell[]
  /** A node leading the line — the "Suggested" stamp on a recommended pick. */
  leading?: ReactNode
  size: CardSize
}

/** Padding by size: the line sits a few pixels above the body (board E1). */
const PAD: Record<CardSize, string> = {
  large: `${space[8]} ${space[14]} 0`,
  medium: `${space[6]} ${space[10]} 0`,
  small: `${space[4]} ${space[8]} 0`,
}

const TYPE: Record<CardSize, string> = {
  large: fontSize.sm,
  medium: fontSize.caption,
  small: fontSize.xs,
}

/**
 * The "//" line — the book's italic trait / meta line, under a card's header
 * or an inline action's band (ruleset §5): "Dependable // Salvaging",
 * "Turn Action // Range: Close // Damage: 1 SP // Melee".
 *
 * Ink-2 italic on paper, with NO rule under it: it sits a few pixels above the
 * description so the two read as one block. (It replaced the darker tone
 * band the sub-header used to be.)
 */
export function EntityCardSubHeader({ cells, leading, size }: EntityCardSubHeaderProps) {
  if (!leading && cells.length === 0) return null

  // Each cell's `label value` pairing is punctuated by kind:
  //   - a MEASURED cell reads "Range: Close" / "Damage: 4 SP";
  //   - a TRAIT always parenthesises its value — "Explosive (1)", "Uses
  //     (Destroy)" — as the book prints every qualified trait;
  //   - any other numeric value reads "Label (4)";
  //   - a label-only keyword is unchanged.
  const COLON_CELLS = new Set(['range', 'damage'])
  const cellToText = (cell: EntityCardSubHeaderCell) => {
    if (cell.value == null || cell.value === '') return cell.label
    if (COLON_CELLS.has(cell.key) || cell.label === 'Range' || cell.label === 'Damage') {
      return `${cell.label}: ${cell.value}`
    }
    const isTrait = cell.key.startsWith('trait-')
    const isNumeric = typeof cell.value === 'number' || /^\d+$/.test(String(cell.value))
    if (isTrait || isNumeric) return `${cell.label} (${cell.value})`
    return `${cell.label} ${cell.value}`
  }
  // A segment that NAMES a rules entity keeps that entity's hovercard, as an
  // in-prose `[[trait]]` reference does.
  const parts = cells.map((cell) => {
    const text = cellToText(cell)
    if (!cell.entityRef) return { key: cell.key, node: text as ReactNode }
    return {
      key: cell.key,
      node: (
        <EntityTooltip
          schemaName={cell.entityRef.schemaName}
          entityName={cell.entityRef.name}
          openDelay={300}
        >
          <span style={{ cursor: 'help' }}>{text}</span>
        </EntityTooltip>
      ) as ReactNode,
    }
  })

  const line: CSSProperties = {
    alignItems: 'center',
    color: color.ink2,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: TYPE[size],
    fontStyle: 'italic',
    gap: space[6],
    lineHeight: 1.35,
    padding: PAD[size],
  }

  return (
    <div style={line}>
      {leading}
      {parts.length > 0 && (
        <span>
          {parts.map((part, i) => (
            <Fragment key={part.key}>
              {i > 0 && ' // '}
              {part.node}
            </Fragment>
          ))}
        </span>
      )}
    </div>
  )
}
