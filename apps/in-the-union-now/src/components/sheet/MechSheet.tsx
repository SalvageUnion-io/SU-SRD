/**
 * MechSheet — mech section for the sheet view.
 *
 * Renders: mech name + chassis (resolved via salvageunion-reference), chassis
 * stats (HP/AP/TP/SP/EP/Heat) as inline-editable fields, systems list,
 * modules list (each with a ConditionToggle), and cargo.
 *
 * Editable stats: HP, AP, TP, SP, EP, Heat — backed by optional `currentXxx`
 * fields on the Mech schema. The display falls back to chassis defaults when
 * no current value is set, giving users a sensible starting point.
 *
 * ConditionToggle persists system/module condition changes to the entityStore.
 * Pass readOnly=true to suppress editing affordances (stat cells render as
 * plain text; ConditionToggles are locked).
 *
 * Chassis resolution is dep-injectable for testing: pass `chassis` directly
 * when you don't want the component to call SalvageUnionReference at runtime.
 *
 * entityStore is also dep-injectable (defaults to useEntityStore) so tests can
 * pass a stub without module mocking.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { ItemCondition } from '../../lib/schemas/mech'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { ConditionToggle } from '../shared/ConditionToggle'
import { EditableStatRow } from './EditableStatRow'
import { PipTracker } from './PipTracker'

// Narrow subset of chassis data we actually need
type ChassisLike = {
  name: string
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  systemSlots?: number
  moduleSlots?: number
  cargoCapacity?: number
}

type MechSheetProps = {
  mech: Mech
  /**
   * Injectable chassis for testing. When omitted, resolved from
   * SalvageUnionReference.Chassis.find() via mech.chassisRef.
   */
  chassis?: ChassisLike | null
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

function resolveChassis(mech: Mech, override?: ChassisLike | null): ChassisLike | null {
  if (override !== undefined) return override
  return SalvageUnionReference.Chassis.find((c) => c.name === mech.chassisRef) ?? null
}

export function MechSheet({
  mech,
  chassis: chassisOverride,
  store = useEntityStore,
  readOnly = false,
}: MechSheetProps) {
  const chassis = resolveChassis(mech, chassisOverride)
  const storeState = store()

  async function handleSystemConditionChange(slug: string, next: ItemCondition) {
    // Read the freshest map from the store (not the render-time prop) so rapid
    // sequential toggles don't stomp each other with a stale-closure overwrite.
    const prev = storeState.get('mech', mech.id)?.systemConditions ?? mech.systemConditions ?? {}
    await storeState.update('mech', mech.id, { systemConditions: { ...prev, [slug]: next } })
  }

  async function handleModuleConditionChange(slug: string, next: ItemCondition) {
    const prev = storeState.get('mech', mech.id)?.moduleConditions ?? mech.moduleConditions ?? {}
    await storeState.update('mech', mech.id, { moduleConditions: { ...prev, [slug]: next } })
  }

  return (
    <section aria-labelledby="mech-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2
          id="mech-sheet-heading"
          className="font-cond text-xl font-bold uppercase tracking-wide text-su-black"
        >
          {mech.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Chassis: {chassis ? chassis.name : mech.chassisRef}
        </p>
      </div>

      {/* Stats — inline-editable via EditableStatRow (AC-1 + AC-2) */}
      {/* Rendered regardless of chassis resolution; falls back to stored values or 0 when chassis is null */}
      <div>
        <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-2">
          Stats
        </h3>
        {!chassis && (
          <p
            role="alert"
            className="mb-2 rounded border-[1.5px] border-su-sickly-yellow bg-su-paper px-3 py-2 text-sm text-su-rust"
          >
            Unknown chassis &ldquo;{mech.chassisRef}&rdquo; — using stored/zero defaults
          </p>
        )}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              HP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="HP"
                value={mech.currentHP ?? chassis?.structurePoints ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentHP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              AP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="AP"
                value={mech.currentAP ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentAP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              TP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="TP"
                value={mech.currentTP ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentTP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              SP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="SP"
                value={mech.currentSP ?? chassis?.structurePoints ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentSP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
            <PipTracker
              max={chassis?.structurePoints ?? 0}
              value={mech.currentSP ?? chassis?.structurePoints ?? 0}
              tone="hp"
              ariaLabel={`SP ${mech.currentSP ?? chassis?.structurePoints ?? 0} of ${chassis?.structurePoints ?? 0}`}
              className="mt-1.5"
            />
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              EP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="EP"
                value={mech.currentEP ?? chassis?.energyPoints ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentEP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
            <PipTracker
              max={chassis?.energyPoints ?? 0}
              value={mech.currentEP ?? chassis?.energyPoints ?? 0}
              tone="ap"
              ariaLabel={`EP ${mech.currentEP ?? chassis?.energyPoints ?? 0} of ${chassis?.energyPoints ?? 0}`}
              className="mt-1.5"
            />
          </div>
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              Heat
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="Heat"
                value={mech.currentHeat ?? chassis?.heatCapacity ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentHeat"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
            <PipTracker
              max={chassis?.heatCapacity ?? 0}
              value={mech.currentHeat ?? chassis?.heatCapacity ?? 0}
              tone="ap"
              ariaLabel={`Heat ${mech.currentHeat ?? chassis?.heatCapacity ?? 0} of ${chassis?.heatCapacity ?? 0}`}
              className="mt-1.5"
            />
          </div>
        </dl>
      </div>

      {/* Systems */}
      {mech.systems.length > 0 && (
        <div>
          <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-1">
            Systems
          </h3>
          <ul className="flex flex-col gap-1">
            {mech.systems.map((slug) => (
              <li
                key={slug}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
              >
                <span>{slug}</span>
                <ConditionToggle
                  value={mech.systemConditions?.[slug] ?? 'intact'}
                  onChange={(next) => {
                    void handleSystemConditionChange(slug, next)
                  }}
                  ariaLabelPrefix={slug}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modules */}
      {mech.modules.length > 0 && (
        <div>
          <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-1">
            Modules
          </h3>
          <ul className="flex flex-col gap-1">
            {mech.modules.map((slug) => (
              <li
                key={slug}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
              >
                <span>{slug}</span>
                <ConditionToggle
                  value={mech.moduleConditions?.[slug] ?? 'intact'}
                  onChange={(next) => {
                    void handleModuleConditionChange(slug, next)
                  }}
                  ariaLabelPrefix={slug}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cargo */}
      {mech.cargo.length > 0 && (
        <div>
          <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-1">
            Cargo
          </h3>
          <ul className="flex flex-col gap-1">
            {mech.cargo.map((slug, i) => (
              <li key={`${slug}-${i}`} className="rounded border border-border px-2 py-1 text-sm">
                {slug}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
