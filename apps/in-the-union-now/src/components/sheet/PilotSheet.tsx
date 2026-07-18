/**
 * PilotSheet — the pilot body for the LiveSheet shell (redesign Phase 2:
 * poster containers & section structure, pilot slice).
 *
 * The poster region grid (`clean-pilot.html`) — a single-column stack on
 * mobile, a 12-col `@container` grid at the wide breakpoint:
 *   - R1: Identity (span 7) ∥ Vitals (span 5) — MOVED here from the hero
 *     (SheetHero now carries only the name row + meta for pilot).
 *   - R2: Abilities (full width) — entity cards with Spend AP (fixed costs
 *     only) and a used/recharge toggle in the card foot.
 *   - R3: Inventory (span 7) ∥ Linked Units (span 5) — the linked-unit rail
 *     MOVED here from the hero's bottom strip.
 *
 * Every collection/field section is framed by `SheetSectionCard` (the poster
 * `.dcard`), except Linked Units which the poster renders as a bare `.sect`
 * header + rail stack (no card frame).
 *
 * Dropped (redesign D6 — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - `PilotTakeDamageControl` (#406) — Take Damage / Critical Injury loop.
 *   - the Injuries slab + `InjuryRow` (#408) — severity-enum list editor.
 *   - the Bio `SheetDescription` section (#409) — folded into the Identity
 *     card instead as an extra field (see `PilotIdentityPanel`'s Bio field).
 *   - the Crawler Level slab (#410) — `resolveEffectiveCrawlerLevel` is
 *     PRESERVED below (still scales the Modification-style choice caps); only
 *     the manual-fallback editor UI is dropped.
 * The always-live Vitals gauges and per-card activation (Spend AP, Use /
 * Restock, condition cycling) are KEPT — only the play-control PANELS drop.
 *
 * All handlers read the freshest record from the store (never the render-time
 * prop) so rapid sequential edits don't stomp each other. readOnly suppresses
 * every edit affordance (published snapshots).
 */

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility } from 'salvageunion-reference'
import { Panel, Stat, StepBtn, VitalGauge } from 'component-lib'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry, Pilot } from '../../lib/schemas/pilot'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { isPilotDead, pilotMaxAP, pilotMaxHP } from '../../lib/rules/derivedStats'
import { useEntityStore } from '../../stores/entityStore'
import { type ClassLike, treesFor } from '../pilot/abilityTrees'
import { EntitySearcher } from 'component-lib'
import { useSoftLinks } from '../wiring/useSoftLinks'
import { ConditionsEditor } from './ConditionsEditor'
import { destroyedUndoToast } from './destroyedUndoToast'
import { Ecflow, Erow } from './Erow'
import { PilotIdentityPanel } from './PilotIdentity'
import type { UsedToggleKey } from './PilotIdentity'
import { SectionAddButton, SectionChead, SectionEditButton, SheetPickerModal } from './SheetSection'
import { SheetSectionCard } from './SheetSectionCard'
import { pilotInventoryCapacity, pilotInventoryUsed, resolveEquipment } from './pilotInventory'
import type { SheetPatch } from './sheetViewProps'
import {
  GenericEntryAdder,
  GenericEntryCard,
  PilotAbilityItem,
  PilotEquipmentItem,
  resolveAbility,
} from './PilotSheetItems'

// ---------------------------------------------------------------------------
// TpBlock — pilot Training Points as the poster's bordered `.tpblock` (G9:
// stamp / 30px numeral / caption), in the Vitals card's dashed-topped `.vrow`
// beside Conditions. Keeps the StatBlock unbounded-counter accessible
// contract it replaces — role="group" aria-label "TP {value}" and
// Increase/Decrease TP steppers — so existing tests keep passing.
// ---------------------------------------------------------------------------

function TpBlock({
  value,
  onChange,
  editable,
}: {
  value: number
  onChange?: (next: number) => void
  editable: boolean
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a framed TP readout is not a <fieldset>; role="group" carries the same grouping semantics
    <div
      role="group"
      aria-label={`TP ${value}`}
      className="flex shrink-0 flex-col items-center gap-1 rounded-[3px] border-2 border-ink bg-paper px-3.5 py-2 text-center"
    >
      <span className="box-decoration-clone inline bg-ink px-[0.5em] pb-[0.16em] pt-[0.1em] font-cond text-[11px] font-bold uppercase leading-[1.5] tracking-widest text-paper">
        TP
      </span>
      <span className="flex items-center gap-1.5">
        {editable && (
          <StepBtn aria-label="Decrease TP" onClick={() => onChange?.(Math.max(0, value - 1))}>
            &ndash;
          </StepBtn>
        )}
        <span className="min-w-[1.4em] font-body text-[30px] font-bold leading-[1.05] tabular-nums text-ink">
          {value}
        </span>
        {editable && (
          <StepBtn aria-label="Increase TP" onClick={() => onChange?.(value + 1)}>
            +
          </StepBtn>
        )}
      </span>
      <span className="font-cond text-[8px] font-semibold uppercase leading-none tracking-[0.16em] text-ink/55">
        Training Points
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PilotSheet
// ---------------------------------------------------------------------------

type PilotSheetProps = {
  pilot: Pilot
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
  /** When true, every edit affordance is suppressed (published snapshots). */
  readOnly?: boolean
  /**
   * The Linked Units rail content (mech + crawler RailChip/RailEmpty), built
   * by SheetPilot from `composition` — PilotSheet has no composition access
   * of its own, so this is passed straight through into the R3 section.
   */
  linkedUnits?: ReactNode
}

export function PilotSheet({
  pilot,
  store = useEntityStore,
  readOnly = false,
  linkedUnits,
}: PilotSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  const [picker, setPicker] = useState<'abilities' | 'equipment' | null>(null)
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, now rendered in the SheetSectionCard header (Phase 2).
  const [identityEditing, setIdentityEditing] = useState(false)

  // Resolve the pilot's crawler (if any) via the pilot-to-crawler SoftLink,
  // then compute the EFFECTIVE crawler Tech Level used to scale choice caps
  // (e.g. the Modification choice). A linked crawler's techLevel wins; with no
  // link the pilot's manual `crawlerLevel` is used; with neither it is
  // undefined and caps stay unbounded. (The Crawler Level slab UI is dropped
  // — #410 — but this scaling source stays live.)
  const { outgoing } = useSoftLinks({
    entityType: 'pilot',
    entityId: pilot.id,
    // Forward the injected store snapshot so tests drive SoftLinks through the
    // same stub; in production `storeState` is the live Zustand snapshot.
    store: storeState,
  })
  const crawlerLink = outgoing.find((link) => link.type === 'pilot-to-crawler')
  const linkedCrawler = crawlerLink ? storeState.get('crawler', crawlerLink.to.id) : null
  const effectiveCrawlerLevel = resolveEffectiveCrawlerLevel(pilot, linkedCrawler)
  // Memoized so the {techLevel} object's identity is stable across renders —
  // a fresh literal each render would defeat the React.memo on the (heavy)
  // ReferenceEntityDisplay subtree it is threaded into.
  const scalingParent = useMemo(
    () => (effectiveCrawlerLevel !== undefined ? { techLevel: effectiveCrawlerLevel } : undefined),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- intentional: effectiveCrawlerLevel is a derived scalar, memoized purely to keep the {techLevel} object identity stable for the memoized ReferenceEntityDisplay subtree
    [effectiveCrawlerLevel]
  )

  const dead = isPilotDead(pilot)
  const slotsUsed = pilotInventoryUsed(pilot)
  const slotsCap = pilotInventoryCapacity(pilot)
  const overCapacity = slotsUsed > slotsCap
  const genericInventory = pilot.genericInventory ?? []

  // Abilities offered on the live sheet are scoped to the pilot's class trees
  // (core + advanced + legendary + any tree they've already learned) — the same
  // edit-mode logic AbilitiesStep used, now feeding the shared searcher's filter.
  // Computed only while the Abilities picker is open: it reads the reference ORM,
  // which read-only snapshot renders never preload (the picker never opens there).
  const abilityTrees = useMemo(() => {
    if (picker !== 'abilities') return null
    const cls = SalvageUnionReference.Classes.find(
      (c) => (c as { id: string }).id === pilot.classRef
    ) as ClassLike | undefined
    if (!cls) return null
    const selectedTrees = (SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>)
      .filter((a) => pilot.abilities.includes(a.id))
      .map((a) => a.tree)
    return new Set(treesFor(cls, true, selectedTrees))
  }, [picker, pilot.classRef, pilot.abilities])

  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)
  const tp = pilot.trainingPoints ?? 0

  /** Freshest pilot record from the store, falling back to the render prop. */
  function freshPilot(): Pilot {
    return storeState.get('pilot', pilot.id) ?? pilot
  }

  /** Partial merge on this pilot, reading the freshest record when needed. */
  const patchPilot: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(freshPilot()) : input
    void storeState.update('pilot', pilot.id, fields)
  }

  // Cap overrides (ADR-022, Free Edit): pin HP/AP maxima via a signed
  // max*Modifier delta; the gauge shows "overridden from N" + a revert. Tagged
  // `override` for the Change Log.
  const derivedMaxHP = maxHP - (pilot.maxHpModifier ?? 0)
  const derivedMaxAP = maxAP - (pilot.maxApModifier ?? 0)
  const overridePilotMax = (fields: Partial<Pilot>) => {
    void storeState.update('pilot', pilot.id, fields, { kind: 'override' })
  }
  const modOrUndef = (next: number, derived: number): number | undefined => {
    const mod = next - derived
    return mod === 0 ? undefined : mod
  }

  /** Toggle one of the once-per-Downtime used flags (rules A8–A10). */
  function toggleUsed(key: UsedToggleKey, next: boolean) {
    const fresh = freshPilot()
    const prev = fresh.usedToggles ?? {}
    void storeState.update('pilot', pilot.id, {
      usedToggles: { ...prev, [key]: next },
    })
  }

  /** Persist the full conditions list (flat string set, no partial merge). */
  function handleConditionsChange(next: string[]) {
    void storeState.update('pilot', pilot.id, { conditions: next })
  }

  // Collection add/remove (unified edit language archetype B) — always
  // available, writes through on toggle (ITUN auto-saves; no Save button).
  // Reads the FRESHEST record so rapid toggles in the picker grid don't race
  // the async store write.
  // TODO(redesign): rule-gate add/remove (TP budget / maxAbilities / slot
  // caps) — deferred; users self-manage for now.
  function toggleAbility(abilityId: string) {
    const abilities = freshPilot().abilities
    void storeState.update('pilot', pilot.id, {
      abilities: abilities.includes(abilityId)
        ? abilities.filter((a) => a !== abilityId)
        : [...abilities, abilityId],
    })
  }

  function toggleEquipment(equipmentId: string) {
    const equipment = freshPilot().equipment
    void storeState.update('pilot', pilot.id, {
      equipment: equipment.includes(equipmentId)
        ? equipment.filter((e) => e !== equipmentId)
        : [...equipment, equipmentId],
    })
  }

  async function handleEquipmentConditionChange(slug: string, next: ItemCondition) {
    const prev = freshPilot().equipmentConditions ?? {}
    const prevCondition = prev[slug] ?? 'intact'
    await storeState.update('pilot', pilot.id, {
      equipmentConditions: { ...prev, [slug]: next },
    })
    // U-6: landing on 'destroyed' offers a one-tap Undo (mis-tap mid-combat).
    if (next === 'destroyed' && prevCondition !== 'destroyed') {
      const name = resolveEquipment(slug)?.name ?? slug
      destroyedUndoToast(name, () => {
        void handleEquipmentConditionChange(slug, prevCondition)
      })
    }
  }

  async function handleUsesChange(slug: string, next: number) {
    const prev = freshPilot().equipmentUses ?? {}
    await storeState.update('pilot', pilot.id, {
      equipmentUses: { ...prev, [slug]: next },
    })
  }

  async function handleSpendAP(cost: number) {
    const p = freshPilot()
    const current = p.currentAP ?? pilotMaxAP(p)
    const next = Math.max(0, current - cost)
    if (next === current) return
    await storeState.update('pilot', pilot.id, { currentAP: next })
  }

  async function handleAbilityUsedChange(slug: string, next: boolean) {
    const prev = new Set(freshPilot().usedAbilities ?? [])
    if (next) {
      prev.add(slug)
    } else {
      prev.delete(slug)
    }
    await storeState.update('pilot', pilot.id, {
      usedAbilities: Array.from(prev),
    })
  }

  async function handleGenericInventoryChange(next: GenericInventoryEntry[]) {
    await storeState.update('pilot', pilot.id, { genericInventory: next })
  }

  return (
    <section
      aria-label={`${pilot.name} pilot details`}
      // `.sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width (redesign D7), not the viewport.
      className="sheet-section @container flex flex-col gap-6"
    >
      {/* Dead state (rules A2: max HP 0 = death). Display-only — the record
          stays editable so an erroneous injury can be removed. */}
      {dead && (
        <div
          role="alert"
          className="rounded-[3px] border-entity border-status-bad bg-paper px-4 py-3"
        >
          <p className="m-0 font-cond text-lg font-bold uppercase tracking-caps text-status-bad">
            Killed in Action
          </p>
          <p className="m-0 font-body text-sm text-ink">
            Injuries have reduced this pilot&rsquo;s maximum HP to 0. Remove an injury below if this
            was a bookkeeping error — otherwise, raise a glass.
          </p>
        </div>
      )}

      {/* ===== R1: Identity ∥ Vitals (poster top band) ===== */}
      <div className="grid grid-cols-1 gap-[22px] @5xl:grid-cols-12 @5xl:gap-6">
        <div className="@5xl:col-span-7">
          <SheetSectionCard
            title="Identity"
            controls={
              !readOnly ? (
                <SectionEditButton
                  section="Identity"
                  editing={identityEditing}
                  onToggle={() => setIdentityEditing((v) => !v)}
                />
              ) : undefined
            }
          >
            <PilotIdentityPanel
              pilot={pilot}
              editing={identityEditing}
              onToggleUsed={readOnly ? undefined : toggleUsed}
              patch={readOnly ? undefined : patchPilot}
            />
          </SheetSectionCard>
        </div>

        <div className="@5xl:col-span-5">
          <SheetSectionCard title="Vitals">
            <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
              <VitalGauge
                label="HP"
                value={hp}
                max={maxHP}
                onChange={readOnly ? undefined : (v) => patchPilot({ currentHP: v })}
                onMaxChange={
                  readOnly
                    ? undefined
                    : (next) => overridePilotMax({ maxHpModifier: modOrUndef(next, derivedMaxHP) })
                }
                overriddenFrom={readOnly ? undefined : derivedMaxHP}
                onRevertOverride={
                  readOnly ? undefined : () => overridePilotMax({ maxHpModifier: undefined })
                }
                readOnly={readOnly}
              />
              <VitalGauge
                label="AP"
                value={ap}
                max={maxAP}
                onChange={readOnly ? undefined : (v) => patchPilot({ currentAP: v })}
                onMaxChange={
                  readOnly
                    ? undefined
                    : (next) => overridePilotMax({ maxApModifier: modOrUndef(next, derivedMaxAP) })
                }
                overriddenFrom={readOnly ? undefined : derivedMaxAP}
                onRevertOverride={
                  readOnly ? undefined : () => overridePilotMax({ maxApModifier: undefined })
                }
                readOnly={readOnly}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] pt-[14px]">
              <TpBlock
                value={tp}
                onChange={readOnly ? undefined : (v) => patchPilot({ trainingPoints: v })}
                editable={!readOnly}
              />
              <div className="w-full min-w-0 flex-1">
                <span
                  className="mb-2 block font-cond text-label font-bold uppercase leading-none tracking-caps"
                  style={{ color: 'var(--tone-deep, var(--color-ink))' }}
                >
                  Conditions
                </span>
                <ConditionsEditor
                  conditions={pilot.conditions}
                  onChange={handleConditionsChange}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </SheetSectionCard>
        </div>
      </div>

      {/* ===== R2: Abilities (full width) ===== */}
      <SheetSectionCard
        title="Abilities"
        count={
          <Stat orientation="horizontal" compact label="Known" value={pilot.abilities.length} />
        }
        controls={
          readOnly ? undefined : (
            <SectionAddButton label="ability" onClick={() => setPicker('abilities')} />
          )
        }
      >
        {pilot.abilities.length === 0 ? (
          <p className="font-body text-caption text-wk-muted">No abilities learned yet.</p>
        ) : (
          <Ecflow>
            {pilot.abilities.map((slug) => {
              const ability = resolveAbility(slug)
              if (!ability) {
                return (
                  <Erow key={slug}>
                    <Panel className="px-3 py-2.5 font-body text-sm text-wk-muted">{slug}</Panel>
                  </Erow>
                )
              }
              return (
                <Erow key={ability.id}>
                  <PilotAbilityItem
                    ability={ability}
                    currentAP={pilot.currentAP ?? pilotMaxAP(pilot)}
                    used={pilot.usedAbilities?.includes(slug) ?? false}
                    onSpend={(cost) => {
                      void handleSpendAP(cost)
                    }}
                    onToggleUsed={(next) => {
                      void handleAbilityUsedChange(slug, next)
                    }}
                    onRemove={
                      readOnly
                        ? undefined
                        : () => {
                            toggleAbility(slug)
                          }
                    }
                    readOnly={readOnly}
                  />
                </Erow>
              )
            })}
          </Ecflow>
        )}
      </SheetSectionCard>

      {/* ===== R3: Inventory (full width) ===== */}
      <SheetSectionCard
        title="Inventory"
        count={
          <span className={overCapacity ? 'text-status-bad' : undefined}>
            {slotsUsed} / {slotsCap} slots
          </span>
        }
        controls={
          readOnly ? undefined : (
            <SectionAddButton label="equipment" onClick={() => setPicker('equipment')} />
          )
        }
      >
        {pilot.equipment.length === 0 && genericInventory.length === 0 ? (
          <p className="font-body text-caption text-wk-muted">Nothing carried.</p>
        ) : (
          <Ecflow>
            {pilot.equipment.map((slug) => (
              <Erow key={slug}>
                <PilotEquipmentItem
                  slug={slug}
                  pilotId={pilot.id}
                  seedSelections={pilot.equipmentChoices?.[slug]}
                  seedLoadout={pilot.equipmentLoadouts?.[slug]}
                  condition={pilot.equipmentConditions?.[slug] ?? 'intact'}
                  usesLeft={pilot.equipmentUses?.[slug]}
                  onConditionChange={(itemSlug, next) => {
                    void handleEquipmentConditionChange(itemSlug, next)
                  }}
                  onUsesChange={(itemSlug, next) => {
                    void handleUsesChange(itemSlug, next)
                  }}
                  onRemove={
                    readOnly
                      ? undefined
                      : () => {
                          toggleEquipment(slug)
                        }
                  }
                  readOnly={readOnly}
                  scalingParent={scalingParent}
                  store={store}
                />
              </Erow>
            ))}
            {genericInventory.map((entry, index) => (
              <Erow key={entry.id}>
                <GenericEntryCard
                  entry={entry}
                  onRemove={
                    readOnly
                      ? undefined
                      : () => {
                          void handleGenericInventoryChange(
                            genericInventory.filter((_, i) => i !== index)
                          )
                        }
                  }
                />
              </Erow>
            ))}
          </Ecflow>
        )}
        {!readOnly && (
          <div className="mt-3">
            <GenericEntryAdder
              onAdd={(entry) => {
                void handleGenericInventoryChange([...genericInventory, entry])
              }}
            />
          </div>
        )}
      </SheetSectionCard>

      {/* ===== R4: Linked Units (full width, stacked beneath all other sections) ===== */}
      <div>
        {/* Linked Units — poster renders this as a bare section header + rail
            stack (no `.dcard` frame), unlike Identity/Vitals/Abilities/Inventory. */}
        <SectionChead title="Linked Units" />
        <div className="flex flex-col gap-4">{linkedUnits}</div>
      </div>

      {/* The ONE shared picker modal — abilities & equipment '+ Add' both open
          it (multi-select grids write through on toggle; no Save button). */}
      <SheetPickerModal
        open={picker === 'abilities'}
        onClose={() => setPicker(null)}
        title="Add Abilities"
        maxWidth="max-w-5xl"
        floating
      >
        <EntitySearcher
          schema="abilities"
          selected={pilot.abilities}
          onToggle={toggleAbility}
          idOf={(item) => item.id}
          filter={
            abilityTrees
              ? (item) => abilityTrees.has((item as unknown as SURefAbility).tree)
              : undefined
          }
          facets={{
            category: { label: 'Tree', of: (item) => (item as unknown as SURefAbility).tree },
          }}
          railName={pilot.name}
          chosenLabel="Learned"
          emptyMessage="No abilities match those filters."
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title="Add Equipment"
        maxWidth="max-w-5xl"
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={toggleEquipment}
          idOf={(item) => item.id}
          railName={pilot.name}
          chosenLabel="Equipped"
          emptyMessage="No equipment matches those filters."
          budget={{ label: 'Inventory slots', used: slotsUsed, max: slotsCap }}
        />
      </SheetPickerModal>
    </section>
  )
}
