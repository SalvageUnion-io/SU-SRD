import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { SURefEntity, SURefObjectChoice } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { CatalogChoiceModal } from '../choiceCard/CatalogChoiceModal'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { firstParagraphText } from './firstParagraphText'

/**
 * A SCHEMA-ONLY catalog choice — "pick any entity from the collection" (the
 * Armament Bay's Weapons System = any Mech System dealing SP damage). Two faces:
 *
 * - **Editable** launches the shared `CatalogChoiceModal` (search + facets +
 *   rail) via a "Choose…" button, and shows the current pick as a real listing
 *   card. Single-select — the modal owns the pool (filtered to the catalog).
 * - **Read-only** is a static reference: an expandable listing of the qualifying
 *   entities, each a real `ReferenceEntityCard` (listing/header-only).
 *
 * The collection is resolved LAZILY — only when the picker/listing is opened —
 * so the default render touches no cross-schema collection (the target schema,
 * e.g. `systems`/`chassis`, need not be preloaded to show a bay/system).
 * Resolution is guarded: an unloaded target schema resolves to empty, never a
 * throw.
 *
 * Rendering a resolved entity goes through the `renderEntity` callback the
 * (recursive) card supplies — this file never imports the card back.
 */
export function CatalogChoiceListing({
  choice,
  techLevel,
  selections,
  onSelectionChange,
  renderEntity,
}: {
  choice: SURefObjectChoice
  techLevel?: number
  selections?: ChoiceSelections
  onSelectionChange?: (selections: ChoiceSelections) => void
  /** Renders one resolved entity as a listing card (key included by the caller). */
  renderEntity: (entity: SURefEntity, key: string) => ReactNode
}): ReactNode {
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const editable = !!onSelectionChange
  const chosen = selections?.[choice.id]?.[0]
  // The choice owns its prompt prose (the content data owns the prose).
  const prompt = firstParagraphText(choice.content)

  // The chosen entity (editable), resolved on demand and guarded — shown as a
  // real listing card so the pick reads like every other entity on the sheet.
  const chosenEntity = useMemo(() => {
    if (!chosen) return undefined
    try {
      return resolveCatalogChoiceEntities(
        choice,
        typeof techLevel === 'number' ? { techLevel } : undefined
      ).find((e) => e.name === chosen) as unknown as SURefEntity | undefined
    } catch {
      return undefined
    }
  }, [choice, chosen, techLevel])

  // EDITABLE — the modal picker (launched by a button), plus the current pick.
  if (editable) {
    return (
      <div className="flex flex-col gap-1.5">
        {prompt && <p className="font-body text-xs text-ink/70">{prompt}</p>}
        {chosenEntity && renderEntity(chosenEntity, 'chosen')}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-fit rounded-badge border-2 border-rust bg-rust px-3 py-1 font-cond text-badge font-bold uppercase tracking-caps-tight text-paper hover:border-rust-hi hover:bg-rust-hi"
        >
          {chosen ? `Change — ${chosen}` : `Choose ${choice.name}…`}
        </button>
        <CatalogChoiceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          choice={choice}
          techLevel={techLevel}
          selected={selections?.[choice.id] ?? []}
          onSelect={(values) => onSelectionChange?.({ ...(selections ?? {}), [choice.id]: values })}
        />
      </div>
    )
  }

  // READ-ONLY — a static reference listing, resolved lazily on expand.
  let entities: SURefEntity[] = []
  if (open) {
    try {
      entities = resolveCatalogChoiceEntities(
        choice,
        typeof techLevel === 'number' ? { techLevel } : undefined
      ) as unknown as SURefEntity[]
    } catch {
      entities = []
    }
  }
  const summary = chosen ? `${choice.name}: ${chosen}` : choice.name
  return (
    <div className="flex flex-col gap-1.5">
      {prompt && <p className="font-body text-xs text-ink/70">{prompt}</p>}
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="text-xs">
        <summary className="cursor-pointer font-cond uppercase leading-none tracking-caps-tight text-ink/70">
          {summary}
        </summary>
        {open && (
          <div className="mt-2 flex flex-col gap-1.5">
            {entities.map((entity, index) => {
              const name = typeof entity.name === 'string' ? entity.name : ''
              const key =
                'id' in entity && typeof entity.id === 'string' ? entity.id : `${name}-${index}`
              return renderEntity(entity, key)
            })}
          </div>
        )}
      </details>
    </div>
  )
}
