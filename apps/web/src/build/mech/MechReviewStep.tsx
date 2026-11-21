import type { CSSProperties, ReactNode } from 'react'
import type { RefModule, RefSystem } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { FieldError } from '../../components/app'
import { Callout, ReferenceEntityCard, tokens } from '../../components/index'
import { readReference } from '../../lib/readReference'
import { hasIntegratedLocomotion, LOCOMOTION } from '../../lib/rules/locomotion'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { mechCopy } from '../../messages/build-mech'
import { loadoutColumns } from '../wizard/pickColumns'
import { ReviewLedger } from '../wizard/ReviewLedger'
import { Recap, RecapStat } from '../wizard/ReviewRecap'
import { SavePatternButton } from './Pattern/SavePatternButton'

/** A note's line in body type, as the crawler review's reminder. */
const NOTE = { display: 'block', fontFamily: tokens.font.body } satisfies CSSProperties

type MechReviewStepProps = {
  form: MechWizardFormState
  submitError: string | null
  /**
   * Unspent Tech 1 Scrap. Create puts it in the new mech's hold as one
   * carried line (`withLeftoverScrap`), and the review says so; with nothing
   * left it says nothing. The mech's own record: no cross-entity write.
   */
  leftoverScrap: number
  /** The slot budgets, for the lists' sums. */
  capacity: {
    systemSlotsUsed: number
    systemSlotsMax: number
    moduleSlotsUsed: number
    moduleSlotsMax: number
  }
  /** The name's part (its field over its rule), leading the review. */
  namePart: ReactNode
}

/**
 * Step 4 · Name and review (Workshop Manual p.94). The name's part leads;
 * under it the build reads as it will on the sheet: the Systems and the
 * Modules a Ledger each (the picker's own columns, a copy count, each made
 * choice under its name, the slots and Scrap summed on an ink line), and
 * beside them the chassis as its contentful card, the look as Stats, and the
 * Scrap left over, which goes into the hold.
 */
export function MechReviewStep({
  form,
  submitError,
  leftoverScrap,
  capacity,
  namePart,
}: MechReviewStepProps) {
  const chosenSystems = form.systems.flatMap((ref) => {
    const found = resolveSystemRef(ref)
    return found ? [found] : []
  })
  const chosenModules = form.modules.flatMap((ref) => {
    const found = resolveModuleRef(ref)
    return found ? [found] : []
  })

  const chassis = form.chassisName
    ? (readReference('MechReviewStep.chassis', () => resolveChassisRef(form.chassisName), null) ??
      undefined)
    : undefined

  const sums =
    (used: number, max: number) =>
    (rows: readonly { entity: RefSystem | RefModule; count: number }[]) => [
      `${used}/${max}`,
      rows.reduce((sum, row) => sum + row.entity.salvageValue * row.count, 0),
      '',
      '',
      '',
      '',
    ]
  // A mech moves by a fitted Locomotion System or by its chassis's own.
  const moves =
    chosenSystems.some((system) => LOCOMOTION.test(system.name)) ||
    hasIntegratedLocomotion(form.chassisName)
  const columns = loadoutColumns<RefSystem | RefModule>(
    (item) => form.itemChoices?.[nameToSlug(item.name)]
  )

  return (
    <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
      <div className="su-wiz-compare-main">
        {namePart}
        {submitError && <FieldError>{submitError}</FieldError>}
        <div className="su-wiz-ledgers">
          <ReviewLedger
            title={mechCopy('systems')}
            entities={chosenSystems}
            columns={columns}
            choices={form.itemChoices}
            empty={mechCopy('noSystemsInstalled')}
            total={sums(capacity.systemSlotsUsed, capacity.systemSlotsMax)}
          />
          <ReviewLedger
            title={mechCopy('modules')}
            entities={chosenModules}
            columns={columns}
            choices={form.itemChoices}
            empty={mechCopy('noModulesInstalled')}
            total={sums(capacity.moduleSlotsUsed, capacity.moduleSlotsMax)}
          />
        </div>
        {!moves && (
          <Callout role="note">
            <span style={NOTE}>{mechCopy('noLocomotionSystemInstalled')}</span>
          </Callout>
        )}
      </div>

      <div className="su-wiz-compare-detail">
        {chassis && (
          <ReferenceEntityCard
            data={chassis}
            size="compact"
            hide={{ actions: true, choices: true, patterns: true }}
            showChassisAbility
          />
        )}
        {(form.quirk || form.appearance) && (
          <Recap>
            <RecapStat label={mechCopy('quirk')} value={form.quirk} />
            <RecapStat label={mechCopy('appearance')} value={form.appearance} />
          </Recap>
        )}
        {/* An unlabelled note (ruleset §5, N5), as the crawler review's reminder:
            only where there is Scrap left. */}
        {leftoverScrap > 0 && (
          <Callout role="note">
            <span style={NOTE}>
              {mechCopy('scrapLeftOverGoesIntoHold', { count: leftoverScrap })}
            </span>
          </Callout>
        )}
        {form.chassisName && (
          <div>
            <SavePatternButton
              source={{
                name: form.name.trim() || mechCopy('unnamedMech'),
                chassisRef: form.chassisName,
                systems: form.systems,
                modules: form.modules,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
