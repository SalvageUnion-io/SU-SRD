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

import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefEntity, SURefEquipment } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { ChoiceSelections } from 'suref-react'

import { HIDE_CHOICES } from './MechSheet'
import { PipTracker } from './PipTracker'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { resolveAbilityApCost } from '../../lib/abilityCost'
import { resolveClassName } from '../../lib/classRef'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { PILOT_MAX_HP, PILOT_MAX_AP } from '../../lib/pilotStats'
import { useEntityStore } from '../../stores/entityStore'
import { useSoftLinks } from '../wiring/useSoftLinks'
import { ConditionToggle } from '../shared/ConditionToggle'
import { useEntityChoices } from '../shared/useEntityChoices'
import { ConditionsEditor } from './ConditionsEditor'
import { EditableStatRow } from './EditableStatRow'
import { InlineEditField } from './InlineEditField'
import { SheetSectionHeading } from './SheetSectionHeading'

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
  /**
   * Scaling parent for `scalesWithField` choice caps (e.g. the Modification
   * choice scaling with `techLevel`). When the pilot has an effective crawler
   * level, this is `{ techLevel: level }` so the cap resolves; undefined leaves
   * the cap unbounded.
   */
  scalingParent: Record<string, unknown> | undefined
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

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        {equipment ? (
          <ReferenceEntityDisplay
            data={equipment as unknown as SURefEntity}
            compact
            selections={selections}
            onSelectionChange={readOnly ? undefined : setSelections}
            scalingParent={scalingParent}
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

type PilotAbilityItemProps = {
  /** Resolved ability entity to display. */
  ability: SURefAbility
  /** Pilot's current AP — gates whether the spend action is enabled. */
  currentAP: number
  /** Whether this ability has been marked used (once-per-rest tracking). */
  used: boolean
  /**
   * Spend this ability's fixed AP cost from the pilot's current AP. Only invoked
   * when the cost is a fixed number and the pilot has enough AP.
   */
  onSpend: (cost: number) => void
  /** Toggle the used/recharge state for this ability. */
  onToggleUsed: (next: boolean) => void
  /** When true, renders the cost + state read-only (no spend / no toggle). */
  readOnly: boolean
}

/**
 * Renders ONE pilot ability: its ReferenceEntityDisplay plus live-play
 * affordances (Slice D) — the AP cost, a "Spend AP" button that decrements the
 * pilot's current AP by that cost, and a used/recharge toggle for once-per-rest
 * abilities.
 *
 * AP cost is resolved from the ability's actions (see resolveAbilityApCost):
 * `null` means there is no FIXED numeric cost (variable 'X' cost or none), in
 * which case no spend button renders — we never spend an undefined amount.
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

  return (
    <div className="flex flex-col gap-1.5">
      <ReferenceEntityDisplay
        data={ability as unknown as SURefEntity}
        compact
        label={ability.tree}
        hide={HIDE_CHOICES}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
          AP Cost: {apCost ?? '—'}
        </span>
        {!readOnly && apCost !== null && (
          <button
            type="button"
            disabled={!canSpend}
            aria-label={`Spend ${apCost} AP for ${ability.name}`}
            onClick={() => {
              onSpend(apCost)
            }}
            className="inline-flex items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper px-2 py-0.5 font-cond text-[10px] font-bold uppercase tracking-wide text-su-black hover:bg-su-black hover:text-su-paper focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-su-paper disabled:hover:text-su-black"
          >
            Spend AP
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            aria-pressed={used}
            aria-label={used ? `Recharge ${ability.name}` : `Mark ${ability.name} used`}
            onClick={() => {
              onToggleUsed(!used)
            }}
            className={
              used
                ? 'inline-flex items-center justify-center rounded border-[1.5px] border-su-black bg-su-black px-2 py-0.5 font-cond text-[10px] font-bold uppercase tracking-wide text-su-paper hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring'
                : 'inline-flex items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper px-2 py-0.5 font-cond text-[10px] font-bold uppercase tracking-wide text-su-black hover:bg-su-black hover:text-su-paper focus:outline-none focus:ring-2 focus:ring-ring'
            }
          >
            {used ? 'Recharge' : 'Mark Used'}
          </button>
        )}
        {readOnly && used && (
          <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
            Used
          </span>
        )}
      </div>
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

  // Resolve the pilot's associated crawler (if any) via the pilot-to-crawler
  // SoftLink, then compute the EFFECTIVE crawler Tech Level used to scale choice
  // caps (e.g. the Modification choice). A linked crawler's techLevel wins; with
  // no link the pilot's manual `crawlerLevel` is used; with neither it is
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

  async function handleEquipmentConditionChange(slug: string, next: ItemCondition) {
    // Read the freshest map from the store (not the render-time prop) so rapid
    // sequential toggles don't stomp each other with a stale-closure overwrite.
    const prev =
      storeState.get('pilot', pilot.id)?.equipmentConditions ?? pilot.equipmentConditions ?? {}
    await storeState.update('pilot', pilot.id, { equipmentConditions: { ...prev, [slug]: next } })
  }

  async function handleSpendAP(cost: number) {
    // Read the freshest currentAP from the store (not the render-time prop) so
    // rapid spends don't stomp each other, then clamp the result at 0.
    const fresh = storeState.get('pilot', pilot.id)
    const current = fresh?.currentAP ?? pilot.currentAP ?? 0
    const next = Math.max(0, current - cost)
    if (next === current) return
    await storeState.update('pilot', pilot.id, { currentAP: next })
  }

  async function handleAbilityUsedChange(slug: string, next: boolean) {
    // Read the freshest set from the store so concurrent toggles on sibling
    // abilities aren't clobbered by a stale-closure overwrite.
    const fresh = storeState.get('pilot', pilot.id)
    const prev = new Set(fresh?.usedAbilities ?? pilot.usedAbilities ?? [])
    if (next) {
      prev.add(slug)
    } else {
      prev.delete(slug)
    }
    await storeState.update('pilot', pilot.id, { usedAbilities: Array.from(prev) })
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
        <SheetSectionHeading kind="pilot">Stats</SheetSectionHeading>
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
                step={1}
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
                max={PILOT_MAX_AP}
                step={1}
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
        <SheetSectionHeading kind="pilot">Conditions</SheetSectionHeading>
        <ConditionsEditor
          conditions={pilot.conditions}
          onChange={(next) => {
            void handleConditionsChange(next)
          }}
          readOnly={readOnly}
        />
      </div>

      {/* Crawler Level — scales choice caps (e.g. the Modification choice). When
          the pilot is linked to a crawler, that crawler's Tech Level is the
          source (read-only); when unlinked, a manual editable fallback. */}
      <div>
        <SheetSectionHeading kind="pilot">Crawler Level</SheetSectionHeading>
        {linkedCrawler ? (
          <p className="text-sm">
            <span className="font-mono text-lg font-bold text-su-black">
              {effectiveCrawlerLevel ?? '—'}
            </span>{' '}
            <span className="text-muted-foreground">
              from associated crawler{linkedCrawler.name ? ` "${linkedCrawler.name}"` : ''}
            </span>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
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
                await storeState.update('pilot', pilot.id, { crawlerLevel: numValue })
              }}
            />
          </div>
        )}
      </div>

      {/* Abilities */}
      {pilot.abilities.length > 0 && (
        <div>
          <SheetSectionHeading kind="pilot">Abilities</SheetSectionHeading>
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
                <PilotAbilityItem
                  key={ability.id}
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
              )
            })}
          </div>
        </div>
      )}

      {/* Equipment */}
      {pilot.equipment.length > 0 && (
        <div>
          <SheetSectionHeading kind="pilot">Equipment</SheetSectionHeading>
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
                scalingParent={scalingParent}
                store={store}
              />
            ))}
          </div>
        </div>
      )}

      {/* Identity */}
      <div className="flex flex-col gap-2">
        <SheetSectionHeading kind="pilot" className="mb-0">
          Identity
        </SheetSectionHeading>
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
