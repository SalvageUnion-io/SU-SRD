/**
 * WhoCanSee — the one "Who can see it" control, for every kind a player can
 * share: pilot, mech, crawler, built NPC and mech pattern.
 *
 * Three stacked radios in the same words everywhere — Only me, My Game's crew,
 * Anyone with the link (`lib/sharing/visibility.ts`). An answer the thing
 * cannot take where it is now stays on screen, disabled, with the reason in
 * its hint: a choice that silently vanished would read as one that does not
 * exist.
 *
 * Presentational: it holds no state and writes nothing. `ShareSettings` wires it
 * to the server for a thing that exists; the Save as pattern page holds the
 * choice until it saves.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Radio, tokens } from '../../../ui/index'
import type { Visibility, VisibilityChoice } from '../../lib/sharing/visibility'

const FIELDSET = {
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

const LEGEND = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  marginBottom: tokens.space[8],
  padding: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

type WhoCanSeeProps = {
  /** The radio group's name: unique on the page. */
  name: string
  choices: readonly VisibilityChoice[]
  /** The current answer; null while it is still loading. */
  value: Visibility | null
  onChange: (next: Visibility) => void
  /** Every answer is locked, e.g. while a write is in flight. */
  disabled?: boolean
  /** Below the answers: the Save as pattern page's Game picker. */
  children?: ReactNode
}

export function WhoCanSee({ name, choices, value, onChange, disabled, children }: WhoCanSeeProps) {
  return (
    <fieldset style={FIELDSET} disabled={disabled || value === null}>
      <legend style={LEGEND}>Who can see it</legend>
      {choices.map((choice) => (
        <Radio
          key={choice.value}
          stacked
          name={name}
          value={choice.value}
          checked={value === choice.value}
          onChange={() => onChange(choice.value)}
          disabled={choice.disabled}
          label={choice.label}
          description={choice.description}
        />
      ))}
      {children}
    </fieldset>
  )
}
