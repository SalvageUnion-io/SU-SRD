import { Slab } from 'suref-react'

type SheetDescriptionProps = {
  /** Freeform text to render; the section is omitted when empty/whitespace. */
  text: string | undefined
  /** Section label (e.g. "Bio", "Description"). Defaults to "Description". */
  label?: string
}

/**
 * Read-only freeform description/bio section for an entity live sheet — a Slab
 * header plus the text as a paragraph (newlines preserved). Renders nothing when
 * the text is empty, so it self-hides for entities without one. Editing happens
 * in the entity's builder (a textarea), mirroring the other freeform fields.
 */
export function SheetDescription({ text, label = 'Description' }: SheetDescriptionProps) {
  if (!text || text.trim().length === 0) return null
  return (
    <div>
      <Slab label={label} />
      <p className="m-0 whitespace-pre-wrap font-body text-sm text-ink">{text}</p>
    </div>
  )
}
