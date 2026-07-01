/**
 * PilotSheet — the pilot body for the LiveSheet shell (plan 4.4, design §4.2).
 *
 * Slab/Erow layout (identity, stats and conditions live in the hero — see
 * Sheet.tsx pilot branch):
 *   - dead-state banner when derived max HP ≤ 0 (rules A2)
 *   - 'Take Damage' slab — HP intake with the p.241 SP↔HP conversions and the
 *     Critical Injury Table prompt at 0 HP (PilotTakeDamageControl, R-1)
 *   - 'Abilities · N' slab — entity cards with Spend AP (fixed costs only) and
 *     a used/recharge toggle in the card foot
 *   - 'Inventory · used / cap slots' slab — truthful slot math (equipment 1,
 *     Heavy/Portable 2, generic entries at their explicit slotCost — Scrap 3),
 *     per-item uses counters (Use / Restock) and per-item condition cycling
 *     via the card status badge
 *   - 'Injuries' slab — severity-enum list editor feeding the derived max HP
 *   - 'Crawler Level' — scaling source for choice caps (linked crawler wins)
 *
 * All handlers read the freshest record from the store (never the render-time
 * prop) so rapid sequential edits don't stomp each other. readOnly suppresses
 * every edit affordance (published snapshots).
 */

import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefEntity } from 'salvageunion-reference'
import { Btn, Panel, ReferenceEntityDisplay, Slab, Spec, StatusBadge, Tag } from 'suref-react'
import type { CardFootMeta, ChoiceSelections, EntityStatus } from 'suref-react'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry, Injury, Pilot } from '../../lib/schemas/pilot'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import {
  clampPilotCurrentStats,
  injuryMaxHpPenalty,
  isPilotDead,
} from '../../lib/rules/derivedStats'
import type { Roll } from '../../lib/rules/heatCheck'
import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../wiring/useSoftLinks'
import { useEntityChoices } from '../shared/useEntityChoices'
import { destroyedUndoToast } from './destroyedUndoToast'
import { Ecflow, Erow } from './Erow'
import { InlineEditField } from './InlineEditField'
import { PilotTakeDamageControl } from './PilotTakeDamageControl'
import {
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
  pilotInventoryCapacity,
  pilotInventoryUsed,
  resolveEquipment,
} from './pilotInventory'

const HIDE_CHOICES = { choices: true } as const

/** Per-item condition cycle (design §4.5: Intact → Damaged → Destroyed → Intact). */
const CONDITION_CYCLE: Record<ItemCondition, ItemCondition> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

function resolveAbility(slug: string): SURefAbility | null {
  const all = SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>
  return all.find((a) => a.id === slug || a.name === slug) ?? null
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

type PilotAbilityItemProps = {
  ability: SURefAbility
  /** Pilot's current AP — gates whether the spend action is enabled. */
  currentAP: number
  /** Whether this ability has been marked used (once-per-rest tracking). */
  used: boolean
  /** Spend this ability's fixed AP cost. Only invoked for fixed numeric costs. */
  onSpend: (cost: number) => void
  onToggleUsed: (next: boolean) => void
  readOnly: boolean
}

/**
 * One ability card. AP cost resolves from the ability's actions
 * (resolveAbilityApCost): `null` means no FIXED numeric cost (variable 'X' or
 * none) — no spend button renders, we never spend an undefined amount.
 */
function PilotAbilityItem({
  ability,
  currentAP,
  used,
  onSpend,
  onToggleUsed,
  readOnly,
}: PilotAbilityItemProps) {
  const apCost = resolveAbilityApCost(ability)
  const canSpend = apCost !== null && currentAP >= apCost

  const footMeta: CardFootMeta[] = [{ label: 'AP Cost', value: apCost ?? '—' }]
  const footActions = readOnly ? (
    used ? (
      <Tag label="Used" />
    ) : undefined
  ) : (
    <>
      {apCost !== null && (
        <Btn
          size="sm"
          variant="primary"
          disabled={!canSpend}
          aria-label={`Spend ${apCost} AP for ${ability.name}`}
          onClick={() => {
            onSpend(apCost)
          }}
        >
          Spend AP
        </Btn>
      )}
      <Btn
        size="sm"
        aria-pressed={used}
        aria-label={used ? `Recharge ${ability.name}` : `Mark ${ability.name} used`}
        onClick={() => {
          onToggleUsed(!used)
        }}
      >
        {used ? 'Recharge' : 'Mark Used'}
      </Btn>
    </>
  )

  return (
    <ReferenceEntityDisplay
      data={ability as unknown as SURefEntity}
      compact
      label={ability.tree}
      hide={HIDE_CHOICES}
      footMeta={footMeta}
      footActions={footActions}
    />
  )
}

// ---------------------------------------------------------------------------
// Inventory — reference equipment
// ---------------------------------------------------------------------------

type PilotEquipmentItemProps = {
  /** Equipment slug as stored on the pilot. */
  slug: string
  /** Owning pilot id — choice selections persist under this entity. */
  pilotId: string
  /**
   * Persisted choice selections for this item, sourced from the canonical
   * pilot prop so read-only/snapshot rendering does not depend on the store.
   */
  seedSelections: ChoiceSelections | undefined
  condition: ItemCondition
  /** Uses remaining for this item; undefined = full (rules A14). */
  usesLeft: number | undefined
  onConditionChange: (slug: string, next: ItemCondition) => void
  onUsesChange: (slug: string, next: number) => void
  readOnly: boolean
  /**
   * Scaling parent for `scalesWithField` choice caps (e.g. the Modification
   * choice scaling with `techLevel`). Undefined leaves the cap unbounded.
   */
  scalingParent: Record<string, unknown> | undefined
  /** Injectable store — forwarded to useEntityChoices for tests. */
  store: typeof useEntityStore
}

/**
 * One inventory equipment card: choice cards enabled, condition cycled via the
 * card's status badge, uses counted in the foot with Use / Restock actions.
 *
 * Extracted from the map body so it can legally call the useEntityChoices hook.
 */
function PilotEquipmentItem({
  slug,
  pilotId,
  seedSelections,
  condition,
  usesLeft,
  onConditionChange,
  onUsesChange,
  readOnly,
  scalingParent,
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

  if (!equipment) {
    // Unresolved slug — still shown, still counted (1 slot), still toggleable.
    return (
      <Panel className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-body text-sm text-wk-muted">{slug}</span>
        <Spec label="Slots" value={1} />
        <StatusBadge
          status={condition}
          onClick={
            readOnly
              ? undefined
              : () => {
                  onConditionChange(slug, CONDITION_CYCLE[condition])
                }
          }
        />
      </Panel>
    )
  }

  const slotCost = equipmentSlotCost(equipment)
  const maxUses = equipmentMaxUses(equipment)
  const uses = maxUses !== null ? (usesLeft ?? maxUses) : null

  const footMeta: CardFootMeta[] = [
    { label: 'Slots', value: slotCost },
    ...(maxUses !== null ? [{ label: 'Uses', value: `${uses}/${maxUses}` }] : []),
  ]
  const footActions =
    !readOnly && maxUses !== null && uses !== null ? (
      <>
        <Btn
          size="sm"
          disabled={uses <= 0}
          aria-label={`Use ${equipment.name}`}
          onClick={() => {
            onUsesChange(slug, Math.max(0, uses - 1))
          }}
        >
          Use
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          disabled={uses >= maxUses}
          aria-label={`Restock ${equipment.name}`}
          onClick={() => {
            onUsesChange(slug, maxUses)
          }}
        >
          Restock
        </Btn>
      </>
    ) : undefined

  return (
    <ReferenceEntityDisplay
      data={equipment as unknown as SURefEntity}
      compact
      selections={selections}
      onSelectionChange={readOnly ? undefined : setSelections}
      scalingParent={scalingParent}
      status={condition as EntityStatus}
      onStatusClick={
        readOnly
          ? undefined
          : () => {
              onConditionChange(slug, CONDITION_CYCLE[condition])
            }
      }
      footMeta={footMeta}
      footActions={footActions}
    />
  )
}

// ---------------------------------------------------------------------------
// Inventory — generic entries (plan S7: Scrap at slotCost 3, etc.)
// ---------------------------------------------------------------------------

type GenericEntryCardProps = {
  entry: GenericInventoryEntry
  onRemove?: () => void
}

function GenericEntryCard({ entry, onRemove }: GenericEntryCardProps) {
  const qty = entry.qty ?? 1
  return (
    <Panel className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-sm font-medium text-ink">
          {entry.name}
          {qty > 1 && <span className="ml-1 text-wk-muted">×{qty}</span>}
        </div>
        {entry.note && <div className="truncate font-body text-xs text-wk-muted">{entry.note}</div>}
      </div>
      <Spec label="Slots" value={genericEntrySlots(entry)} />
      {onRemove && (
        <Btn size="sm" variant="ghost" aria-label={`Remove ${entry.name}`} onClick={onRemove}>
          Remove
        </Btn>
      )}
    </Panel>
  )
}

type GenericEntryAdderProps = {
  onAdd: (entry: GenericInventoryEntry) => void
}

/**
 * Minimal generic-entry intake (design-review item: 'generic inventory
 * slot-cost entry'). '+ Scrap' is the rules-blessed shortcut (3 slots each);
 * the free form covers everything else with an explicit slot cost.
 */
function GenericEntryAdder({ onAdd }: GenericEntryAdderProps) {
  const [name, setName] = useState('')
  const [slots, setSlots] = useState(1)
  const [qty, setQty] = useState(1)

  function commit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({
      id: crypto.randomUUID(),
      name: trimmed,
      slotCost: Math.max(0, slots),
      ...(qty > 1 ? { qty } : {}),
    })
    setName('')
    setSlots(1)
    setQty(1)
  }

  const inputClass =
    'rounded-[3px] border-[1.5px] border-ink bg-paper px-2 py-1.5 font-body text-xs text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[3px] border-[1.5px] border-dashed border-wk-faint p-2.5">
      <Btn
        size="sm"
        aria-label="Add Scrap (3 slots)"
        onClick={() => {
          onAdd({ id: crypto.randomUUID(), name: 'Scrap', slotCost: 3 })
        }}
      >
        + Scrap
      </Btn>
      <input
        type="text"
        value={name}
        aria-label="New item name"
        placeholder="Item name"
        onChange={(e) => setName(e.target.value)}
        className={`${inputClass} w-36 flex-1`}
      />
      <label className="flex items-center gap-1 font-cond text-[10px] font-bold uppercase tracking-wide text-wk-muted">
        Slots
        <input
          type="number"
          min={0}
          value={slots}
          aria-label="New item slot cost"
          onChange={(e) => setSlots(Number(e.target.value))}
          className={`${inputClass} w-14`}
        />
      </label>
      <label className="flex items-center gap-1 font-cond text-[10px] font-bold uppercase tracking-wide text-wk-muted">
        Qty
        <input
          type="number"
          min={1}
          value={qty}
          aria-label="New item quantity"
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          className={`${inputClass} w-14`}
        />
      </label>
      <Btn size="sm" disabled={!name.trim()} aria-label="Add inventory item" onClick={commit}>
        Add
      </Btn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

type InjuryRowProps = {
  injury: Injury
  index: number
  onChange?: (next: Injury) => void
  onRemove?: () => void
}

function InjuryRow({ injury, index, onChange, onRemove }: InjuryRowProps) {
  const penalty = injury.severity === 'major' ? 2 : 1
  if (!onChange || !onRemove) {
    return (
      <Panel className="flex items-center gap-3 px-3 py-2">
        <Tag label={injury.severity} value={`−${penalty} HP`} />
        <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">
          {injury.note || '—'}
        </span>
      </Panel>
    )
  }
  return (
    <Panel className="flex flex-wrap items-center gap-3 px-3 py-2">
      <select
        value={injury.severity}
        aria-label={`Injury ${index + 1} severity`}
        onChange={(e) => {
          onChange({
            ...injury,
            severity: e.target.value === 'major' ? 'major' : 'minor',
          })
        }}
        className="rounded-[3px] border-[1.5px] border-ink bg-paper px-2 py-1.5 font-cond text-xs font-semibold uppercase text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
      >
        <option value="minor">Minor (−1 max HP)</option>
        <option value="major">Major (−2 max HP)</option>
      </select>
      <input
        type="text"
        defaultValue={injury.note}
        aria-label={`Injury ${index + 1} note`}
        placeholder="What happened?"
        onBlur={(e) => {
          const next = e.target.value
          if (next !== injury.note) onChange({ ...injury, note: next })
        }}
        className="w-40 min-w-0 flex-1 rounded-[3px] border-[1.5px] border-ink bg-paper px-2 py-1.5 font-body text-xs text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
      />
      <Btn size="sm" variant="ghost" aria-label={`Remove injury ${index + 1}`} onClick={onRemove}>
        Remove
      </Btn>
    </Panel>
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
   * Injectable d20 roller for the Take Damage / Critical Injury loop —
   * defaults to a randsum roll. Pass a deterministic roller in tests.
   */
  roll?: Roll
}

export function PilotSheet({
  pilot,
  store = useEntityStore,
  readOnly = false,
  roll,
}: PilotSheetProps) {
  const storeState = store()

  // Resolve the pilot's crawler (if any) via the pilot-to-crawler SoftLink,
  // then compute the EFFECTIVE crawler Tech Level used to scale choice caps
  // (e.g. the Modification choice). A linked crawler's techLevel wins; with no
  // link the pilot's manual `crawlerLevel` is used; with neither it is
  // undefined and caps stay unbounded.
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
    [effectiveCrawlerLevel]
  )

  const dead = isPilotDead(pilot)
  const slotsUsed = pilotInventoryUsed(pilot)
  const slotsCap = pilotInventoryCapacity(pilot)
  const overCapacity = slotsUsed > slotsCap
  const injuries = pilot.injuries ?? []
  const hpPenalty = injuryMaxHpPenalty(injuries)
  const genericInventory = pilot.genericInventory ?? []

  /** Freshest pilot record from the store, falling back to the render prop. */
  function freshPilot(): Pilot {
    return storeState.get('pilot', pilot.id) ?? pilot
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
    const current = freshPilot().currentAP ?? 0
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

  /**
   * Persist the injuries list AND clamp current HP/AP to the recomputed
   * derived maxima in the same patch (plan 2.2: 'current HP clamped to derived
   * max on every recompute').
   */
  async function handleInjuriesChange(next: Injury[]) {
    const fresh = freshPilot()
    const clamp = clampPilotCurrentStats({ ...fresh, injuries: next })
    await storeState.update('pilot', pilot.id, { injuries: next, ...clamp })
  }

  return (
    <section
      aria-label={`${pilot.name} pilot details`}
      // `.sheet-section` is a print-stylesheet target (page-break rules)
      className="sheet-section flex flex-col gap-6"
    >
      {/* Dead state (rules A2: max HP 0 = death). Display-only — the record
          stays editable so an erroneous injury can be removed. */}
      {dead && (
        <div
          role="alert"
          className="rounded-[3px] border-[3px] border-status-bad bg-paper px-4 py-3"
        >
          <p className="m-0 font-cond text-lg font-bold uppercase tracking-[0.08em] text-status-bad">
            Killed in Action
          </p>
          <p className="m-0 font-body text-sm text-ink">
            Injuries have reduced this pilot&rsquo;s maximum HP to 0. Remove an injury below if this
            was a bookkeeping error — otherwise, raise a glass.
          </p>
        </div>
      )}

      {/* Take Damage / Critical Injury loop (R-1) — HP intake with the p.241
          conversions, prompting the Critical Injury Table roll at 0 HP. */}
      <PilotTakeDamageControl pilot={pilot} store={store} roll={roll} readOnly={readOnly} />

      {/* Abilities */}
      {pilot.abilities.length > 0 && (
        <div>
          <Slab label="Abilities" count={pilot.abilities.length} />
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
                    currentAP={pilot.currentAP ?? 0}
                    used={pilot.usedAbilities?.includes(slug) ?? false}
                    onSpend={(cost) => {
                      void handleSpendAP(cost)
                    }}
                    onToggleUsed={(next) => {
                      void handleAbilityUsedChange(slug, next)
                    }}
                    readOnly={readOnly}
                  />
                </Erow>
              )
            })}
          </Ecflow>
        </div>
      )}

      {/* Inventory — truthful slot math (rules A13) */}
      <div>
        <Slab
          label="Inventory"
          count={
            <span className={overCapacity ? 'text-status-bad' : undefined}>
              {slotsUsed} / {slotsCap} slots
            </span>
          }
        />
        {pilot.equipment.length === 0 && genericInventory.length === 0 ? (
          <p className="font-body text-[13px] text-wk-muted">Nothing carried.</p>
        ) : (
          <Ecflow>
            {pilot.equipment.map((slug) => (
              <Erow key={slug}>
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
      </div>

      {/* Injuries — feed the derived max HP (rules A2/A11) */}
      <div>
        <Slab label="Injuries" count={hpPenalty > 0 ? `−${hpPenalty} max HP` : injuries.length} />
        {injuries.length === 0 ? (
          <p className="font-body text-[13px] text-wk-muted">No injuries — keep it that way.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {injuries.map((injury, index) => (
              <InjuryRow
                key={index}
                injury={injury}
                index={index}
                onChange={
                  readOnly
                    ? undefined
                    : (next) => {
                        void handleInjuriesChange(injuries.map((j, i) => (i === index ? next : j)))
                      }
                }
                onRemove={
                  readOnly
                    ? undefined
                    : () => {
                        void handleInjuriesChange(injuries.filter((_, i) => i !== index))
                      }
                }
              />
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="mt-3 flex gap-2">
            <Btn
              size="sm"
              aria-label="Add minor injury"
              onClick={() => {
                void handleInjuriesChange([...injuries, { severity: 'minor', note: '' }])
              }}
            >
              + Minor Injury
            </Btn>
            <Btn
              size="sm"
              aria-label="Add major injury"
              onClick={() => {
                void handleInjuriesChange([...injuries, { severity: 'major', note: '' }])
              }}
            >
              + Major Injury
            </Btn>
          </div>
        )}
      </div>

      {/* Crawler Level — scales choice caps (e.g. the Modification choice).
          Linked crawler: its Tech Level is the source (read-only). Unlinked:
          manual editable fallback. */}
      <div>
        <Slab label="Crawler Level" />
        {linkedCrawler ? (
          <p className="font-body text-sm">
            <span className="font-bold text-ink">{effectiveCrawlerLevel ?? '—'}</span>{' '}
            <span className="text-wk-muted">
              from associated crawler
              {linkedCrawler.name ? ` "${linkedCrawler.name}"` : ''}
            </span>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-wk-muted">
              Tech Level
            </span>
            <InlineEditField
              value={pilot.crawlerLevel ?? 1}
              type="number"
              min={1}
              max={6}
              ariaLabel="Edit Crawler Level"
              readOnly={readOnly}
              onSave={async (next) => {
                const numValue = typeof next === 'string' ? Number(next) : next
                await storeState.update('pilot', pilot.id, {
                  crawlerLevel: numValue,
                })
              }}
            />
          </div>
        )}
      </div>
    </section>
  )
}
