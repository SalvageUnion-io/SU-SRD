/**
 * PilotSheet — read-only pilot section for the sheet view.
 *
 * Renders: callsign + name + class ref, abilities, equipment (with read-only
 * ConditionToggle), and identity fields (motto, keepsake, appearance).
 *
 * Abilities and equipment are resolved against SalvageUnionReference and
 * displayed via ReferenceEntityDisplay so the sheet reads as a slice of the
 * SRD rather than a bare slug list.
 *
 * ConditionToggle is rendered in display-only mode: the onChange handler is a
 * no-op, so clicks have no effect.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefEntity, SURefEquipment } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { ConditionToggle } from '../shared/ConditionToggle'
import { EditableStatRow } from './EditableStatRow'

function resolveAbility(slug: string): SURefAbility | null {
  const all = SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>
  return all.find((a) => a.id === slug || a.name === slug) ?? null
}

function resolveEquipment(slug: string): SURefEquipment | null {
  const all = SalvageUnionReference.Equipment.all() as ReadonlyArray<SURefEquipment>
  return all.find((e) => e.id === slug || e.name === slug) ?? null
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
    const prev = pilot.equipmentConditions ?? {}
    await storeState.update('pilot', pilot.id, { equipmentConditions: { ...prev, [slug]: next } })
  }

  return (
    <section aria-labelledby="pilot-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 id="pilot-sheet-heading" className="text-xl font-bold">
          {pilot.callsign ? `"${pilot.callsign}" ` : ''}
          {pilot.name}
        </h2>
        <p className="text-sm text-muted-foreground">Class: {pilot.classRef}</p>
      </div>

      {/* Stats — HP + AP (live-play tracking, #245) */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Stats
        </h3>
        <dl className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">HP</dt>
            <dd className="text-lg font-semibold">
              {/* TODO: source base value from rules once pilot class data exposes HP */}
              <EditableStatRow
                label=""
                value={pilot.currentHP ?? 0}
                entityKind="pilot"
                entityId={pilot.id}
                fieldPath="currentHP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
          </div>
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">AP</dt>
            <dd className="text-lg font-semibold">
              {/* TODO: source base value from rules once pilot class data exposes AP */}
              <EditableStatRow
                label=""
                value={pilot.currentAP ?? 0}
                entityKind="pilot"
                entityId={pilot.id}
                fieldPath="currentAP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
          </div>
        </dl>
      </div>

      {/* Abilities */}
      {pilot.abilities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Equipment
          </h3>
          <div className="flex flex-col gap-3">
            {pilot.equipment.map((slug) => {
              const equipment = resolveEquipment(slug)
              return (
                <div key={slug} className="flex items-start gap-2">
                  <div className="flex-1">
                    {equipment ? (
                      <ReferenceEntityDisplay
                        data={equipment as unknown as SURefEntity}
                        compact
                        hide={{ choices: true }}
                      />
                    ) : (
                      <div className="rounded border border-border px-2 py-1 text-sm text-muted-foreground">
                        {slug}
                      </div>
                    )}
                  </div>
                  <ConditionToggle
                    value={pilot.equipmentConditions?.[slug] ?? 'intact'}
                    onChange={(next) => {
                      void handleEquipmentConditionChange(slug, next)
                    }}
                    ariaLabelPrefix={slug}
                    readOnly={readOnly}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Identity */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
