import { Button } from 'component-lib'
import type { PilotRollField, RollTableDeps } from './rollTableHelpers'
import { rollForPilotField } from './rollTableHelpers'

type RollTableButtonProps = {
  field: PilotRollField
  onRoll: (value: string) => void
  label?: string
  /** Injectable deps for testing — omit in production to use defaults. */
  _deps?: RollTableDeps
}

/**
 * Fires the appropriate roll table and passes the result string to onRoll
 * (design §3.2 '⚄ Roll'). Silently no-ops when the table is unavailable
 * (pre-load race).
 */
export function RollTableButton({ field, onRoll, label = 'Roll', _deps }: RollTableButtonProps) {
  function handleClick() {
    const result = rollForPilotField(field, _deps)
    if (result !== null) {
      onRoll(result)
    }
  }

  return (
    <Button size="sm" glyph="⚄" onClick={handleClick} className="shrink-0 self-center">
      {label}
    </Button>
  )
}
