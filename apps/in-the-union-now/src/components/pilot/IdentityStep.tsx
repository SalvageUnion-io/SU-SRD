import { Field, Input } from 'suref-react'
import type { RollTableDeps } from './rollTableHelpers'
import { RollTableButton } from './RollTableButton'

type IdentityField = 'name' | 'callsign' | 'motto' | 'keepsake' | 'appearance'

type IdentityStepProps = {
  name: string
  callsign: string
  motto: string
  keepsake: string
  appearance: string
  onChange: (field: IdentityField, value: string) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

type RollFieldConfig = {
  key: Exclude<IdentityField, 'name'>
  label: string
  placeholder: string
  required?: boolean
}

const ROLL_ROWS: RollFieldConfig[] = [
  {
    key: 'callsign',
    label: 'Callsign',
    placeholder: 'Your pilot callsign',
    required: true,
  },
  { key: 'motto', label: 'Motto', placeholder: 'A phrase your pilot lives by' },
]

const ROLL_COLS: RollFieldConfig[] = [
  {
    key: 'keepsake',
    label: 'Keepsake',
    placeholder: 'Something precious from your past',
  },
  {
    key: 'appearance',
    label: 'Appearance',
    placeholder: 'How does your pilot look?',
  },
]

function RollField({
  config,
  value,
  onChange,
  _rollDeps,
}: {
  config: RollFieldConfig
  value: string
  onChange: (value: string) => void
  _rollDeps?: RollTableDeps
}) {
  const id = `identity-${config.key}`
  return (
    <Field label={config.label} required={config.required} htmlFor={id}>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder}
        />
        <RollTableButton field={config.key} onRoll={onChange} _deps={_rollDeps} />
      </div>
    </Field>
  )
}

/**
 * Identity step (design §3.2 Identity): max-w-760 form — plain Name (required),
 * roll-to-fill rows for Callsign (required) and Motto, 2-col Keepsake and
 * Appearance. Each roll field populates from salvageunion-reference roll
 * tables; free typing allowed.
 */
export function IdentityStep({
  name,
  callsign,
  motto,
  keepsake,
  appearance,
  onChange,
  _rollDeps,
}: IdentityStepProps) {
  const values: Record<Exclude<IdentityField, 'name'>, string> = {
    callsign,
    motto,
    keepsake,
    appearance,
  }

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

      {ROLL_ROWS.map((config) => (
        <RollField
          key={config.key}
          config={config}
          value={values[config.key]}
          onChange={(v) => onChange(config.key, v)}
          _rollDeps={_rollDeps}
        />
      ))}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {ROLL_COLS.map((config) => (
          <RollField
            key={config.key}
            config={config}
            value={values[config.key]}
            onChange={(v) => onChange(config.key, v)}
            _rollDeps={_rollDeps}
          />
        ))}
      </div>
    </div>
  )
}
