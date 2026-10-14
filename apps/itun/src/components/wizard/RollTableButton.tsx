import { Button } from 'component-lib'
import type { CSSProperties } from 'react'
import type { PilotRollField, RollTableDeps } from './rollTableHelpers.model'
import { rollForPilotField, rollOnNamedTable } from './rollTableHelpers.model'

const rollButtonStyle = { alignSelf: 'center', flexShrink: 0 } satisfies CSSProperties

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
 * ('⚄ Roll'). Silently no-ops when the table is unavailable
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
    void result.then((value) => {
      if (value !== null) onRoll(value)
    })
  }

  return (
    <Button
      size="compact"
      glyph="⚄"
      onClick={handleClick}
      style={rollButtonStyle}
      aria-label={ariaLabel}
    >
      {label}
    </Button>
  )
}
