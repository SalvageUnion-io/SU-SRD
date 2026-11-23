import type { RefAbility, RefClass, RefEquipment } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { FieldError } from '../../components/app'
import { Box, ReferenceEntityCard } from '../../components/index'
import { pilotInventoryUsed } from '../../lib/rules/pilotInventory'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'
import { storedPilotNames } from '../../lib/wizard/pilotFormState'
import { pilotCopy } from '../../messages/build-pilot'
import { abilityColumns, equipmentColumns } from '../wizard/pickColumns'
import { ReviewLedger } from '../wizard/ReviewLedger'
import { Recap, RecapEntity, RecapStat } from '../wizard/ReviewRecap'
import { StatsStep } from './StatsStep'

/**
 * Typed lookup surfaces for the injectable SUR seam — declared against the
 * real reference entity types so results feed entity cards without casts.
 */
type SURFindAll<T> = { findAll: (fn: (x: T) => boolean) => T[] }
type SURFind<T> = { find: (fn: (x: T) => boolean) => T | undefined }

type ReviewStepProps = {
  form: PilotWizardFormState
  submitError: string | null
  /** Injectable SUR for testing. */
  _sur?: {
    Classes: SURFind<RefClass>
    Abilities: SURFindAll<RefAbility>
    Equipment: SURFindAll<RefEquipment>
  }
}

const ABILITY_COLUMNS = abilityColumns<RefAbility>()

/**
 * Step 4 · Review. The pilot as the sheet will read: who they are as Stats,
 * their starting numbers, their ability and their equipment a Ledger each
 * (the pickers' own columns, each made choice a chip under its line, hard
 * rule R60), and their class beside it as its contentful card.
 */
export function ReviewStep({ form, submitError, _sur }: ReviewStepProps) {
  const choices = form.equipmentChoices
  const stored = storedPilotNames(form)
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  const selectedClass = form.classId ? surClasses.find((c) => c.id === form.classId) : undefined
  const chosenAbilities = form.abilities
    .map((slug) => surAbilities.findAll((a) => nameToSlug(a.name) === slug)[0])
    .filter((a) => a !== undefined)
  const chosenEquipment = form.equipment
    .map((slug) => surEquipment.findAll((e) => nameToSlug(e.name) === slug)[0])
    .filter((e) => e !== undefined)
  const equipmentCols = equipmentColumns<RefEquipment>((item) => choices?.[nameToSlug(item.name)])

  return (
    <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
      <div className="su-wiz-compare-main">
        <Box bodyClassName="su-wiz-review-panel">
          <Recap>
            {/* As stored: the optional name, left blank, is the required one (r7 F7). */}
            <RecapStat label={pilotCopy('callsign')} value={stored.callsign} required />
            <RecapStat label={pilotCopy('name')} value={stored.name} required />
            <RecapEntity label={pilotCopy('class')} entity={selectedClass} required />
            <RecapStat label={pilotCopy('motto')} value={form.motto} />
            <RecapStat label={pilotCopy('keepsake')} value={form.keepsake} />
            <RecapStat label={pilotCopy('appearance')} value={form.appearance} />
            <RecapStat label={pilotCopy('background')} value={form.background} />
          </Recap>
          {submitError && <FieldError>{submitError}</FieldError>}
        </Box>
        <StatsStep
          inventoryUsed={pilotInventoryUsed({ equipment: form.equipment, genericInventory: [] })}
        />
        <div className="su-wiz-ledgers">
          <ReviewLedger
            title={pilotCopy('abilities')}
            entities={chosenAbilities}
            columns={ABILITY_COLUMNS}
            empty={pilotCopy('noAbilityChosen')}
          />
          <ReviewLedger
            title={pilotCopy('equipment')}
            entities={chosenEquipment}
            columns={equipmentCols}
            choices={choices}
            empty={pilotCopy('noEquipmentChosen')}
          />
        </div>
      </div>
      <div className="su-wiz-compare-detail">
        {selectedClass && (
          <ReferenceEntityCard
            data={selectedClass}
            size="compact"
            hide={{ actions: true, choices: true }}
          />
        )}
      </div>
    </div>
  )
}
