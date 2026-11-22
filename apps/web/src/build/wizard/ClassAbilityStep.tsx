import type { BookCite, RefAbility, RefClass } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { EmptyState, ReferenceEntityCard } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import type { SelectableBaseClass } from './classOptions.model'
import { selectableClasses } from './classOptions.model'
import { PickList } from './PickList'
import { abilityColumns } from './pickColumns'
import type { PickColumn } from './pickLedger.model'
import { FIRST_ABILITY_ID } from './wizPrompt.model'

type SURClassesAccessor = {
  all: () => unknown[]
  find: (fn: (x: unknown) => boolean) => unknown
}
type SURAbilitiesAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

/**
 * What tells the six classes apart is their trees, so that is the picker's
 * column, as plain text in the book's order. The Salvager's says what the
 * book says of it (p.18).
 */
const CLASS_COLUMNS: readonly PickColumn<SelectableBaseClass>[] = [
  {
    key: 'core',
    label: buildWizardCopy('coreTrees'),
    kind: 'line',
    phone: true,
    value: (c) =>
      c.coreTrees.length > 3 ? buildWizardCopy('anyCoreTree') : c.coreTrees.join(' · '),
  },
]

/** What tells the Level-1 abilities apart, a line each. */
const ABILITY_COLUMNS = abilityColumns<RefAbility>()

type ClassAbilityStepProps = {
  classId: string
  selectedAbilities: string[]
  /** Radio semantics — a new class replaces the old. */
  onSelectClass: (classId: string) => void
  /** Radio semantics — the pick REPLACES the current ability. Emits its slug. */
  onSelectAbility: (slug: string) => void
  /** Where the book prints the step's rule, on the lists' feet. */
  cite: BookCite | undefined
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

/**
 * Step 1 · Class and first Ability (Workshop Manual p.18), both pickers in the
 * Ledger form (`PickList`, ledger.md L7). The six core classes are one list,
 * their trees the column that tells them apart; the pick's Level-1 abilities
 * are the second, a line each: its tree, its timing, its range, what it does
 * and its AP, exactly one picked (radio). The picked class stands beside the
 * lists as its contentful card, and the picked ability over it there (under
 * its line on a phone) as its own: its rules only, no lead and no flavour. An
 * option an ability asks (Bionic Senses' optics) is made on the pilot's
 * sheet: a pilot keeps no choice of an ability's yet, so the step asks none.
 * Only LEGAL abilities render (`legalCreationAbilities`).
 */
export function ClassAbilityStep({
  classId,
  selectedAbilities,
  onSelectClass,
  onSelectAbility,
  cite,
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

  const abilityCard = (ability: RefAbility) => (
    <ReferenceEntityCard
      data={ability}
      size="compact"
      selected
      hide={{ lead: true, flavor: true, choices: true }}
    />
  )

  return (
    <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
      <div className="su-wiz-compare-main">
        <div>
          <PickList
            title={buildWizardCopy('pilotClass')}
            note={buildWizardCopy('choose1')}
            rows={legalClasses}
            rowKey={(c) => c.id}
            rowName={(c) => c.name}
            columns={CLASS_COLUMNS}
            selected={classId || undefined}
            onSelect={onSelectClass}
            {...(cite ? { foot: { cite } } : {})}
          />
        </div>
        {selectedClass !== undefined && (
          <div id={FIRST_ABILITY_ID}>
            <PickList
              title={buildWizardCopy('firstAbility')}
              note={buildWizardCopy('choose1')}
              rows={legalPool}
              rowKey={getEntitySlug}
              rowName={(a) => a.name}
              columns={ABILITY_COLUMNS}
              selected={pickedAbility ? getEntitySlug(pickedAbility) : undefined}
              onSelect={onSelectAbility}
              detail={abilityCard}
              {...(cite
                ? {
                    foot: {
                      cite: { source: cite.source, page: cite.page },
                      meta: {
                        label: selectedClass.name,
                        value: buildWizardCopy('level1OfItsCore'),
                      },
                    },
                  }
                : {})}
            />
            {legalPool.length === 0 && (
              <EmptyState
                headline={buildWizardCopy('noAbilities')}
                body={buildWizardCopy('noLevel1AbilitiesFound')}
              />
            )}
          </div>
        )}
      </div>
      {/* In the page's flow, never a column that scrolls in itself: with the
          picked ability over the class its foot sat under the fold of its own
          scroller, where no page scroll reached it (K14). */}
      <div className="su-wiz-compare-detail">
        {selectedClass === undefined ? (
          <EmptyState
            variant="quiet"
            body={buildWizardCopy('pickAClassToReveal')}
            bodyInk="inherit"
          />
        ) : (
          <>
            {/* The picked ability's own rules lead the panel from lg (r4 E8:
                under the list they sat below the fold); on a phone they open
                under its line (`detail`). */}
            {pickedAbility && (
              <div className="su-wiz-compare-detail--desk">{abilityCard(pickedAbility)}</div>
            )}
            <ReferenceEntityCard
              data={selectedClass as RefClass}
              size="compact"
              hide={{ actions: true, choices: true }}
            />
          </>
        )}
      </div>
    </div>
  )
}
