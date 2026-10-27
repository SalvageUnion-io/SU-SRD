import type { MoraleRoll } from '../../lib/rules/opposition'
import { mediatorCopy } from '../../messages/play-mediator'
import { NOTE, NOTE_MUTED, STRONG } from './mediatorStyles.model'

/**
 * A roll's result on the Opposition, announced as it lands: its table, die
 * and label in bold, then what it means; before any roll, the muted `empty`
 * line.
 */
export function RollResultLine({
  roll,
  tableName,
  empty,
}: {
  roll: MoraleRoll | null
  /** The head's table name for an important NPC's roll; else Reaction or Morale. */
  tableName?: string
  empty?: string
}) {
  const value = roll?.label ? ` · ${roll.label}` : ''
  return (
    <p role="status" aria-live="polite" style={roll ? NOTE : NOTE_MUTED}>
      {roll ? (
        <>
          <span style={STRONG}>
            {tableName !== undefined
              ? mediatorCopy('importantRoll', { table: tableName, roll: roll.roll, value })
              : mediatorCopy(roll.table === 'reaction' ? 'reaction' : 'morale', {
                  roll: roll.roll,
                  value,
                })}
          </span>
          {` — ${roll.value}`}
        </>
      ) : (
        empty
      )}
    </p>
  )
}
