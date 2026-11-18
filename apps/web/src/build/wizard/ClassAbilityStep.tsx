import type { RefAbility, RefClass } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { EmptyState, MasonryColumns, ReferenceEntityCard, Slab } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import type { SelectableBaseClass } from './classOptions.model'
import { selectableClasses } from './classOptions.model'
import type { PickColumn } from './PickList'
import { PickList } from './PickList'
import { fullWidthStyle } from './wizardStyles.model'

type SURClassesAccessor = {
  all: () => unknown[]
  find: (fn: (x: unknown) => boolean) => unknown
}
type SURAbilitiesAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

/**
 * MOCK (Working Manual, "compare at a glance"): what tells the six classes
 * apart is their trees, so that is the picker's column, as plain text in the
 * book's order. The Salvager's says what the book says of it (p.18).
 */
const CLASS_COLUMNS: readonly PickColumn<SelectableBaseClass>[] = [
  {
    key: 'core',
    label: 'Core trees',
    text: true,
    value: (c) => (c.coreTrees.length > 3 ? 'Any Core tree' : c.coreTrees.join(' · ')),
  },
]

type ClassAbilityStepProps = {
  classId: string
  selectedAbilities: string[]
  /** Radio semantics — a new class replaces the old. */
  onSelectClass: (classId: string) => void
  /** Radio semantics — the pick REPLACES the current ability. Emits its slug. */
  onSelectAbility: (slug: string) => void
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

/**
 * Step 2 · Choose your Pilot and your first Ability (Pilot Bay p.18, merged)
 * — master-detail in one pane: pick 1 of the
 * six CORE classes (SelCard entity cards, radio semantics), which reveals the
 * Level-1 ability picker for that class's trees. Only LEGAL abilities render
 * (package `legalCreationAbilities`: level 1 ∧ tree ∈ coreTrees — the
 * Salvager sees all 15 core-tree Level-1s); the pick is a radio, exactly 1.
 */
export function ClassAbilityStep({
  classId,
  selectedAbilities,
  onSelectClass,
  onSelectAbility,
  _sur,
}: ClassAbilityStepProps) {
  const surClasses: SURClassesAccessor = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities: SURAbilitiesAccessor = _sur?.Abilities ?? SalvageUnionReference.Abilities

  const { base } = selectableClasses(surClasses, false)
  const legalClasses = base.filter((c) => isLegalCreationClass(c.coreTrees))
  const selectedClass = base.find((c) => c.id === classId)

  // The injectable accessor is `unknown`-typed for test seams (the app's
  // PilotWizard passes the same shape), so the ONE cast lives here at the
  // seam: the production accessor really returns `RefAbility[]`, and a
  // properly-typed ability then flows into the card with no further forcing.
  const allAbilities = surAbilities.findAll(() => true) as RefAbility[]

  const renderAbilityCard = (ability: RefAbility) => (
    <ReferenceEntityCard
      key={ability.id}
      data={ability}
      size="compact"
      selected={selectedAbilities.includes(getEntitySlug(ability))}
      selectionRole="radio"
      cardClickLabel={ability.name}
      onCardClick={() => onSelectAbility(getEntitySlug(ability))}
      hide={{ actions: true, choices: true }}
    />
  )

  // The class's legal Level-1 pool, flat. The card names its own tree in the
  // label pill (`[Forging | 1]`), so the pool needs no extra label.
  const legalPool = legalCreationAbilities(allAbilities, selectedClass?.coreTrees).sort((a, b) =>
    a.tree.localeCompare(b.tree)
  )

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      {/* MOCK: the classes as one picker; the pick's card beside it. */}
      <div className="su-wiz-compare-layout">
        <div className="su-wiz-compare-main">
          <div>
            <PickList
              title={buildWizardCopy('pilotClass')}
              note="Choose 1"
              rows={legalClasses}
              rowKey={(c) => c.id}
              rowName={(c) => c.name}
              columns={CLASS_COLUMNS}
              selected={classId || undefined}
              onSelect={onSelectClass}
            />
          </div>
          {/* MOCK: the pick's Level-1 pool under the table, so the class's card
              rides beside both and the column has no dead room. */}
          {selectedClass !== undefined && (
            <div>
              <Slab
                label={buildWizardCopy('firstAbilityTreesLevel1', { name: selectedClass.name })}
                count="Choose 1"
                countInk="inherit"
              />
              <MasonryColumns maxColumns={1} radio ariaLabel={buildWizardCopy('firstAbility')}>
                {legalPool.map(renderAbilityCard)}
              </MasonryColumns>
              {legalPool.length === 0 && (
                <EmptyState
                  headline={buildWizardCopy('noAbilities')}
                  body={buildWizardCopy('noLevel1AbilitiesFound')}
                />
              )}
            </div>
          )}
        </div>
        <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky">
          {selectedClass === undefined ? (
            <EmptyState
              variant="quiet"
              body={buildWizardCopy('pickAClassToReveal')}
              bodyInk="inherit"
            />
          ) : (
            <ReferenceEntityCard
              data={selectedClass as RefClass}
              size="compact"
              hide={{ actions: true, choices: true }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
