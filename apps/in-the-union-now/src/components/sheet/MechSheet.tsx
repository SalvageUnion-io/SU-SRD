/**
 * MechSheet — mech section for the sheet view.
 *
 * Renders: mech name + chassis (resolved via salvageunion-reference), chassis
 * stats (HP/AP/TP/SP/EP/Heat) as inline-editable fields, systems and modules
 * (each resolved to its reference entity and rendered as an interactive
 * ReferenceEntityDisplay card with an in-context ConditionToggle), and cargo.
 *
 * Mech systems/modules carry no choices in the data, so the cards hide the
 * choices section. A slug that does not resolve falls back to plain text.
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
import type { SURefEntity, SURefModule, SURefSystem } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { ItemCondition } from '../../lib/schemas/mech'
import type { Mech } from '../../lib/schemas/mech'
import type { Roll } from '../../lib/rules/heatCheck'
import { useEntityStore } from '../../stores/entityStore'
import { ConditionToggle } from '../shared/ConditionToggle'
import { EditableStatRow } from './EditableStatRow'
import { HeatCheckControl } from './HeatCheckControl'
import { PipTracker } from './PipTracker'
import { SheetSectionHeading } from './SheetSectionHeading'

/**
 * Stable `hide` object literal shared across MechItem (and PilotAbilityItem)
 * renders. Hoisted to module scope so its referential identity is constant —
 * a fresh `{ choices: true }` literal on every render would defeat the
 * React.memo on the (heavy) ReferenceEntityDisplay subtree.
 */
export const HIDE_CHOICES = { choices: true } as const

function resolveSystem(slug: string): SURefSystem | null {
  const all = SalvageUnionReference.Systems.all() as ReadonlyArray<SURefSystem>
  return all.find((s) => s.id === slug || s.name === slug) ?? null
}

function resolveModule(slug: string): SURefModule | null {
  const all = SalvageUnionReference.Modules.all() as ReadonlyArray<SURefModule>
  return all.find((m) => m.id === slug || m.name === slug) ?? null
}

type MechItemProps = {
  /** System/module slug as stored on the mech. */
  slug: string
  /** Resolved reference entity, or null when the slug does not resolve. */
  entity: SURefSystem | SURefModule | null
  /** Current condition for this item. */
  condition: ItemCondition
  /** Persist a new condition for this item. */
  onConditionChange: (slug: string, next: ItemCondition) => void
  /** When true, the condition toggle is locked. */
  readOnly: boolean
}

/**
 * Renders ONE mech system or module as an interactive ReferenceEntityDisplay
 * (compact, choices hidden — mech systems/modules carry no choices) paired with
 * a ConditionToggle. Falls back to the plain-text slug when the entity does not
 * resolve, so an unknown slug never crashes the sheet.
 */
function MechItem({ slug, entity, condition, onConditionChange, readOnly }: MechItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        {entity ? (
          <ReferenceEntityDisplay
            data={entity as unknown as SURefEntity}
            compact
            hide={HIDE_CHOICES}
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
  /**
   * Injectable d20 roller for the Heat Check loop — defaults to a Math.random
   * roll. Pass a deterministic roller in tests.
   */
  roll?: Roll
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
  roll,
}: MechSheetProps) {
  const chassis = resolveChassis(mech, chassisOverride)
  const storeState = store()
  const heatCap = chassis?.heatCapacity ?? 0
  const currentHeat = mech.currentHeat ?? heatCap
  const currentSP = mech.currentSP ?? chassis?.structurePoints ?? 0

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
        <SheetSectionHeading kind="mech">Stats</SheetSectionHeading>
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
                max={chassis?.structurePoints ?? undefined}
                step={1}
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
                max={chassis?.energyPoints ?? undefined}
                step={1}
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
                max={heatCap}
                step={1}
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

      {/* Heat Check / Reactor Overload loop (Slice C) */}
      <HeatCheckControl
        mech={mech}
        heatCap={heatCap}
        currentSP={currentSP}
        currentHeat={currentHeat}
        store={store}
        roll={roll}
        readOnly={readOnly}
      />

      {/* Systems */}
      {mech.systems.length > 0 && (
        <div>
          <SheetSectionHeading kind="mech" className="mb-1">
            Systems
          </SheetSectionHeading>
          <div className="flex flex-col gap-3">
            {mech.systems.map((slug) => (
              <MechItem
                key={slug}
                slug={slug}
                entity={resolveSystem(slug)}
                condition={mech.systemConditions?.[slug] ?? 'intact'}
                onConditionChange={(itemSlug, next) => {
                  void handleSystemConditionChange(itemSlug, next)
                }}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      {mech.modules.length > 0 && (
        <div>
          <SheetSectionHeading kind="mech" className="mb-1">
            Modules
          </SheetSectionHeading>
          <div className="flex flex-col gap-3">
            {mech.modules.map((slug) => (
              <MechItem
                key={slug}
                slug={slug}
                entity={resolveModule(slug)}
                condition={mech.moduleConditions?.[slug] ?? 'intact'}
                onConditionChange={(itemSlug, next) => {
                  void handleModuleConditionChange(itemSlug, next)
                }}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cargo */}
      {mech.cargo.length > 0 && (
        <div>
          <SheetSectionHeading kind="mech" className="mb-1">
            Cargo
          </SheetSectionHeading>
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
