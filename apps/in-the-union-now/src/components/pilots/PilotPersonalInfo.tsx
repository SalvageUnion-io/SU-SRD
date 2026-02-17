import { useState, useCallback } from 'react'
import { SectionSeparator } from 'suref-react'
import { useAutosave } from '../../hooks/useAutosave'
import { LabeledInput } from '../shared/LabeledInput'
import type { PilotRow, PilotUpdate } from '../../types/common'

type PilotPersonalInfoProps = {
  pilot: PilotRow
  readOnly?: boolean
  onUpdate: (input: Partial<PilotUpdate>) => void
}

export function PilotPersonalInfo({ pilot, readOnly, onUpdate }: PilotPersonalInfoProps) {
  const handleFieldBlur = useCallback(
    (field: keyof PilotUpdate, value: string) => {
      const currentValue = pilot[field as keyof PilotRow] ?? ''
      if (value === currentValue) return
      onUpdate({ [field]: value || null })
    },
    [pilot, onUpdate]
  )

  const handleToggleUsed = useCallback(
    (field: 'background_used' | 'motto_used' | 'keepsake_used', currentValue: boolean | null) => {
      onUpdate({ [field]: !currentValue })
    },
    [onUpdate]
  )

  return (
    <div className="space-y-3">
      <SectionSeparator label="Personal Info" fontSize="text-sm" />
      <div className="grid gap-3 sm:grid-cols-2">
        <PersonalField
          label="Background"
          value={pilot.background ?? ''}
          used={pilot.background_used}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('background', v)}
          onToggleUsed={() => handleToggleUsed('background_used', pilot.background_used)}
        />
        <PersonalField
          label="Motto"
          value={pilot.motto ?? ''}
          used={pilot.motto_used}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('motto', v)}
          onToggleUsed={() => handleToggleUsed('motto_used', pilot.motto_used)}
        />
        <PersonalField
          label="Keepsake"
          value={pilot.keepsake ?? ''}
          used={pilot.keepsake_used}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('keepsake', v)}
          onToggleUsed={() => handleToggleUsed('keepsake_used', pilot.keepsake_used)}
        />
        <PersonalField
          label="Appearance"
          value={pilot.appearance ?? ''}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('appearance', v)}
        />
      </div>
    </div>
  )
}

function UsedToggle({ used, onToggle }: { used?: boolean | null; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex shrink-0 cursor-pointer border border-su-black"
    >
      <span className="inline-flex h-full w-[1.1em] items-center justify-center bg-su-white font-mono text-xs font-bold leading-none text-su-black">
        {used ? 'X' : '\u00A0'}
      </span>
      <span className="bg-su-black px-1 font-mono text-xs font-bold uppercase leading-none text-su-white">
        Used
      </span>
    </button>
  )
}

function PersonalField({
  label,
  value,
  used,
  readOnly,
  onSave,
  onToggleUsed,
}: {
  label: string
  value: string
  used?: boolean | null
  readOnly?: boolean
  onSave: (value: string) => void
  onToggleUsed?: () => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const { flush } = useAutosave({
    value: localValue,
    onSave,
    delay: 1000,
  })

  return (
    <LabeledInput
      label={label}
      value={localValue}
      onChange={setLocalValue}
      onBlur={flush}
      readOnly={readOnly}
      readOnlyValue={value || undefined}
      placeholder={`Enter ${label.toLowerCase()}...`}
      rightHeaderContent={
        !readOnly && onToggleUsed ? <UsedToggle used={used} onToggle={onToggleUsed} /> : undefined
      }
    />
  )
}
