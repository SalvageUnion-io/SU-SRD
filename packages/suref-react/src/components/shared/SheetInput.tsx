import { useState, useEffect, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
const AUTO_SAVE_DELAY = 300

type SheetInputProps = {
  label?: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  isOwner?: boolean
  toggleChecked?: boolean
  onToggleChange?: (checked: boolean) => void
  toggleLabel?: string
  onFocus?: () => void
  onBlur?: () => void
  suffixText?: string
  children?: ReactNode
}

export function SheetInput({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  isOwner = true,
  toggleChecked,
  onToggleChange,
  toggleLabel = 'Used',
  onFocus,
  onBlur,
  suffixText,
  children,
}: SheetInputProps) {
  const hasToggle = toggleChecked !== undefined && onToggleChange !== undefined
  const hasSuffix = suffixText !== undefined
  const showDisabledStyling = disabled && isOwner

  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value && onChange) {
        onChange(localValue)
      }
    }, AUTO_SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [localValue, value, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  return (
    <div className="relative flex flex-col">
      {label && (
        <div className={cn('z-[1] flex items-center', hasToggle ? '-mb-4' : '-mb-2')}>
          <Text variant="pseudoheader" as="span" className="ml-3 text-sm uppercase">
            {label}
          </Text>
          {hasToggle && (
            <label className="ml-2 flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={toggleChecked}
                onChange={(e) => onToggleChange(e.target.checked)}
                disabled={disabled}
                className="h-3.5 w-3.5 border-2 border-su-black accent-su-brick"
                aria-label={`${label} ${toggleLabel}`}
              />
            </label>
          )}
        </div>
      )}

      <div className="flex w-full">
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label || placeholder}
          className={cn(
            'min-w-[120px] flex-1 rounded-md border-2 border-su-black bg-su-white p-3 font-semibold text-su-black',
            showDisabledStyling && 'cursor-not-allowed bg-gray-100 text-gray-500 opacity-50',
            !showDisabledStyling && disabled && 'cursor-not-allowed'
          )}
        />
        {hasSuffix && (
          <div className="flex shrink-0 items-center whitespace-nowrap border-2 border-su-black bg-su-black px-3 text-sm font-semibold text-su-white">
            {suffixText}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}
