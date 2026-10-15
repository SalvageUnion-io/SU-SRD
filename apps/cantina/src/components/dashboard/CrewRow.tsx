/**
 * CrewRow — one crewmate, drawn the same on every crew list (the Dashboard's
 * Crew tab, the Mediator's table): the pilot as the library Row with HP and
 * AP as label-first chips (`HP | 8/10`), then a foot with their mech as a
 * Token (`SP | 6/9`; "Parked" when they are not aboard) or where they are on
 * foot, and their status ("Fine", or ▲ and what is wrong).
 *
 * A crewmate with a problem takes an outline in the bad hue around the whole
 * entry, and the ▲ word always comes with it, so colour is never the only
 * signal. The host picks the Row's mode: a link to the sheet, or select.
 */

import type { EntityMode } from 'component-lib'
import { Entity, Stat } from 'component-lib'
import { color, font, fontSize, radius, space, weight } from 'component-lib/design/tokens'
import type { CSSProperties, ReactNode } from 'react'
import { unitRowModel } from '../../lib/units/unitModel'
import { crewProblem } from './crewProblem.model'
import type { CrewLine } from './useGameFeed'

const ENTRY = {
  borderRadius: radius.card,
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
  minWidth: 0,
} satisfies CSSProperties

/** The "look here" ring, outside the Row's own frame so nothing changes size. */
const ATTENTION = {
  ...ENTRY,
  outline: `2px solid ${color.statusBad}`,
  outlineOffset: '2px',
} satisfies CSSProperties

const FOOT = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${space[4]} ${space[8]}`,
  minWidth: 0,
  paddingInline: space[2],
} satisfies CSSProperties

const TEXT = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontVariantNumeric: 'tabular-nums',
} satisfies CSSProperties

const FINE = { ...TEXT, color: color.ink75 } satisfies CSSProperties

const PROBLEM = { ...TEXT, fontWeight: weight.bold } satisfies CSSProperties

/** The ▲ is the one mark in the bad hue; the words stay ink. */
const MARK = { color: color.statusBad } satisfies CSSProperties

export function CrewRow({
  line,
  mode,
  status,
  controls,
  after,
}: {
  line: CrewLine
  mode: EntityMode
  /** The status words; `crewProblem(line)` unless the host shortens them. */
  status?: string | null
  /** The Row's controls (a View link where the Row itself selects). */
  controls?: ReactNode
  /** Under the foot: what they are resolving, announced as it changes. */
  after?: ReactNode
}) {
  const problem = status === undefined ? crewProblem(line) : status
  const mech = line.unitMech
  return (
    <div style={line.attention ? ATTENTION : ENTRY}>
      <Entity
        form="row"
        model={unitRowModel({
          kind: 'pilot',
          name: line.name,
          readings: [
            { label: 'HP', value: line.hp },
            { label: 'AP', value: line.ap },
          ],
        })}
        mode={mode}
        labels={
          line.self ? <Stat orientation="horizontal" label="You" size="compact" /> : undefined
        }
        controls={controls}
      />
      <div style={FOOT}>
        {mech === null ? (
          <span style={TEXT}>{line.where}</span>
        ) : (
          <Entity
            form="token"
            model={unitRowModel({
              kind: 'mech',
              name: mech.name,
              note: mech.boarded ? undefined : 'Parked',
              readings: [{ label: 'SP', value: mech.sp }],
            })}
          />
        )}
        {problem === null ? (
          <span style={FINE}>Fine</span>
        ) : (
          <span style={PROBLEM}>
            <span style={MARK} aria-hidden="true">
              ▲{' '}
            </span>
            {problem}
          </span>
        )}
      </div>
      {after}
    </div>
  )
}
