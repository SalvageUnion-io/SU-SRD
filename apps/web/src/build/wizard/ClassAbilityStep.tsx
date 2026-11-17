import type { RefAbility, RefClass } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { EmptyState, MasonryColumns, ReferenceEntityCard, Slab } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import type { CompareColumn } from './CompareTable'
import { CompareTable } from './CompareTable'
import type { SelectableBaseClass } from './classOptions.model'
import { selectableClasses } from './classOptions.model'
import { fullWidthStyle } from './wizardStyles.model'

type SURClassesAccessor = {
  all: () => unknown[]
  find: (fn: (x: unknown) => boolean) => unknown
}
type SURAbilitiesAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

/**
 * MOCK (Working Manual, "Compare in columns"): what tells the six classes
 * apart is their trees, so those are the table's columns. The Salvager's row
 * says what the book says of it (p.18): any Core tree, never beyond them.
 */
const CLASS_COLUMNS: readonly CompareColumn<SelectableBaseClass>[] = [
  {
    key: 'core',
    label: 'Core trees',
    text: true,
    value: (c) => (c.coreTrees.length > 3 ? 'Any Core tree' : c.coreTrees.join(' · ')),
  },
  {
    key: 'advanced',
    label: 'Advances to',
    text: true,
    wideOnly: true,
    value: (c) => (c.advanceable && c.advancedTree ? c.advancedTree : 'Core trees only'),
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
      {/* MOCK: the classes as one compare table; the pick's card beside it. */}
      <div className="su-wiz-compare-layout">
        <div>
          <Slab label={buildWizardCopy('pilotClass')} count="Choose 1" countInk="inherit" />
          <CompareTable
            ariaLabel={buildWizardCopy('pilotClass2')}
            nameLabel="Class"
            rows={legalClasses}
            rowKey={(c) => c.id}
            rowName={(c) => c.name}
            columns={CLASS_COLUMNS}
            selected={classId || undefined}
            onSelect={onSelectClass}
          />
        </div>
        <div className="su-wiz-compare-detail">
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

      {selectedClass === undefined ? null : (
        <>
          <Slab
            label={buildWizardCopy('firstAbilityTreesLevel1', { name: selectedClass.name })}
            count="Choose 1"
            countInk="inherit"
          />
          <MasonryColumns maxColumns={2} radio ariaLabel={buildWizardCopy('firstAbility')}>
            {legalPool.map(renderAbilityCard)}
          </MasonryColumns>
          {legalPool.length === 0 && (
            <EmptyState
              headline={buildWizardCopy('noAbilities')}
              body={buildWizardCopy('noLevel1AbilitiesFound')}
            />
          )}
        </>
      )}
    </div>
  )
}
