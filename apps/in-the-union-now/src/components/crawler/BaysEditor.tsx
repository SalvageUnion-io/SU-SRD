import { useState } from 'react'

import { Button } from '../ui/button'

type BaysEditorProps = {
  bays: string[]
  onChange: (bays: string[]) => void
}

export function BaysEditor({ bays, onChange }: BaysEditorProps) {
  const [inputValue, setInputValue] = useState('')

  function handleAdd() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    onChange([...bays, trimmed])
    setInputValue('')
  }

  function handleRemove(index: number) {
    onChange(bays.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Bay Assignments</legend>
      <div className="space-y-2">
        {bays.length === 0 ? (
          <p className="text-sm opacity-50">No bays assigned yet.</p>
        ) : (
          <ul className="space-y-1">
            {bays.map((bay, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex-1 rounded border border-input bg-muted px-2 py-1 text-sm font-mono">
                  {bay}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemove(i)}
                  aria-label={`Remove bay ${bay}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Entity slug (e.g. pilot-001)"
            aria-label="Bay entity slug"
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            Add Bay
          </Button>
        </div>
      </div>
    </fieldset>
  )
}
