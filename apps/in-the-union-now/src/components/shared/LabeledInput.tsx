import type { ReactNode } from 'react'
import { Text } from 'suref-react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { RollInput } from './RollInput'

type LabeledInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string

  /** Input variant: plain input, textarea, or roll input */
  variant?: 'input' | 'textarea' | 'roll'

  /** Roll table name (variant='roll') */
  rollTableName?: string
  /** Roll callback (variant='roll') */
  onRoll?: () => void

  /** Number of rows (variant='textarea') */
  rows?: number

  /** Faded text after label, e.g. "(Optional)" */
  optionalText?: string
  /** Content rendered on the right side of the label row */
  rightHeaderContent?: ReactNode

  /** When true, renders a plain text value instead of an input */
  readOnly?: boolean
  /** Fallback display text when readOnly (defaults to value or em dash) */
  readOnlyValue?: string

  /** Compact mode — smaller labels, inputs, and spacing */
  compact?: boolean

  id?: string
  autoFocus?: boolean
  maxLength?: number
}

export function LabeledInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  variant = 'input',
  rollTableName,
  onRoll,
  rows,
  optionalText,
  rightHeaderContent,
  readOnly,
  readOnlyValue,
  compact,
  id,
  autoFocus,
  maxLength,
}: LabeledInputProps) {
  const labelSize = compact ? 'text-xs' : 'text-sm'
  const optionalSize = compact ? 'text-[10px]' : 'text-xs'
  const inputSize = compact ? 'h-8 text-sm' : 'h-10 text-base'
  const textareaSize = compact ? 'min-h-[60px] text-sm' : 'min-h-[80px] text-base'
  const readOnlySize = compact ? 'text-sm' : 'text-base'
  const labelOffset = compact ? '-mb-2' : '-mb-2.5'
  const labelHeight = compact ? 'h-4' : 'h-5'
  const labelPadding = compact ? 'ml-3' : 'ml-4'

  return (
    <div className={cn('relative flex flex-col', className)}>
      <div className={cn('z-[1] flex items-end justify-between', labelOffset, labelHeight)}>
        <Text
          variant="pseudoheader"
          as="label"
          className={cn(labelPadding, 'border border-su-black uppercase', labelSize)}
          style={{ alignSelf: 'flex-end' }}
        >
          {label}
          {optionalText && (
            <span className={cn('ml-1 normal-case opacity-50', optionalSize)}>{optionalText}</span>
          )}
        </Text>
        {rightHeaderContent}
      </div>

      {readOnly ? (
        <p className={cn(labelPadding, 'pt-3 text-su-grey-light', readOnlySize)}>
          {readOnlyValue ?? (value || '\u2014')}
        </p>
      ) : variant === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={textareaSize}
          rows={rows ?? 2}
        />
      ) : variant === 'roll' ? (
        <RollInput
          value={value}
          onChange={onChange}
          onRoll={onRoll ?? (() => {})}
          onBlur={onBlur}
          placeholder={placeholder}
          rollTableName={rollTableName}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={inputSize}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          maxLength={maxLength}
        />
      )}
    </div>
  )
}
