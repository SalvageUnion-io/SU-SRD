import type { RefObjectChoice } from 'salvageunion-reference'
import { isSchemaOnlyCatalogChoice } from 'salvageunion-reference/rules'
import { ChoiceGroups } from '../choiceCard/ChoiceGroups'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { CatalogChoiceListing } from './CatalogChoiceListing'
import type { NestedCard } from './referenceEntityCardTypes'

/**
 * One choice, rendered where the body walk placed it — at its prose marker, or
 * trailing. Read-only renders the same options, static (readable); editable
 * (`onSelectionChange` present) makes them selectable. An option that IS an
 * entity, and an editable catalog choice's pick, sit inside the host card, so
 * each is that entity's TOKEN (EDL N1, N2), never a head-only Row. Editable,
 * the Token IS the toggle (EDL Modes): pressed when chosen, the ring on its
 * pill, an unchosen one in the one `selectable` dim, no seal; `data-choice-toggle`
 * marks it, the one Token the nesting gate lets take a pressed state (N7 keeps
 * radio and checkbox picks on Row and Card). Read-only, a chosen option's Token
 * wears the ring alone: level 2 is never sealed (hard rule R15).
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
  onPage,
  chassisName,
  NestedCard,
}: {
  choice: RefObjectChoice
  effTechLevel: number | undefined
  scalingParent: Record<string, unknown> | undefined
  selections: ChoiceSelections | undefined
  onSelectionChange: ((selections: ChoiceSelections) => void) | undefined
  compact: boolean
  toneColor: string | undefined
  /** The HOST card's depth — listed entities render one level below it. */
  depth: number
  /** The host is its entity's own Page (level 0): see `ChoiceGroups`' `onPage`. */
  onPage: boolean
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
      <div className="su-choice-region">
        <CatalogChoiceListing
          choice={choice}
          techLevel={typeof effTechLevel === 'number' ? effTechLevel : undefined}
          selections={selections}
          onSelectionChange={editableChoices ? onSelectionChange : undefined}
          renderEntity={(resolved, key) => (
            <NestedCard
              key={key}
              size="mini"
              extent="head"
              depth={depth + 1}
              data={resolved}
              chassisName={chassisName}
            />
          )}
        />
      </div>
    )
  }
  return (
    <div className="su-choice-region">
      <ChoiceGroups
        choices={[choice]}
        parent={effTechLevel !== undefined ? { techLevel: effTechLevel } : scalingParent}
        selections={selections}
        onSelectionChange={onSelectionChange}
        readOnly={!editableChoices}
        compact={compact}
        toneColor={toneColor}
        onPage={onPage}
        // An option that IS an entity is its Token: read-only it reads, a
        // chosen one ringed; editable it is the toggle itself.
        renderEntityOption={(option) => {
          if (!option.readOnly) {
            return (
              <div data-choice-toggle="">
                <NestedCard
                  size="mini"
                  extent="head"
                  depth={depth + 1}
                  data={option.entity}
                  chassisName={chassisName}
                  selected={option.chosen}
                  selectionRole="toggle"
                  // The one dim: unchosen, whether or not the cap allows it.
                  selectable={option.chosen}
                  onCardClick={option.onToggle}
                  cardClickLabel={option.label}
                />
              </div>
            )
          }
          return (
            <NestedCard
              size="mini"
              extent="head"
              depth={depth + 1}
              data={option.entity}
              chassisName={chassisName}
              selected={option.chosen}
            />
          )
        }}
      />
    </div>
  )
}
