import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { SURefEntity, SURefMetaEntity, SURefObjectChoice } from 'salvageunion-reference'
import { firstParagraphText } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { color, font, fontSize, space, tracking } from '../../../design/tokens'
import { Button } from '../../atoms/Button'
import { CatalogChoiceModal } from '../choiceCard/CatalogChoiceModal'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { EntityTokenList } from './EntityTokenList'

const stackStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

/** `text-xs` with its paired line height. */
const textXs = { fontSize: fontSize.xs, lineHeight: '1rem' } satisfies CSSProperties

const promptStyle = { fontFamily: font.body, ...textXs, color: color.ink2 } satisfies CSSProperties

const summaryStyle = {
  cursor: 'pointer',
  // A 12px line padded to 24px tall: the AA target size (WCAG 2.5.8).
  paddingBlock: space[6],
  fontFamily: font.cond,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tracking.capsTight,
  color: color.ink2,
} satisfies CSSProperties

const chooseButtonStyle = {
  width: 'fit-content',
  padding: `${space[4]} ${space[12]}`,
} satisfies CSSProperties

/**
 * A SCHEMA-ONLY catalog choice — "pick any entity from the collection" (the
 * Armament Bay's Weapons System = any Mech System dealing SP damage). Two faces:
 *
 * - **Editable** launches the shared `CatalogChoiceModal` (search + facets +
 *   rail) via a "Choose…" button, and shows the current pick as a real listing
 *   card. Single-select — the modal owns the pool (filtered to the catalog).
 * - **Read-only** is a static reference: an expandable listing of the qualifying
 *   entities, each a Token (`EntityTokenList`).
 *
 * The collection is resolved LAZILY — only when the picker/listing is opened —
 * so the default render touches no cross-schema collection (the target schema,
 * e.g. `systems`/`chassis`, need not be preloaded to show a bay/system).
 * Resolution is guarded: an unloaded target schema resolves to empty, never a
 * throw.
 *
 * Rendering the editable pick goes through the `renderEntity` callback the
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
  renderEntity: (entity: SURefEntity | SURefMetaEntity, key: string) => ReactNode
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
      ).find((e) => e.name === chosen)
    } catch {
      return undefined
    }
  }, [choice, chosen, techLevel])

  // EDITABLE — the modal picker (launched by a button), plus the current pick.
  if (editable) {
    return (
      <div style={stackStyle}>
        {prompt && <p style={promptStyle}>{prompt}</p>}
        {chosenEntity && renderEntity(chosenEntity, 'chosen')}
        <Button
          variant="primary"
          size="mini"
          onClick={() => setModalOpen(true)}
          style={chooseButtonStyle}
        >
          {chosen ? `Change — ${chosen}` : `Choose ${choice.name}…`}
        </Button>
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
  let entities: SURefMetaEntity[] = []
  if (open) {
    try {
      entities = resolveCatalogChoiceEntities(
        choice,
        typeof techLevel === 'number' ? { techLevel } : undefined
      )
    } catch {
      entities = []
    }
  }
  const summary = chosen ? `${choice.name}: ${chosen}` : choice.name
  return (
    <div style={stackStyle}>
      {prompt && <p style={promptStyle}>{prompt}</p>}
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} style={textXs}>
        <summary style={summaryStyle}>{summary}</summary>
        {open && (
          // The whole qualifying collection is a big grouping: Tokens
          // (owner's call, 2026-10-14).
          <div style={{ marginTop: space[8] }}>
            <EntityTokenList entities={entities} label={choice.name} />
          </div>
        )}
      </details>
    </div>
  )
}
