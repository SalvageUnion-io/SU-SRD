/**
 * WhoCanSee — the one "Who can see it" control, for every kind a player can
 * share: pilot, mech, crawler, built NPC and mech pattern.
 *
 * Three stacked radios in the same words everywhere — Only me, My Game's crew,
 * Public (`lib/sharing/visibility.ts`). The chosen answer may open onto what
 * goes with it (`details`): Public's link, QR and Reference switch, inside its
 * own frame. An answer the thing
 * cannot take where it is now stays on screen, disabled, with the reason in
 * its hint: a choice that silently vanished would read as one that does not
 * exist.
 *
 * Presentational: it holds no state and writes nothing. `ShareSettings` wires it
 * to the server for a thing that exists; the Save as pattern page holds the
 * choice until it saves.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Eyebrow, Radio, tokens } from '../../components/index'
import type { Visibility, VisibilityChoice } from '../../lib/sharing/visibility'
import { buildSharingCopy } from '../../messages/build-sharing'

const FIELDSET = {
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

/** A chosen answer with details: the checked row's frame, drawn around both. */
const OPEN_FRAME = {
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.entityCompact,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: `calc(${tokens.space[8]} - (${tokens.borderWidth.entityCompact} - ${tokens.borderWidth.chrome}))`,
} satisfies CSSProperties

const LEGEND = {
  marginBottom: tokens.space[8],
  padding: 0,
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
  /** What opens inside an answer's frame while it is the chosen one. */
  details?: Partial<Record<Visibility, ReactNode>>
}

export function WhoCanSee({
  name,
  choices,
  value,
  onChange,
  disabled,
  children,
  details,
}: WhoCanSeeProps) {
  return (
    <fieldset style={FIELDSET} disabled={disabled || value === null}>
      <Eyebrow as="legend" tone="ink" style={LEGEND}>
        {buildSharingCopy('whoCanSeeIt')}
      </Eyebrow>
      {choices.map((choice) => {
        const open = value === choice.value ? details?.[choice.value] : undefined
        const radio = (
          <Radio
            key={choice.value}
            stacked
            bare={open != null}
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            disabled={choice.disabled}
            label={choice.label}
            description={choice.description}
          />
        )
        return open == null ? (
          radio
        ) : (
          <div key={choice.value} style={OPEN_FRAME}>
            {radio}
            {open}
          </div>
        )
      })}
      {children}
    </fieldset>
  )
}
