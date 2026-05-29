/**
 * MechSheet — mech section for the sheet view.
 *
 * Renders: mech name + chassis (resolved via salvageunion-reference), chassis
 * stats (SP/EP/Heat/Sys/Mod/Cargo) as inline-editable fields (Wave 6, #199),
 * systems list, modules list (each with a read-only ConditionToggle), and cargo.
 *
 * Editable stats: HP, AP, TP, SP, EP, Heat — backed by optional `currentXxx`
 * fields on the Mech schema (Wave 6). The display falls back to chassis defaults
 * when no current value is set, giving users a sensible starting point.
 *
 * Chassis resolution is dep-injectable for testing: pass `chassis` directly
 * when you don't want the component to call SalvageUnionReference at runtime.
 *
 * entityStore is also dep-injectable (defaults to useEntityStore) so tests can
 * pass a stub without module mocking.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { ConditionToggle } from '../shared/ConditionToggle'
import { EditableStatRow } from './EditableStatRow'

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
}

function resolveChassis(mech: Mech, override?: ChassisLike | null): ChassisLike | null {
  if (override !== undefined) return override
  return SalvageUnionReference.Chassis.find((c) => c.name === mech.chassisRef) ?? null
}

export function MechSheet({
  mech,
  chassis: chassisOverride,
  store = useEntityStore,
}: MechSheetProps) {
  const chassis = resolveChassis(mech, chassisOverride)

  return (
    <section aria-labelledby="mech-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 id="mech-sheet-heading" className="text-xl font-bold">
          {mech.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Chassis: {chassis ? chassis.name : mech.chassisRef}
        </p>
      </div>

      {/* Stats — inline-editable via EditableStatRow (AC-1 + AC-2) */}
      {/* Rendered regardless of chassis resolution; falls back to stored values or 0 when chassis is null */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Stats
        </h3>
        {!chassis && (
          <p
            role="alert"
            className="mb-2 rounded border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-800"
          >
            Unknown chassis &ldquo;{mech.chassisRef}&rdquo; — using stored/zero defaults
          </p>
        )}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">HP</dt>
            <dd className="text-lg font-semibold">
              <EditableStatRow
                label=""
                value={mech.currentHP ?? chassis?.structurePoints ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentHP"
                min={0}
                store={store}
              />
            </dd>
          </div>
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">AP</dt>
            <dd className="text-lg font-semibold">
              <EditableStatRow
                label=""
                value={mech.currentAP ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentAP"
                min={0}
                store={store}
              />
            </dd>
          </div>
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">TP</dt>
            <dd className="text-lg font-semibold">
              <EditableStatRow
                label=""
                value={mech.currentTP ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentTP"
                min={0}
                store={store}
              />
            </dd>
          </div>
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">SP</dt>
            <dd className="text-lg font-semibold">
              <EditableStatRow
                label=""
                value={mech.currentSP ?? chassis?.structurePoints ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentSP"
                min={0}
                store={store}
              />
            </dd>
          </div>
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">EP</dt>
            <dd className="text-lg font-semibold">
              <EditableStatRow
                label=""
                value={mech.currentEP ?? chassis?.energyPoints ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentEP"
                min={0}
                store={store}
              />
            </dd>
          </div>
          <div className="flex flex-col items-center rounded border border-border py-2 text-center">
            <dt className="text-xs text-muted-foreground">Heat</dt>
            <dd className="text-lg font-semibold">
              <EditableStatRow
                label=""
                value={mech.currentHeat ?? chassis?.heatCapacity ?? 0}
                entityKind="mech"
                entityId={mech.id}
                fieldPath="currentHeat"
                min={0}
                store={store}
              />
            </dd>
          </div>
        </dl>
      </div>

      {/* Systems */}
      {mech.systems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Systems
          </h3>
          <ul className="flex flex-col gap-1">
            {mech.systems.map((slug) => (
              <li
                key={slug}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
              >
                <span>{slug}</span>
                <ConditionToggle value="intact" onChange={() => undefined} ariaLabelPrefix={slug} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modules */}
      {mech.modules.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Modules
          </h3>
          <ul className="flex flex-col gap-1">
            {mech.modules.map((slug) => (
              <li
                key={slug}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
              >
                <span>{slug}</span>
                <ConditionToggle value="intact" onChange={() => undefined} ariaLabelPrefix={slug} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cargo */}
      {mech.cargo.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
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
