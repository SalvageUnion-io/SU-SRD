import { Button } from 'component-lib'
import type { PilotRollField, RollTableDeps } from './rollTableHelpers'
import { rollForPilotField, rollOnNamedTable } from './rollTableHelpers'

type RollTableButtonProps = (
  | {
      /** A pilot identity field, rolled on its table. */
      field: PilotRollField
      table?: never
    }
  | {
      /**
       * Any roll table by name — the table a choice's data points at (P7 D1).
       * The Roll appears only where the data has one.
       */
      table: string
      field?: never
    }
) & {
  onRoll: (value: string) => void
  label?: string
  /** The button's accessible name, when the visible label is not enough. */
  ariaLabel?: string
  /** Injectable deps for testing — omit in production to use defaults. */
  _deps?: RollTableDeps
}

/**
 * Fires the appropriate roll table and passes the result string to onRoll
 * (design §3.2 '⚄ Roll'). Silently no-ops when the table is unavailable
 * (pre-load race).
 */
export function RollTableButton({
  field,
  table,
  onRoll,
  label = 'Roll',
  ariaLabel,
  _deps,
}: RollTableButtonProps) {
  function handleClick() {
    const result =
      table !== undefined ? rollOnNamedTable(table, _deps) : rollForPilotField(field, _deps)
    if (result !== null) {
      onRoll(result)
    }
  }

  return (
    <Button
      size="compact"
      glyph="⚄"
      onClick={handleClick}
      className="shrink-0 self-center"
      aria-label={ariaLabel}
    >
      {label}
    </Button>
  )
}
