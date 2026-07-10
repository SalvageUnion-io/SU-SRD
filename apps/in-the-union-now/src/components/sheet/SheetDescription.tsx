import { useState } from 'react'

import { cn } from '../../lib/utils'
import { InlineEditTextArea } from './InlineEditTextArea'
import { EDIT_CUE_CLASS, SectionChead, SectionEditButton } from './SheetSection'

type SheetDescriptionProps = {
  /** Freeform text to render; without `onSave` the section hides when empty. */
  text: string | undefined
  /** Section label (e.g. "Bio", "Description"). Defaults to "Description". */
  label?: string
  /**
   * Persist an edited value. When provided this becomes a FIELD section of
   * the unified edit language: the header gets the section's OWN Edit button,
   * and the text flips to inline click-to-edit only while editing. Omit for
   * read-only sheets (snapshots) — the old display-only behavior.
   */
  onSave?: (next: string) => Promise<unknown> | undefined
}

/**
 * Freeform description/bio section for an entity live sheet — a Slab header
 * plus the text as a paragraph (newlines preserved). Read-only without
 * `onSave` (and self-hides when empty); with `onSave` it is a per-section
 * editable FIELD section that renders even when empty (so a bio can be added).
 */
export function SheetDescription({ text, label = 'Description', onSave }: SheetDescriptionProps) {
  // Per-section edit flag — flips ONLY this section to inline-edit.
  const [editing, setEditing] = useState(false)
  const value = text ?? ''

  if (!onSave && value.trim().length === 0) return null

  return (
    <div>
      <SectionChead
        title={label}
        actions={
          onSave ? (
            <SectionEditButton
              section={label}
              editing={editing}
              onToggle={() => setEditing((v) => !v)}
            />
          ) : undefined
        }
      />
      {onSave && editing ? (
        <div className={cn('rounded-[3px]', EDIT_CUE_CLASS)}>
          <InlineEditTextArea
            value={value}
            ariaLabel={`Edit ${label.toLowerCase()}`}
            onSave={async (next) => {
              await onSave(next)
            }}
          />
        </div>
      ) : value.trim().length > 0 ? (
        <p className="m-0 whitespace-pre-wrap font-body text-sm text-ink">{value}</p>
      ) : (
        <p className="m-0 font-body text-caption italic text-wk-muted">
          Nothing written yet — hit Edit to add one.
        </p>
      )}
    </div>
  )
}
