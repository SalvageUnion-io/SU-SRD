/**
 * PilotSheet — pilot section for the sheet view.
 *
 * Renders: callsign + name + class ref, abilities, equipment (with
 * ConditionToggle), and identity fields (motto, keepsake, appearance).
 *
 * Abilities and equipment are resolved against SalvageUnionReference and
 * displayed via ReferenceEntityDisplay so the sheet reads as a slice of the
 * SRD rather than a bare slug list.
 *
 * ConditionToggle persists condition changes to the entityStore via
 * handleEquipmentConditionChange. Pass readOnly=true to suppress editing
 * affordances (stat cells render as plain text; ConditionToggle is locked).
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefEntity, SURefEquipment } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { ChoiceSelections } from 'suref-react'

import { PipTracker } from './PipTracker'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { resolveClassName } from '../../lib/classRef'
import { PILOT_MAX_HP, PILOT_MAX_AP } from '../../lib/pilotStats'
import { useEntityStore } from '../../stores/entityStore'
import { ConditionToggle } from '../shared/ConditionToggle'
import { useEntityChoices } from '../shared/useEntityChoices'
import { ConditionsEditor } from './ConditionsEditor'
import { EditableStatRow } from './EditableStatRow'

function resolveAbility(slug: string): SURefAbility | null {
  const all = SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>
  return all.find((a) => a.id === slug || a.name === slug) ?? null
}

function resolveEquipment(slug: string): SURefEquipment | null {
  const all = SalvageUnionReference.Equipment.all() as ReadonlyArray<SURefEquipment>
  return all.find((e) => e.id === slug || e.name === slug) ?? null
}

type PilotEquipmentItemProps = {
  /** Equipment slug as stored on the pilot. */
  slug: string
  /** Owning pilot id — choice selections persist under this entity. */
  pilotId: string
  /**
   * Persisted choice selections for this item, sourced from the canonical pilot
   * prop. Used directly as the controlled `selections` so read-only/snapshot
   * rendering does not depend on the live store.
   */
  seedSelections: ChoiceSelections | undefined
  /** Current condition for this equipment item. */
  condition: ItemCondition
  /** Persist a new condition for this item. */
  onConditionChange: (slug: string, next: ItemCondition) => void
  /** When true, choices + condition render but are not editable. */
  readOnly: boolean
  /** Injectable store — forwarded to useEntityChoices for tests. */
  store: typeof useEntityStore
}

/**
 * Renders ONE pilot equipment item with its ReferenceEntityDisplay (choice cards
 * enabled) and a ConditionToggle.
 *
 * Extracted out of PilotSheet's `equipment.map(...)` so it can legally call the
 * useEntityChoices hook (Rules of Hooks forbid calling hooks inside a map body).
 * Choice selections persist per-slug under the pilot's `equipmentChoices` field.
 */
function PilotEquipmentItem({
  slug,
  pilotId,
  seedSelections,
  condition,
  onConditionChange,
  readOnly,
  store,
}: PilotEquipmentItemProps) {
  const equipment = resolveEquipment(slug)
  const { selections, setSelections } = useEntityChoices(
    'pilot',
    pilotId,
    slug,
    'equipmentChoices',
    seedSelections,
    store
  )

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        {equipment ? (
          <ReferenceEntityDisplay
            data={equipment as unknown as SURefEntity}
            compact
            selections={selections}
            onSelectionChange={readOnly ? undefined : setSelections}
          />
        ) : (
          <div className="rounded border border-border px-2 py-1 text-sm text-muted-foreground">
            {slug}
          </div>
        )}
      </div>
      <ConditionToggle
        value={condition}
        onChange={(next) => {
          onConditionChange(slug, next)
        }}
        ariaLabelPrefix={slug}
        readOnly={readOnly}
      />
    </div>
  )
}

type PilotSheetProps = {
  pilot: Pilot
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
  /**
   * When true, stat cells render as plain text with no click-to-edit affordance.
   * Use in read-only contexts like published snapshots.
   */
  readOnly?: boolean
}

export function PilotSheet({ pilot, store = useEntityStore, readOnly = false }: PilotSheetProps) {
  const storeState = store()

  async function handleEquipmentConditionChange(slug: string, next: ItemCondition) {
    // Read the freshest map from the store (not the render-time prop) so rapid
    // sequential toggles don't stomp each other with a stale-closure overwrite.
    const prev =
      storeState.get('pilot', pilot.id)?.equipmentConditions ?? pilot.equipmentConditions ?? {}
    await storeState.update('pilot', pilot.id, { equipmentConditions: { ...prev, [slug]: next } })
  }

  async function handleConditionsChange(next: string[]) {
    // Persist the full conditions array. (next is computed from the render-time
    // prop in ConditionsEditor; conditions are a flat list, not a per-key merge,
    // so there is no partial-patch stale-closure concern as with equipment.)
    await storeState.update('pilot', pilot.id, { conditions: next })
  }

  return (
    <section aria-labelledby="pilot-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2
          id="pilot-sheet-heading"
          className="font-cond text-xl font-bold uppercase tracking-wide text-su-black"
        >
          {pilot.callsign ? `"${pilot.callsign}" ` : ''}
          {pilot.name}
        </h2>
        <p className="text-sm text-muted-foreground">Class: {resolveClassName(pilot.classRef)}</p>
      </div>

      {/* Stats — HP + AP (live-play tracking, #245) */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Stats
        </h3>
        <dl className="grid grid-cols-2 gap-2">
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              HP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              {/* TODO: source base value from rules once pilot class data exposes HP */}
              <EditableStatRow
                label="HP"
                value={pilot.currentHP ?? 0}
                entityKind="pilot"
                entityId={pilot.id}
                fieldPath="currentHP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
            <PipTracker
              max={PILOT_MAX_HP}
              value={pilot.currentHP ?? 0}
              tone="hp"
              ariaLabel={`HP ${pilot.currentHP ?? 0} of ${PILOT_MAX_HP}`}
              className="mt-1.5"
            />
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              AP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              {/* TODO: source base value from rules once pilot class data exposes AP */}
              <EditableStatRow
                label="AP"
                value={pilot.currentAP ?? 0}
                entityKind="pilot"
                entityId={pilot.id}
                fieldPath="currentAP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
            <PipTracker
              max={PILOT_MAX_AP}
              value={pilot.currentAP ?? 0}
              tone="ap"
              ariaLabel={`AP ${pilot.currentAP ?? 0} of ${PILOT_MAX_AP}`}
              className="mt-1.5"
            />
          </div>
        </dl>
      </div>

      {/* Conditions — live-play tracker (design board-screens.jsx:237) */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Conditions
        </h3>
        <ConditionsEditor
          conditions={pilot.conditions}
          onChange={(next) => {
            void handleConditionsChange(next)
          }}
          readOnly={readOnly}
        />
      </div>

      {/* Abilities */}
      {pilot.abilities.length > 0 && (
        <div>
          <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-2">
            Abilities
          </h3>
          <div className="flex flex-col gap-3">
            {pilot.abilities.map((slug) => {
              const ability = resolveAbility(slug)
              if (!ability) {
                return (
                  <div
                    key={slug}
                    className="rounded border border-border px-2 py-1 text-sm text-muted-foreground"
                  >
                    {slug}
                  </div>
                )
              }
              return (
                <ReferenceEntityDisplay
                  key={ability.id}
                  data={ability as unknown as SURefEntity}
                  compact
                  label={ability.tree}
                  hide={{ choices: true }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Equipment */}
      {pilot.equipment.length > 0 && (
        <div>
          <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-2">
            Equipment
          </h3>
          <div className="flex flex-col gap-3">
            {pilot.equipment.map((slug) => (
              <PilotEquipmentItem
                key={slug}
                slug={slug}
                pilotId={pilot.id}
                seedSelections={pilot.equipmentChoices?.[slug]}
                condition={pilot.equipmentConditions?.[slug] ?? 'intact'}
                onConditionChange={(itemSlug, next) => {
                  void handleEquipmentConditionChange(itemSlug, next)
                }}
                readOnly={readOnly}
                store={store}
              />
            ))}
          </div>
        </div>
      )}

      {/* Identity */}
      <div className="flex flex-col gap-2">
        <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft">
          Identity
        </h3>
        {pilot.motto && (
          <p className="text-sm">
            <span className="font-medium">Motto:</span> {pilot.motto}
          </p>
        )}
        {pilot.keepsake && (
          <p className="text-sm">
            <span className="font-medium">Keepsake:</span> {pilot.keepsake}
          </p>
        )}
        {pilot.appearance && (
          <p className="text-sm">
            <span className="font-medium">Appearance:</span> {pilot.appearance}
          </p>
        )}
      </div>
    </section>
  )
}
