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
  id,
  autoFocus,
  maxLength,
}: LabeledInputProps) {
  return (
    <div className={cn('relative flex flex-col', className)}>
      <div className="z-[1] -mb-2 flex h-4 items-end justify-between">
        <Text
          variant="pseudoheader"
          as="label"
          className="ml-3 border border-su-black text-xs uppercase"
          style={{ alignSelf: 'flex-end' }}
        >
          {label}
          {optionalText && (
            <span className="ml-1 text-[10px] normal-case opacity-50">{optionalText}</span>
          )}
        </Text>
        {rightHeaderContent}
      </div>

      {readOnly ? (
        <p className="ml-3 pt-3 text-sm text-su-grey-light">
          {readOnlyValue ?? (value || '\u2014')}
        </p>
      ) : variant === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="min-h-[60px] text-sm"
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
          className="h-8 text-sm"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          maxLength={maxLength}
        />
      )}
    </div>
  )
}
