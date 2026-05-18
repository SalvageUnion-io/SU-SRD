/**
 * MechSheet — read-only mech section for the sheet view.
 *
 * Renders: mech name + chassis (resolved via salvageunion-reference), chassis
 * stats (SP/EP/heat/system slots/module slots/cargo capacity), systems list,
 * modules list (each with a read-only ConditionToggle), and cargo.
 *
 * Stats are static chassis defaults. Click-to-edit is #199 (later wave).
 *
 * Chassis resolution is dep-injectable for testing: pass `chassis` directly
 * when you don't want the component to call SalvageUnionReference at runtime.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { Mech } from '../../lib/schemas/mech'
import { ConditionToggle } from '../shared/ConditionToggle'

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
}

function resolveChassis(mech: Mech, override?: ChassisLike | null): ChassisLike | null {
  if (override !== undefined) return override
  return SalvageUnionReference.Chassis.find((c) => c.name === mech.chassisRef) ?? null
}

export function MechSheet({ mech, chassis: chassisOverride }: MechSheetProps) {
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

      {/* Stats */}
      {chassis && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Stats
          </h3>
          <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <StatBlock label="SP" value={chassis.structurePoints} />
            <StatBlock label="EP" value={chassis.energyPoints} />
            <StatBlock label="Heat" value={chassis.heatCapacity} />
            <StatBlock label="Sys" value={chassis.systemSlots} />
            <StatBlock label="Mod" value={chassis.moduleSlots} />
            <StatBlock label="Cargo" value={chassis.cargoCapacity} />
          </dl>
        </div>
      )}

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

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

type StatBlockProps = {
  label: string
  value?: number
}

function StatBlock({ label, value }: StatBlockProps) {
  return (
    <div className="flex flex-col items-center rounded border border-border py-2 text-center">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value ?? '—'}</dd>
    </div>
  )
}
