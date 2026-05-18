import { useState, useRef, useEffect } from 'react'
import { StatDisplay, Text, ValueDisplay } from 'suref-react'
import type { SURefChassis } from 'salvageunion-reference'
import type { SalvageValueInfo } from '../../lib/builderUtils'
import { TAG_BUTTON, TAG_BUTTON_SM } from '../shared/tagButtonClasses'

type MechBuilderHeaderProps = {
  chassis: SURefChassis | undefined
  name: string
  readOnly?: boolean
  compact?: boolean
  salvageValue: SalvageValueInfo
  onNameChange: (name: string) => void
  onSelectChassis?: () => void
}

export function MechBuilderHeader({
  chassis,
  name,
  readOnly,
  compact,
  salvageValue,
  onNameChange,
  onSelectChassis,
}: MechBuilderHeaderProps) {
  if (!chassis) {
    return (
      <div className="flex w-full items-center gap-2 px-2 py-2">
        <Text
          as="span"
          variant="pseudoheader"
          className={`${compact ? 'text-base' : 'text-[1.75rem]'} text-su-white`}
          style={compact ? { lineHeight: 1 } : undefined}
        >
          {readOnly ? 'NO CHASSIS' : 'SELECT A CHASSIS'}
        </Text>
        {!readOnly && onSelectChassis && (
          <button
            type="button"
            onClick={onSelectChassis}
            className={compact ? TAG_BUTTON_SM : TAG_BUTTON}
          >
            Select
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex min-w-0 items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      <StatDisplay label="TL" value={chassis.techLevel} inverse compact={compact} />
      <div className={`flex min-w-0 flex-col ${compact ? 'gap-0.5' : 'gap-0.5'} py-1`}>
        {readOnly ? (
          <Text
            variant="pseudoheader"
            as="span"
            className={compact ? 'text-base' : 'text-[1.75rem]'}
            style={compact ? { lineHeight: 1 } : undefined}
          >
            {name ? `\u201C${name}\u201D` : ''}
          </Text>
        ) : (
          <PatternNameInput value={name} onChange={onNameChange} compact={compact} />
        )}
        <div className={`flex flex-wrap items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
          {salvageValue.isLegalStartingMech && (
            <span
              className={`inline-flex shrink-0 whitespace-nowrap border border-su-black bg-su-rust px-1 font-mono font-bold uppercase tracking-tight text-white ${compact ? 'text-xs font-normal' : 'text-base font-semibold'}`}
              style={{ lineHeight: 1 }}
            >
              Legal Starting Pattern
            </span>
          )}
          <ValueDisplay label="Chassis" value={chassis.name} compact={compact} />
        </div>
      </div>
    </div>
  )
}

function PatternNameInput({
  value,
  onChange,
  compact,
}: {
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputWidth, setInputWidth] = useState(0)

  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.scrollWidth)
    }
  }, [value])

  const hasValue = value.length > 0
  const placeholder = 'Pattern name...'
  const fontClass = compact ? 'text-base' : 'text-[1.75rem]'

  return (
    <span className="relative inline-flex items-baseline">
      {/* Hidden measuring span -- mirrors input font to get content width */}
      <span
        ref={measureRef}
        aria-hidden
        className={`pointer-events-none invisible absolute whitespace-pre font-mono ${fontClass} font-bold uppercase leading-none tracking-tight`}
      >
        {value || placeholder}
      </span>
      <Text
        variant="pseudoheader"
        as="span"
        className={`inline-flex items-center ${fontClass}`}
        style={compact ? { lineHeight: 1 } : undefined}
      >
        {hasValue && <span className="select-none">&ldquo;</span>}
        <input
          ref={inputRef}
          type="text"
          size={1}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`border-none bg-transparent p-0 font-mono ${fontClass} font-bold uppercase leading-none tracking-tight text-su-white outline-none placeholder:normal-case placeholder:text-su-white/50`}
          style={{ width: inputWidth || undefined }}
        />
        {hasValue && <span className="select-none">&rdquo;</span>}
      </Text>
    </span>
  )
}
