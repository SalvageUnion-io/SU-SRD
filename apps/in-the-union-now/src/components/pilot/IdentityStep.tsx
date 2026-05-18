import type { RollTableDeps } from './rollTableHelpers'
import { RollTableButton } from './RollTableButton'

type IdentityStepProps = {
  callsign: string
  motto: string
  keepsake: string
  appearance: string
  onChange: (field: 'callsign' | 'motto' | 'keepsake' | 'appearance', value: string) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

type FieldConfig = {
  key: 'callsign' | 'motto' | 'keepsake' | 'appearance'
  label: string
  placeholder: string
  rollField: 'callsign' | 'motto' | 'keepsake' | 'appearance'
}

const FIELDS: FieldConfig[] = [
  {
    key: 'callsign',
    label: 'Callsign',
    placeholder: 'Your pilot callsign',
    rollField: 'callsign',
  },
  {
    key: 'motto',
    label: 'Motto',
    placeholder: 'A phrase your pilot lives by',
    rollField: 'motto',
  },
  {
    key: 'keepsake',
    label: 'Keepsake',
    placeholder: 'Something precious from your past',
    rollField: 'keepsake',
  },
  {
    key: 'appearance',
    label: 'Appearance',
    placeholder: 'How does your pilot look?',
    rollField: 'appearance',
  },
]

/**
 * Step 4: Pilot identity — callsign, motto, keepsake, appearance.
 * Each field has a roll-table button and a free-text input for hand-editing.
 */
export function IdentityStep({
  callsign,
  motto,
  keepsake,
  appearance,
  onChange,
  _rollDeps,
}: IdentityStepProps) {
  const values: Record<string, string> = { callsign, motto, keepsake, appearance }

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-70">
        Define your pilot&apos;s identity. Roll for random results or type your own.
      </p>
      {FIELDS.map(({ key, label, placeholder, rollField }) => (
        <div key={key} className="space-y-1">
          <label className="block text-sm font-medium" htmlFor={`identity-${key}`}>
            {label}
          </label>
          <div className="flex gap-2">
            <input
              id={`identity-${key}`}
              type="text"
              value={values[key] ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <RollTableButton
              field={rollField}
              onRoll={(value) => onChange(key, value)}
              label="Roll"
              _deps={_rollDeps}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
