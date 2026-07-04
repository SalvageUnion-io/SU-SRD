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

import { useMemo } from 'react'
import { Btn, Panel, Slab } from 'suref-react'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry, Injury, Pilot } from '../../lib/schemas/pilot'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import {
  clampPilotCurrentStats,
  injuryMaxHpPenalty,
  isPilotDead,
  pilotMaxAP,
} from '../../lib/rules/derivedStats'
import type { Roll } from '../../lib/rules/heatCheck'
import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../wiring/useSoftLinks'
import { destroyedUndoToast } from './destroyedUndoToast'
import { Ecflow, Erow } from './Erow'
import { InlineEditField } from './InlineEditField'
import { PilotTakeDamageControl } from './PilotTakeDamageControl'
import { pilotInventoryCapacity, pilotInventoryUsed, resolveEquipment } from './pilotInventory'
import {
  GenericEntryAdder,
  GenericEntryCard,
  InjuryRow,
  PilotAbilityItem,
  PilotEquipmentItem,
  resolveAbility,
} from './PilotSheetItems'

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
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- intentional: effectiveCrawlerLevel is a derived scalar, memoized purely to keep the {techLevel} object identity stable for the memoized ReferenceEntityDisplay subtree
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
          <p className="font-body text-caption text-wk-muted">Nothing carried.</p>
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
          <p className="font-body text-caption text-wk-muted">No injuries — keep it that way.</p>
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
            <span className="font-cond text-label font-bold uppercase tracking-wide text-wk-muted">
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
