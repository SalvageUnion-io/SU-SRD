import { Field, Input } from 'component-lib'
import type { RollTableDeps } from './rollTableHelpers'
import { RollTableButton } from './RollTableButton'

type CallsignStepProps = {
  name: string
  callsign: string
  onChange: (field: 'name' | 'callsign', value: string) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

/**
 * Step 4 · Choose your Callsign (Pilot Bay p.19). Callsign gets the d20
 * roller on the p.88 Callsign Table (roll is an assist — the result stays
 * editable). Name rides on this step: it is the record's required field with
 * no book step of its own (plan §4.1). Next is gated on both being non-empty.
 */
export function CallsignStep({ name, callsign, onChange, _rollDeps }: CallsignStepProps) {
  return (
    <div className="max-w-3xl space-y-5">
      <Field label="Name" required htmlFor="pilot-name">
        <Input
          id="pilot-name"
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Your pilot's real name"
          required
        />
      </Field>
      <Field label="Callsign" required htmlFor="pilot-callsign">
        <div className="flex gap-2">
          <Input
            id="pilot-callsign"
            type="text"
            value={callsign}
            onChange={(e) => onChange('callsign', e.target.value)}
            placeholder="Your pilot callsign"
            required
          />
          <RollTableButton
            field="callsign"
            onRoll={(value) => onChange('callsign', value)}
            _deps={_rollDeps}
          />
        </div>
      </Field>
    </div>
  )
}
