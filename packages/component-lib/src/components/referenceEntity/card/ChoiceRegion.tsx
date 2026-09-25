import type { SURefObjectChoice } from 'salvageunion-reference'
import { isSchemaOnlyCatalogChoice } from 'salvageunion-reference/rules'
import { ChoiceGroups } from '../choiceCard/ChoiceGroups'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { CatalogChoiceListing } from './CatalogChoiceListing'
import type { NestedCard } from './referenceEntityCardTypes'

/**
 * One choice, rendered where the body walk placed it — at its prose marker, or
 * trailing. Read-only renders the same choice cards, static (readable);
 * editable (`onSelectionChange` present) makes them selectable.
 */
export function ChoiceRegion({
  choice,
  effTechLevel,
  scalingParent,
  selections,
  onSelectionChange,
  compact,
  toneColor,
  depth,
  hostTone,
  chassisName,
  NestedCard,
}: {
  choice: SURefObjectChoice
  effTechLevel: number | undefined
  scalingParent: Record<string, unknown> | undefined
  selections: ChoiceSelections | undefined
  onSelectionChange: ((selections: ChoiceSelections) => void) | undefined
  compact: boolean
  toneColor: string | undefined
  /** The HOST card's depth — listed entities render one level below it. */
  depth: number
  hostTone: string
  chassisName: string | undefined
  NestedCard: NestedCard
}) {
  const editableChoices = !!onSelectionChange
  // SCHEMA-ONLY catalog ("pick any X from the collection", e.g. the Armament
  // Bay's Weapons System) → an expandable entity listing, capped to the
  // effective tech level. The collection is resolved lazily inside the
  // listing (on expand), so this branch touches no cross-schema data. A
  // shortlist catalog (Ballistic / Energy) and every other kind fall through
  // to ChoiceGroups.
  if (isSchemaOnlyCatalogChoice(choice)) {
    return (
      <div className="[&:not(:last-child)]:mb-3">
        <CatalogChoiceListing
          choice={choice}
          techLevel={typeof effTechLevel === 'number' ? effTechLevel : undefined}
          selections={selections}
          onSelectionChange={editableChoices ? onSelectionChange : undefined}
          renderEntity={(resolved, key) => (
            <NestedCard
              key={key}
              size="medium"
              extent="head"
              depth={depth + 1}
              data={resolved}
              hostTone={hostTone}
              chassisName={chassisName}
            />
          )}
        />
      </div>
    )
  }
  return (
    <div className="[&:not(:last-child)]:mb-3">
      <ChoiceGroups
        choices={[choice]}
        parent={effTechLevel !== undefined ? { techLevel: effTechLevel } : scalingParent}
        selections={selections}
        onSelectionChange={onSelectionChange}
        readOnly={!editableChoices}
        compact={compact}
        toneColor={toneColor}
      />
    </div>
  )
}
