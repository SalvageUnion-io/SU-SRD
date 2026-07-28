/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * The body OWNS the identity band (no LiveSheet `renderHero`): it renders
 * `SheetHero` in band mode as its first region, wrapped with the shell's
 * `heroRef` so the sticky bar still condenses when the band scrolls away. This
 * keeps the identity + vitals rendering (and all their handlers) in one
 * component. Region order mirrors the printed pilot sheet:
 *   - Identity Band: edge wordmark ∥ identity fields ∥ HP/AP/TP + Conditions
 *     vitals rail (one toned frame — the printed top band).
 *   - Abilities (full width, 3-column card grid) — entity cards with Spend AP
 *     (fixed costs only) and a used/recharge toggle in the card foot.
 *   - Inventory (full-width band) — equipment cards + generic entries.
 *   - Linked Units — the assigned-mech / home-crawler rail.
 *
 * Section containers follow the card-vs-slab rule (see `SheetSectionSlab`):
 * a section of inputs/gauges is a CARD (here, the identity band), a section of
 * entity cards is a SLAB (Abilities, Inventory, Linked Units) — cards already
 * carry their own frame, so a second frame around them reads as one opaque
 * block.
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
import type { ReactNode, Ref } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility } from 'salvageunion-reference'
import { Badge, Panel, SheetHero, Stat, VitalGauge } from 'component-lib'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry, Pilot } from '../../lib/schemas/pilot'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { isPilotDead, pilotMaxAP, pilotMaxHP } from '../../lib/rules/derivedStats'
import { enrichPilotSnapshot } from 'salvageunion-reference/rules'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { useSoftWarnings } from '../shared/useSoftWarnings'
import { useEntityStore } from '../../stores/entityStore'
import { type ClassLike, treesFor } from '../pilot/abilityTrees'
import { EntitySearcher } from 'component-lib'
import { useSoftLinks } from '../wiring/useSoftLinks'
import { ConditionsEditor } from 'component-lib'
import { destroyedUndoToast } from './destroyedUndoToast'
import { EntityGridRow, MasonryColumns } from 'component-lib'
import { PilotIdentityPanel } from './PilotIdentity'
import type { UsedToggleKey } from './PilotIdentity'
import { SectionManageButton, SheetPickerModal } from 'component-lib'
import { SheetSectionSlab, Slab } from 'component-lib'
import { pilotInventoryCapacity, pilotInventoryUsed, resolveEquipment } from './pilotInventory'
import type { SheetPatch } from './sheetViewProps'
import {
  GenericEntryAdder,
  GenericEntryCard,
  PilotAbilityItem,
  PilotEquipmentItem,
} from './PilotSheetItems'
import { PartnerCard } from './PartnerCard'
import { resolveAbility } from './pilotAbilities'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../../stores/surfaceProvenance'

/**
 * The tree every pilot has regardless of class (Repair, Scrap, Mount, …).
 *
 * It is INTRINSIC, not chosen: it is never offered in the abilities picker and
 * never stored in `pilot.abilities`. The sheet renders it from reference data,
 * as its own tree above the class trees.
 */
const GENERIC_TREE = 'Generic'

// ---------------------------------------------------------------------------
// TpBlock — pilot Training Points, in the Vitals card's dashed-topped `.vrow`
// beside Conditions.
//
// This was a hand-assembled `.tpblock` (stamp / 30px numeral / caption / a
// bespoke StepButton pair) arguing the poster's framed TP readout was its own
// thing. It is not: it is the canonical value box at its headline rung —
// `Stat` `size="full"` is stamp / 26px numeral / bottom stamp with the +/-
// stepper column, which is the same anatomy the HP and AP gauges above it
// already use. `ariaLabel` keeps the unbounded-counter accessible contract
// (role="group" named "Training Points {value}", with Increase/Decrease
// Training Points steppers — the visible label is split across the two lines).
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
    <Stat
      label="Training"
      value={value}
      bottomLabel="Points"
      size="full"
      ariaLabel={`Training Points ${value}`}
      // Without this the steppers would read "Increase Training" — the label is
      // now only the first half of the two-line readout.
      stepperLabel="Training Points"
      mode={editable ? 'edit' : 'read'}
      onChange={editable ? onChange : undefined}
    />
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
   * Marks the body's first region. VESTIGIAL: the sticky bar condenses off its
   * own 1px sentinel now, so nothing observes this. Undefined in bare test
   * renders (no shell).
   */
  heroRef?: Ref<HTMLElement>
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
  heroRef,
  linkedUnits,
}: PilotSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  const [picker, setPicker] = useState<'abilities' | 'equipment' | null>(null)
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, now rendered in the SheetSectionCard header (Phase 2).

  // Soft warnings (REQ-012, ADR-021) on BUILD edits only — ability add/remove
  // and the class change. Advisory, never blocking: a clean edit saves straight
  // through and the dialog never appears. Vitals/live-play writes (HP, AP, TP,
  // conditions, uses, Spend AP) deliberately bypass this — they are transient
  // state, not the build these rules evaluate, and would warn on every tick.
  // `enrichPilotSnapshot` is REQUIRED: Pilot.abilities is a slug array, and the
  // tier/tree checks need the resolved ability structs.
  const softWarnings = useSoftWarnings({
    entityType: 'pilot',
    entityId: pilot.id,
    toSnapshot: (p) => enrichPilotSnapshot(p),
    store,
  })
  const [warningSubtitle, setWarningSubtitle] = useState<string | null>(null)

  /**
   * Preview a build patch: save immediately when clean, otherwise raise the
   * confirm-and-proceed dialog. `label` describes the pending edit.
   */
  function saveBuildEdit(fields: Partial<Pilot>, label: string) {
    if (softWarnings.preview(fields).length === 0) {
      void softWarnings.saveAnyway()
      return
    }
    setWarningSubtitle(label)
  }

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
  // ReferenceEntityCard subtree it is threaded into.
  const scalingParent = useMemo(
    () => (effectiveCrawlerLevel !== undefined ? { techLevel: effectiveCrawlerLevel } : undefined),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- intentional: effectiveCrawlerLevel is a derived scalar, memoized purely to keep the {techLevel} object identity stable for the memoized ReferenceEntityCard subtree
    [effectiveCrawlerLevel]
  )

  // PARTNERS — the statted companions a pilot ability grants (Auto-Turret,
  // Survey Drone, Mecha Companion). The granting equipment slug and the granted
  // partner are the SAME entry in the player's eyes, so the partner instance
  // renders IN PLACE of the ordinary equipment card rather than beside it: one
  // card, one thing. Each instance gets its own card, which is what makes Mecha
  // Packmaster's two Mecha Companions two cards over one equipment slug.
  const partners = pilot.partners ?? []
  const partnerSlugs = new Set(
    partners.filter((p) => p.hostSchema === 'equipment').map((p) => p.hostRef)
  )
  const ordinaryEquipment = pilot.equipment.filter((slug) => !partnerSlugs.has(slug))
  // How many of each stat block is fielded, so a card can say "2 of 2".
  const fieldedByRef = partners.reduce<Record<string, number>>((acc, p) => {
    acc[p.hostRef] = (acc[p.hostRef] ?? 0) + 1
    return acc
  }, {})

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
  //
  // GENERIC is deliberately NOT in this set: those abilities are intrinsic to
  // every pilot rather than chosen, so they are never offered for selection —
  // they are rendered from reference data in their own tree below.
  const abilityTrees = useMemo(() => {
    if (picker !== 'abilities') return null
    const cls: ClassLike | undefined = SalvageUnionReference.Classes.find(
      (c) => c.id === pilot.classRef
    )
    if (!cls) return null
    const selectedTrees = SalvageUnionReference.Abilities.all()
      .filter((a) => pilot.abilities.includes(a.id))
      .map((a) => a.tree)
    return new Set(treesFor(cls, true, selectedTrees))
  }, [picker, pilot.classRef, pilot.abilities])

  // Learned abilities grouped by tree — the section renders one sub-slab per
  // tree rather than one flat grid. Generic is excluded here and sourced
  // separately: it is intrinsic, so a pilot never "has" it in `abilities`.
  const abilityGroups = useMemo(() => {
    // Keyed by the STORED slug, not `ability.id`: `pilot.abilities` (and
    // `usedAbilities`, and every handler) speak slugs, and the two are not the
    // same string — grouping by id silently broke the used/recharge lookups.
    const byTree = new Map<string, { slug: string; ability: SURefAbility }[]>()
    for (const slug of pilot.abilities) {
      const ability = resolveAbility(slug)
      if (!ability || ability.tree === GENERIC_TREE) continue
      const entry = { slug, ability }
      const list = byTree.get(ability.tree)
      if (list) list.push(entry)
      else byTree.set(ability.tree, [entry])
    }
    return { trees: [...byTree.entries()] }
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- keyed on the slug list; resolveAbility is a pure ORM lookup
  }, [pilot.abilities])

  /**
   * The Generic tree — EVERY pilot has all of it, so it is read from the
   * reference data rather than from `pilot.abilities` (which only ever holds
   * chosen, class-tree abilities). Keyed by `ability.id`, which `resolveAbility`
   * accepts, so the used/recharge toggles persist like any other ability.
   *
   * Guarded: read-only snapshot renders may not have preloaded the ORM, and a
   * missing catalog should drop the section, not throw the sheet.
   */
  const genericAbilities = useMemo(() => {
    try {
      return SalvageUnionReference.Abilities.all()
        .filter((ability) => ability.tree === GENERIC_TREE)
        .map((ability) => ({ slug: ability.id, ability }))
    } catch {
      return []
    }
  }, [])

  /** Slugs that resolved to no SRD ability — rendered as bare fallback rows. */
  const unresolvedAbilities = pilot.abilities.filter((slug) => !resolveAbility(slug))

  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)
  const tp = pilot.trainingPoints ?? 0

  /** Freshest pilot record from the store, falling back to the render prop. */
  function freshPilot(): Pilot {
    return storeState.get('pilot', pilot.id) ?? pilot
  }

  /**
   * Partial merge on this pilot, reading the freshest record when needed.
   *
   * A `classRef` change is a BUILD edit (it can trip CLASS_PREREQUISITE —
   * switching to an Advanced/Hybrid specialisation without the 6-core gate),
   * so it routes through the soft-warning flow. Every other field here
   * (vitals, TP, identity text) writes straight through.
   */
  const patchPilot: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(freshPilot()) : input
    if ('classRef' in fields) {
      saveBuildEdit(fields, 'Change class')
      return
    }
    void storeState.update('pilot', pilot.id, fields, LIVE_SHEET_MANUAL)
  }

  // Cap overrides (ADR-022, Free Edit): pin HP/AP maxima via a signed
  // max*Modifier delta; the gauge shows "overridden from N" + a revert. Tagged
  // `override` for the Change Log.
  const derivedMaxHP = maxHP - (pilot.maxHpModifier ?? 0)
  const derivedMaxAP = maxAP - (pilot.maxApModifier ?? 0)
  const overridePilotMax = (fields: Partial<Pilot>) => {
    void storeState.update('pilot', pilot.id, fields, LIVE_SHEET_OVERRIDE)
  }
  const modOrUndef = (next: number, derived: number): number | undefined => {
    const mod = next - derived
    return mod === 0 ? undefined : mod
  }

  /** Toggle one of the once-per-Downtime used flags (rules A8–A10). */
  function toggleUsed(key: UsedToggleKey, next: boolean) {
    const fresh = freshPilot()
    const prev = fresh.usedToggles ?? {}
    void storeState.update(
      'pilot',
      pilot.id,
      {
        usedToggles: { ...prev, [key]: next },
      },
      LIVE_SHEET_MANUAL
    )
  }

  /** Persist the full conditions list (flat string set, no partial merge). */
  function handleConditionsChange(next: string[]) {
    void storeState.update('pilot', pilot.id, { conditions: next }, LIVE_SHEET_MANUAL)
  }

  // Collection add/remove (unified edit language archetype B) — always
  // available, writes through on toggle (ITUN auto-saves; no Save button).
  // Reads the FRESHEST record so rapid toggles in the picker grid don't race
  // the async store write.
  // Advisory only (soft warnings), never rule-GATED: the cap, tree order and
  // the Advanced/Legendary prerequisites surface in a confirm dialog and the
  // user may always proceed.
  function toggleAbility(abilityId: string) {
    const fresh = freshPilot()
    const abilities = fresh.abilities
    const removing = abilities.includes(abilityId)
    const name = resolveAbility(abilityId)?.name ?? abilityId
    saveBuildEdit(
      {
        abilities: removing ? abilities.filter((a) => a !== abilityId) : [...abilities, abilityId],
      },
      `${removing ? 'Remove' : 'Add'} ${name}`
    )
  }

  function toggleEquipment(equipmentId: string) {
    const equipment = freshPilot().equipment
    void storeState.update(
      'pilot',
      pilot.id,
      {
        equipment: equipment.includes(equipmentId)
          ? equipment.filter((e) => e !== equipmentId)
          : [...equipment, equipmentId],
      },
      LIVE_SHEET_MANUAL
    )
  }

  async function handleEquipmentConditionChange(slug: string, next: ItemCondition) {
    const prev = freshPilot().equipmentConditions ?? {}
    const prevCondition = prev[slug] ?? 'intact'
    await storeState.update(
      'pilot',
      pilot.id,
      {
        equipmentConditions: { ...prev, [slug]: next },
      },
      LIVE_SHEET_MANUAL
    )
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
    await storeState.update(
      'pilot',
      pilot.id,
      {
        equipmentUses: { ...prev, [slug]: next },
      },
      LIVE_SHEET_MANUAL
    )
  }

  async function handleSpendAP(cost: number) {
    const p = freshPilot()
    const current = p.currentAP ?? pilotMaxAP(p)
    const next = Math.max(0, current - cost)
    if (next === current) return
    await storeState.update('pilot', pilot.id, { currentAP: next }, LIVE_SHEET_MANUAL)
  }

  async function handleAbilityUsedChange(slug: string, next: boolean) {
    const prev = new Set(freshPilot().usedAbilities ?? [])
    if (next) {
      prev.add(slug)
    } else {
      prev.delete(slug)
    }
    await storeState.update(
      'pilot',
      pilot.id,
      {
        usedAbilities: Array.from(prev),
      },
      LIVE_SHEET_MANUAL
    )
  }

  async function handleGenericInventoryChange(next: GenericInventoryEntry[]) {
    await storeState.update('pilot', pilot.id, { genericInventory: next }, LIVE_SHEET_MANUAL)
  }

  /** One learned ability card — identical wherever its tree puts it. */
  function renderAbility({ slug, ability }: { slug: string; ability: SURefAbility }) {
    return (
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
        readOnly={readOnly}
      />
    )
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

      {/* ===== Identity Band (Workshop-Manual pilot sheet top region) =====
          Edge wordmark ∥ identity fields ∥ HP/AP/TP + Conditions vitals rail,
          in one toned frame — the printed pilot sheet's top band. Carries the
          shell's `heroRef` (vestigial — the bar's own sentinel drives condense now). */}
      <SheetHero
        heroRef={heroRef}
        cat="Pilot"
        name={pilot.name}
        meta={
          dead ? (
            <Badge surface="tone" tone="bad">
              Dead
            </Badge>
          ) : undefined
        }
        fields={
          <PilotIdentityPanel
            pilot={pilot}
            onToggleUsed={readOnly ? undefined : toggleUsed}
            patch={readOnly ? undefined : patchPilot}
          />
        }
        vitals={
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
            {/* TP and Conditions SHARE a row. Stacked, the vitals column ran
                well past the identity card beside it; TP is a single narrow
                plate and Conditions is a short chip list, so neither needs a
                full row of its own and pairing them squares the two cards up. */}
            <div className="flex w-full min-w-0 items-start gap-3">
              <TpBlock
                value={tp}
                onChange={readOnly ? undefined : (v) => patchPilot({ trainingPoints: v })}
                editable={!readOnly}
              />
              <div className="min-w-0 flex-1">
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
          </div>
        }
      />

      {/* ===== Abilities — one sub-slab per ABILITY TREE =====
          A SLAB, not a card: the grid is entity cards, which carry their own
          frame. Inside it the abilities group by tree, because a pilot's
          abilities ARE a set of trees and a flat grid lost that: GENERIC (the
          eight every pilot can take) reads as a full-width row of its own, then
          each class tree takes a single column, three trees to a row. The
          per-tree leader is the DASHED `Slab`, subordinate to the section's own
          solid stamp. */}
      <SheetSectionSlab
        title="Abilities"
        count={`${pilot.abilities.length} known`}
        controls={
          readOnly ? undefined : (
            <SectionManageButton label="abilities" onClick={() => setPicker('abilities')} />
          )
        }
      >
        {pilot.abilities.length === 0 && genericAbilities.length === 0 ? (
          <p className="font-body text-caption text-wk-muted">No abilities learned yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {genericAbilities.length > 0 && (
              <div>
                {/* No count: the class trees show how many you have TAKEN,
                    which is a number worth reading. Generic is intrinsic and
                    fixed, so a tally beside it is noise. */}
                <Slab label={GENERIC_TREE} />
                <MasonryColumns maxColumns={3}>
                  {genericAbilities.map((entry) => (
                    <EntityGridRow key={entry.slug}>{renderAbility(entry)}</EntityGridRow>
                  ))}
                </MasonryColumns>
              </div>
            )}

            {abilityGroups.trees.length > 0 && (
              // One COLUMN per tree, three to a row — a tree's abilities stack
              // under their own leader instead of being interleaved with
              // another tree's by a masonry flow.
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                {abilityGroups.trees.map(([tree, entries]) => (
                  <div key={tree} className="min-w-0">
                    <Slab label={tree} count={entries.length} />
                    <div className="flex flex-col gap-4">
                      {entries.map((entry) => (
                        <div key={entry.slug} className="min-w-0">
                          {renderAbility(entry)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unresolvedAbilities.length > 0 && (
              <div className="flex flex-col gap-2">
                {unresolvedAbilities.map((slug) => (
                  <Panel key={slug} className="px-3 py-2.5 font-body text-sm text-wk-muted">
                    {slug}
                  </Panel>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetSectionSlab>

      {/* ===== Inventory (full-width band, printed pilot sheet bottom) ===== */}
      <SheetSectionSlab
        title="Inventory"
        count={
          <span className={overCapacity ? 'text-status-bad' : undefined}>
            {slotsUsed} / {slotsCap} slots
          </span>
        }
        controls={
          readOnly ? undefined : (
            <SectionManageButton label="equipment" onClick={() => setPicker('equipment')} />
          )
        }
      >
        {pilot.equipment.length === 0 && genericInventory.length === 0 ? (
          <p className="font-body text-caption text-wk-muted">Nothing carried.</p>
        ) : (
          <MasonryColumns maxColumns={2}>
            {ordinaryEquipment.map((slug) => (
              <EntityGridRow key={slug}>
                <PilotEquipmentItem
                  slug={slug}
                  pilotId={pilot.id}
                  seedSelections={pilot.equipmentChoices?.[slug]}
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
              </EntityGridRow>
            ))}
            {genericInventory.map((entry, index) => (
              <EntityGridRow key={entry.id}>
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
              </EntityGridRow>
            ))}
          </MasonryColumns>
        )}
        {/* Ability-granted PARTNERS — full width, deliberately outside the
            masonry above. Each carries a nested loadout and a cargo hold, so a
            column would crush it, and a partner acts on its own turn rather
            than being one item among the pilot's carried gear. */}
        {partners.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                found={{ partner, hostKind: 'pilot', host: pilot }}
                crawler={linkedCrawler}
                crawlerTechLevel={effectiveCrawlerLevel}
                hostAbilityRefs={pilot.abilities}
                fielded={fieldedByRef[partner.hostRef] ?? 1}
                readOnly={readOnly}
                store={store}
                onRemove={
                  readOnly
                    ? undefined
                    : () => {
                        void storeState.update(
                          'pilot',
                          pilot.id,
                          {
                            partners: partners.filter((p) => p.id !== partner.id),
                          },
                          LIVE_SHEET_MANUAL
                        )
                      }
                }
              />
            ))}
          </div>
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
      </SheetSectionSlab>

      {/* ===== R4: Linked Units (full width, stacked beneath all other sections) =====
          Already a bare slab leader + rail stack in the poster; now expressed
          through the shared slab container like every other card section. */}
      <SheetSectionSlab
        id="linked-units"
        title="Linked Units"
        // Side by side: each linked unit is one roster row, and two of them stack
        // to a wasteful column on a sheet that has the width for both.
        bodyClassName="flex flex-col gap-4 @3xl:flex-row"
      >
        {linkedUnits}
      </SheetSectionSlab>

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
            abilityTrees ? (item) => abilityTrees.has((item as SURefAbility).tree) : undefined
          }
          facets={{
            category: { label: 'Tree', of: (item) => (item as SURefAbility).tree },
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

      {/* Advisory confirm — only mounts when a build edit tripped a rule. */}
      <SoftWarningDialog
        open={warningSubtitle !== null}
        warnings={softWarnings.warnings}
        subtitle={warningSubtitle ?? undefined}
        onCancel={() => {
          softWarnings.fixIt()
          setWarningSubtitle(null)
        }}
        onSaveAnyway={() => {
          void softWarnings.saveAnyway()
          setWarningSubtitle(null)
        }}
      />
    </section>
  )
}
