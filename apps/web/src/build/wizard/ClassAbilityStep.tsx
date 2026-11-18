import type { ChoiceSelections, RefAbility, RefClass } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { EmptyState, ReferenceEntityCard } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import type { SelectableBaseClass } from './classOptions.model'
import { selectableClasses } from './classOptions.model'
import { PickList } from './PickList'
import { abilityColumns, choicesOf, chosenChips } from './pickColumns'
import type { PickColumn } from './pickLedger'

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
    kind: 'line',
    phone: true,
    value: (c) => (c.coreTrees.length > 3 ? 'Any Core tree' : c.coreTrees.join(' · ')),
  },
]

/** MOCK (wave 2): what tells the Level-1 abilities apart, a line each. */
const ABILITY_COLUMNS = abilityColumns<RefAbility>()

type ClassAbilityStepProps = {
  classId: string
  selectedAbilities: string[]
  /** Radio semantics — a new class replaces the old. */
  onSelectClass: (classId: string) => void
  /** Radio semantics — the pick REPLACES the current ability. Emits its slug. */
  onSelectAbility: (slug: string) => void
  /** MOCK (wave 2): each pick's chosen options, by slug, and their setter. */
  choices?: Record<string, ChoiceSelections>
  onChoices?: (slug: string, next: ChoiceSelections) => void
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

/**
 * MOCK (Working Manual, wave 2) · Step 1 · Class and first Ability, both
 * pickers in the Ledger form (`PickList`). The six core classes are one list,
 * their trees the column that tells them apart; the pick's Level-1 abilities
 * are the second, a line each: its tree, its timing, its AP, its range and
 * what it does, exactly one picked (radio). The picked class and the picked
 * ability stand beside the lists as their contentful cards; the ability's card
 * says its own rules only (no lead, no flavour) and is where an option it asks
 * for is chosen (Bionic Senses' optics), the choice then a chip under its
 * line (hard rule R60). Only LEGAL abilities render (`legalCreationAbilities`).
 */
export function ClassAbilityStep({
  classId,
  selectedAbilities,
  onSelectClass,
  onSelectAbility,
  choices = {},
  onChoices,
  _sur,
}: ClassAbilityStepProps) {
  const surClasses: SURClassesAccessor = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities: SURAbilitiesAccessor = _sur?.Abilities ?? SalvageUnionReference.Abilities

  const { base } = selectableClasses(surClasses, false)
  const legalClasses = base.filter((c) => isLegalCreationClass(c.coreTrees))
  const selectedClass = base.find((c) => c.id === classId)

  // The injectable accessor is `unknown`-typed for test seams (the app's
  // PilotWizard passes the same shape), so the ONE cast lives here at the
  // seam: the production accessor really returns `RefAbility[]`.
  const allAbilities = surAbilities.findAll(() => true) as RefAbility[]

  // The class's legal Level-1 pool, by tree.
  const legalPool = legalCreationAbilities(allAbilities, selectedClass?.coreTrees).sort((a, b) =>
    a.tree.localeCompare(b.tree)
  )
  const pickedAbility = legalPool.find((a) => selectedAbilities.includes(getEntitySlug(a)))

  const abilityCard = (ability: RefAbility) => {
    const slug = getEntitySlug(ability)
    const asks = choicesOf(ability).length > 0 && onChoices !== undefined
    return (
      <div className="su-wiz-own-rules su-wiz-own-rules--ability">
        <ReferenceEntityCard
          data={ability}
          size="compact"
          selected
          {...(asks
            ? {
                selections: choices[slug] ?? {},
                onSelectionChange: (next: ChoiceSelections) => onChoices(slug, next),
              }
            : { hide: { choices: true } })}
        />
      </div>
    )
  }

  return (
    <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
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
            foot={{ cite: 'Workshop Manual · p.18 · Pilot Classes pp.26–77' }}
          />
        </div>
        {selectedClass !== undefined && (
          <div>
            <PickList
              title={buildWizardCopy('firstAbility')}
              note="Choose 1"
              rows={legalPool}
              rowKey={getEntitySlug}
              rowName={(a) => a.name}
              columns={ABILITY_COLUMNS}
              selected={pickedAbility ? getEntitySlug(pickedAbility) : undefined}
              onSelect={onSelectAbility}
              under={(a) => chosenChips(a, choices[getEntitySlug(a)])}
              detail={abilityCard}
              foot={{
                cite: 'Workshop Manual · p.18',
                meta: { label: selectedClass.name, value: 'Level 1 of its Core trees' },
              }}
            />
            {/* The picked ability's own rules under its list from lg (under
                its line on a phone, `detail`), so the class's card beside the
                lists has no bare column under them. */}
            {pickedAbility && (
              <div className="su-wiz-compare-detail--desk su-wiz-pick-under">
                {abilityCard(pickedAbility)}
              </div>
            )}
            {legalPool.length === 0 && (
              <EmptyState
                headline={buildWizardCopy('noAbilities')}
                body={buildWizardCopy('noLevel1AbilitiesFound')}
              />
            )}
          </div>
        )}
      </div>
      <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky su-wiz-compare-detail--scroll">
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
  )
}
