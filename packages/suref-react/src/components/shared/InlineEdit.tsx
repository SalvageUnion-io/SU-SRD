import { useState, useRef, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '../../utils/cn'

type InlineEditProps = {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  multiline?: boolean
}

export function InlineEdit({
  value,
  onSave,
  placeholder = 'Click to edit...',
  className,
  inputClassName,
  multiline = false,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value) {
      onSave(draft.trim())
    }
  }

  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  if (editing) {
    const shared = {
      ref: inputRef as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) commit()
        if (e.key === 'Escape') cancel()
      },
      className: cn(
        'w-full rounded-md border border-[var(--ring)] bg-[var(--input)] px-2 py-1 text-sm focus:outline-none',
        inputClassName
      ),
    }

    return multiline ? (
      <textarea {...shared} rows={3} aria-label={`Edit ${placeholder}`} />
    ) : (
      <input {...shared} type="text" aria-label={`Edit ${placeholder}`} />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      aria-label={`Edit ${value || placeholder}`}
      className={cn(
        'group flex items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-su-grey-light/20',
        !value && 'italic text-su-grey',
        className
      )}
    >
      <span className="truncate">{value || placeholder}</span>
      <Pencil
        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
        aria-hidden="true"
      />
    </button>
  )
}
