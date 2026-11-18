import type { CSSProperties, ReactNode } from 'react'
import type { RefModule, RefSystem } from 'salvageunion-reference'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { Callout, FieldError, ReferenceEntityCard, tokens } from '../../components/index'
import { readReference } from '../../lib/readReference'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { mechCopy } from '../../messages/build-mech'
import { loadoutColumns } from '../wizard/pickColumns'
import { ReviewLedger } from '../wizard/ReviewLedger'
import { Recap, RecapStat } from '../wizard/ReviewRecap'
import { SavePatternButton } from './Pattern/SavePatternButton'

/** A note's line in body type, as the crawler review's reminder. */
const NOTE = { display: 'block', fontFamily: tokens.font.body } satisfies CSSProperties

const COLUMNS = loadoutColumns<RefSystem | RefModule>()

/** The system a mech moves by (its own text: without one the mech cannot move). */
const LOCOMOTION = /locomotion/i

type MechReviewStepProps = {
  form: MechWizardFormState
  submitError: string | null
  /**
   * Unspent Tech 1 Scrap — rendered as the banking callout
   * "N Tech 1 Scrap banks to your Union Crawler". TEXT ONLY, deliberately:
   * no cross-entity write (ADR-007 automation boundary) — the crawler's
   * Scrap Pool field is the manual landing spot.
   */
  bankedScrap: number
  /** MOCK (wave 2): the slot budgets, for the lists' sums. */
  capacity: {
    systemSlotsUsed: number
    systemSlotsMax: number
    moduleSlotsUsed: number
    moduleSlotsMax: number
  }
  /** MOCK (wave 2): the name's part (its field over its rule), leading the review. */
  namePart: ReactNode
}

/**
 * MOCK (Working Manual, wave 2) · Step 4 · Name and review. The name's part
 * leads; under it the build reads as it will on the sheet: the systems and the
 * modules a Ledger each (the picker's own columns, a copy count, the slots and
 * Scrap summed on an ink line), and beside them the chassis as its contentful
 * card, the look as Stats, and what banks to the crawler. It replaces a recap
 * panel beside one full card a pick (nine cards for a Hauler, 2,978px at 1440).
 */
export function MechReviewStep({
  form,
  submitError,
  bankedScrap,
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
  const moves = chosenSystems.some((system) => LOCOMOTION.test(system.name))

  return (
    <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
      <div className="su-wiz-compare-main">
        {namePart}
        {submitError && <FieldError>{submitError}</FieldError>}
        <div className="su-wiz-ledgers">
          <ReviewLedger
            title={mechCopy('systems')}
            entities={chosenSystems}
            columns={COLUMNS}
            empty="No systems installed."
            total={sums(capacity.systemSlotsUsed, capacity.systemSlotsMax)}
          />
          <ReviewLedger
            title={mechCopy('modules')}
            entities={chosenModules}
            columns={COLUMNS}
            empty="No modules installed."
            total={sums(capacity.moduleSlotsUsed, capacity.moduleSlotsMax)}
          />
        </div>
        {!moves && (
          <Callout role="note">
            <span style={NOTE}>
              No Locomotion System installed: this Mech cannot move. You can still create it.
            </span>
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
        {/* An unlabelled note (ruleset §5, N5), as the crawler review's reminder. */}
        <Callout role="note">
          <span style={NOTE}>{mechCopy('tech1ScrapBanksTo', { bankedScrap })}</span>
        </Callout>
        {form.chassisName && (
          <div>
            <SavePatternButton
              source={{
                name: form.name.trim() || 'Unnamed Mech',
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
