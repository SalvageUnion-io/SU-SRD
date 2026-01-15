import { SheetTextarea } from './SheetTextarea'
import { Card } from './Card'

interface NotesProps {
  notes: string
  onChange: (value: string) => void
  /** Disables the textarea input */
  disabled?: boolean
  /** Greys out the Card background (only for missing required data) */
  incomplete?: boolean
  backgroundColor?: string
  placeholder?: string
  h?: string | number
  flex?: string | number
  minH?: string | number
}

export function Notes({
  notes,
  onChange,
  placeholder,
  disabled = false,
  incomplete = false,
  backgroundColor = 'bg.builder',
  h,
  flex,
  minH,
}: NotesProps) {
  return (
    <Card
      title="notes"
      bg={backgroundColor}
      disabled={incomplete}
      h={h ?? 'full'}
      flex={flex}
      minH={minH}
    >
      <SheetTextarea
        value={notes}
        onChange={onChange}
        disabled={disabled}
        isOwner={!disabled}
        placeholder={placeholder}
        height="full"
      />
    </Card>
  )
}
