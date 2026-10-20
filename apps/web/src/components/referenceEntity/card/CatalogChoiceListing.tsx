import type { CSSProperties, ReactNode } from 'react'
import { useContext, useMemo, useState } from 'react'
import type { RefEntity, RefMetaEntity, RefObjectChoice } from 'salvageunion-reference'
import { firstParagraphText } from 'salvageunion-reference'
import { resolveCatalogChoiceEntities } from 'salvageunion-reference/rules'
import { color, font, fontSize, space } from '../../../design/tokens'
import { useDisclosure } from '../../../lib/useDisclosure'
import { Button } from '../../atoms/Button'
import { SlabSection } from '../../containers/SlabSection'
import { InsidePeekContext } from '../../entity/peekContext'
import { Stack } from '../../index'
import { CatalogChoiceModal } from '../choiceCard/CatalogChoiceModal'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { EntityMiniList } from './EntityMiniList'

/** The prompt: a caption (13px body face, `wkMuted`, sentence case), the
 *  rung the type ladder names for hints. */
const promptStyle = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.4,
  margin: 0,
} satisfies CSSProperties

const LIST = { marginTop: space[8] } satisfies CSSProperties

const chooseButtonStyle = {
  width: 'fit-content',
  padding: `${space[4]} ${space[12]}`,
} satisfies CSSProperties

/**
 * A SCHEMA-ONLY catalog choice — "pick any entity from the collection" (the
 * Armament Bay's Weapons System = any Mech System dealing SP damage). Two faces:
 *
 * - **Editable** launches the shared `CatalogChoiceModal` (search + facets +
 *   rail) via a "Choose…" button, and shows the current pick as its Mini.
 *   Single-select — the modal owns the pool (filtered to the catalog).
 * - **Read-only** is a static reference: a Slab naming the choice, then a
 *   "Show options" button that lists the qualifying entities, each a Mini
 *   (`EntityMiniList`). No disclosure
 *   triangle: a chevron belongs only to Minis, rows, the roll-table toggle
 *   and the app's folds. Inside a Peek, which is terminal (E16), the Slab
 *   stands alone: no button.
 *
 * The collection is resolved LAZILY — only when the picker or the listing is
 * opened — so the default render touches no cross-schema collection (the
 * target schema, e.g. `systems`/`chassis`, need not be preloaded to show a
 * bay/system). Resolution is guarded: an unloaded target schema resolves to
 * empty, never a throw.
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
  choice: RefObjectChoice
  techLevel?: number
  selections?: ChoiceSelections
  onSelectionChange?: (selections: ChoiceSelections) => void
  /** Renders one resolved entity as a listing card (key included by the caller). */
  renderEntity: (entity: RefEntity | RefMetaEntity, key: string) => ReactNode
}): ReactNode {
  const options = useDisclosure()
  const insidePeek = useContext(InsidePeekContext)
  const [modalOpen, setModalOpen] = useState(false)
  const editable = !!onSelectionChange
  const chosen = selections?.[choice.id]?.[0]
  // The choice owns its prompt prose (the content data owns the prose).
  const prompt = firstParagraphText(choice.content)

  // The chosen entity (editable), resolved on demand and guarded — shown as
  // its Mini, so the pick reads like every other entity in a card.
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
      <Stack gap={6}>
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
      </Stack>
    )
  }

  // READ-ONLY — a static reference listing under its slab, resolved lazily
  // when the reader asks for it.
  let entities: RefMetaEntity[] = []
  if (options.open) {
    try {
      entities = resolveCatalogChoiceEntities(
        choice,
        typeof techLevel === 'number' ? { techLevel } : undefined
      )
    } catch {
      entities = []
    }
  }
  const label = chosen ? `${choice.name}: ${chosen}` : choice.name
  return (
    <Stack gap={6}>
      {prompt && <p style={promptStyle}>{prompt}</p>}
      <SlabSection title={label}>
        {!insidePeek && (
          <Button size="compact" {...options.toggleProps}>
            {options.open ? 'Hide options' : 'Show options'}
          </Button>
        )}
        {!insidePeek && options.open && (
          // The whole qualifying collection is a big grouping: Minis
          // (owner's call, 2026-10-14).
          <div id={options.panelId} style={LIST}>
            <EntityMiniList entities={entities} label={choice.name} />
          </div>
        )}
      </SlabSection>
    </Stack>
  )
}
