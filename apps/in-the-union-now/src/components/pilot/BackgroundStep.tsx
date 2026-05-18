import type { RollTableDeps } from './rollTableHelpers'
import { RollTableButton } from './RollTableButton'

type BackgroundStepProps = {
  background: string
  onChange: (value: string) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

/**
 * Step 5: Pilot background — roll-table driven or freeform.
 */
export function BackgroundStep({ background, onChange, _rollDeps }: BackgroundStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        Describe your pilot&apos;s background. Roll for a random prompt or write your own story.
      </p>
      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="background-field">
          Background
        </label>
        <div className="flex gap-2">
          <RollTableButton
            field="background"
            onRoll={(value) => onChange(value)}
            label="Roll background"
            _deps={_rollDeps}
          />
        </div>
        <textarea
          id="background-field"
          value={background}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Where did you come from? What drives you?"
          rows={5}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  )
}
