/**
 * PartnerCard — a statted Drone / Companion rendered as the reference entity it
 * already is, decorated with its instance state.
 *
 * This is deliberately NOT a bespoke partner component. It is a plain
 * `ReferenceEntityCard` over the partner's own stat block — the `equipment`
 * record for a pilot-granted companion, the `drones` record for a
 * chassis-granted one — with the instance's mutable fields threaded through the
 * card's existing seams:
 *
 *   - `titleOverride`  the instance's name ("Custos" over "Survey Drone"),
 *                      exactly as a pattern-named drone is titled in the SRD.
 *   - `statsOverride`  SP / EP / Heat as EDITABLE stats (a `StatItem` with an
 *                      `onChange` renders the Stat cell in +/- edit mode), plus
 *                      the derived read-onlys: tech level, slots used, cargo.
 *   - `afterExtraContent`  identity fields, the Hold, and the installed
 *                      Systems / Modules with their conditions and uses.
 *
 * Everything a partner could do on its late `/sheet/partner/:id` live sheet it
 * still does here; the sheet is gone, not the capability.
 *
 * WIDTH: a partner card is always full-width and never a masonry cell. It
 * carries a nested loadout and a cargo hold, so a column would crush it — and
 * placing it beside ordinary equipment would read as one item among many rather
 * than a unit that acts on its own turn. Callers render it OUTSIDE their
 * `MasonryColumns`.
 *
 * Superseded the partner live sheet; see ADR-028.
 */

import {
  Field,
  MasonryColumns,
  ReferenceEntityCard,
  type ReferenceEntityControl,
  type StatItem,
} from 'component-lib'

import { usePartnerCargo } from '../../lib/cargo/usePartnerCargo'
import { replacePartner } from '../../lib/partnerLookup'
import type { PartnerWithHost } from '../../lib/partnerLookup'
import {
  partnerCap,
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../../lib/rules/partnerStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { ItemCondition } from '../../lib/schemas/itemCondition'
import type { PartnerInstance } from '../../lib/schemas/partner'
import { useEntityStore } from '../../stores/entityStore'
import { MechItemCard } from './MechItemCard'
import { PartnerHold } from './PartnerHold'
import { partnerDisplayName } from './partnerDisplay'
import { resolveModule, resolveSystem } from './mechItemRules'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'

type PartnerCardProps = {
  /**
   * The partner together with the host that owns it. Taken as the existing
   * `PartnerWithHost` union rather than three loose props so `hostKind` and
   * `host` stay correlated — a `'pilot'` kind can only ever carry a `Pilot`.
   */
  found: PartnerWithHost
  /**
   * The host pilot's crawler, when there is one. Drives a PILOT-granted
   * partner's tech level and gates the Hold's two crawler-boundary moves.
   * Always absent for a mech host: a chassis-granted drone is fixed by its stat
   * block and never tracks the Union Crawler.
   */
  crawler?: Crawler | null
  /** The owning pilot's effective crawler tech level, when linked. */
  crawlerTechLevel?: number
  /**
   * The host's ability slugs, for the advisory per-host cap only — Mecha
   * Packmaster raises Mecha Companion from one to two, so the cap is a property
   * of the ability SET and cannot be read off the stat block.
   */
  hostAbilityRefs?: readonly string[]
  /** How many of this same stat block the host fields, for the "2 of 2" note. */
  fielded?: number
  readOnly?: boolean
  onRemove?: () => void
  store?: typeof useEntityStore
}

export function PartnerCard({
  found,
  crawler = null,
  crawlerTechLevel,
  hostAbilityRefs = [],
  fielded = 1,
  readOnly = false,
  onRemove,
  store = useEntityStore,
}: PartnerCardProps) {
  const { partner, hostKind, host } = found
  const storeState = store()
  const editable = !readOnly

  const statBlock = resolvePartnerStatBlock(partner)
  const techLevel = partnerTechLevel(partner, crawlerTechLevel)
  const max = partnerDerivedStats(partner, techLevel)

  const cargo = usePartnerCargo({
    found,
    techLevel,
    crawler,
    store,
    readOnly,
  })

  const sp = Math.min(partner.currentSP ?? max.structurePoints, max.structurePoints)
  const ep = Math.min(partner.currentEP ?? max.energyPoints, max.energyPoints)
  const heat = Math.min(partner.currentHeat ?? 0, max.heatCapacity)

  /** Write through the HOST — a partner has no store row of its own. */
  const patch = (fields: Partial<PartnerInstance>): void => {
    if (readOnly) return
    void storeState.update(
      hostKind,
      host.id,
      {
        partners: replacePartner(host.partners, partner.id, fields),
      },
      LIVE_SHEET_MANUAL
    )
  }

  const clamp = (next: number, ceiling: number) => Math.max(0, Math.min(next, ceiling))

  // SP / EP / Heat are EDITABLE stat cells; the rest are derived read-onlys.
  // Tech level is never typed in — it comes from the crawler (pilot-granted) or
  // is fixed by the stat block (mech-granted). See `partnerTechLevel`.
  const stats: StatItem[] = [
    {
      key: 'sp',
      label: 'SP',
      value: sp,
      outOfMax: max.structurePoints,
      onChange: editable
        ? (next) => patch({ currentSP: clamp(next, max.structurePoints) })
        : undefined,
    },
    {
      key: 'ep',
      label: 'EP',
      value: ep,
      outOfMax: max.energyPoints,
      onChange: editable
        ? (next) => patch({ currentEP: clamp(next, max.energyPoints) })
        : undefined,
    },
    {
      key: 'heat',
      label: 'Heat',
      value: heat,
      outOfMax: max.heatCapacity,
      onChange: editable
        ? (next) => patch({ currentHeat: clamp(next, max.heatCapacity) })
        : undefined,
    },
    { key: 'tech', label: 'Tech Level', value: techLevel },
    { key: 'sys', label: 'System Slots', value: partner.systems.length, outOfMax: max.systemSlots },
    { key: 'mod', label: 'Module Slots', value: partner.modules.length, outOfMax: max.moduleSlots },
    ...(max.cargoCapacity > 0
      ? [{ key: 'cargo', label: 'Cargo', value: cargo.usage.used, outOfMax: cargo.usage.cap }]
      : []),
  ]

  // Over-cap is SHOWN, never blocked (ADR-007; the sheet is a Free-Edit surface
  // per ADR-021).
  const cap = partnerCap(partner.hostRef, hostAbilityRefs)
  const controls: ReferenceEntityControl[] = []
  if (fielded > 1 || fielded > cap) {
    controls.push({ key: 'cap', badge: `${fielded} of ${cap}` })
  }
  if (editable && onRemove) {
    controls.push({
      key: 'remove',
      label: 'Remove',
      ariaLabel: `Remove ${partnerDisplayName(partner)}`,
      onClick: onRemove,
      variant: 'danger',
    })
  }

  const conditionsFor = (kind: 'system' | 'module') =>
    (kind === 'system' ? partner.systemConditions : partner.moduleConditions) ?? {}

  const setItemCondition = (kind: 'system' | 'module', slug: string, next: ItemCondition): void => {
    patch(
      kind === 'system'
        ? { systemConditions: { ...conditionsFor('system'), [slug]: next } }
        : { moduleConditions: { ...conditionsFor('module'), [slug]: next } }
    )
  }

  /** The status badge CYCLES: Intact → Damaged → Destroyed → Intact. */
  const cycleItemCondition = (kind: 'system' | 'module', slug: string): void => {
    const current = conditionsFor(kind)[slug] ?? 'intact'
    const next: ItemCondition =
      current === 'intact' ? 'damaged' : current === 'damaged' ? 'destroyed' : 'intact'
    setItemCondition(kind, slug, next)
  }

  const renderItems = (kind: 'system' | 'module') => {
    const slugs = kind === 'system' ? partner.systems : partner.modules
    if (slugs.length === 0) return null
    const conditions = conditionsFor(kind)
    return (
      <div className="flex flex-col gap-2">
        <h4 className="font-cond text-caption font-bold uppercase tracking-caps text-wk-muted">
          {kind === 'system' ? 'Systems' : 'Modules'}
        </h4>
        {/* A partner's slot budget is small (3 systems on a Survey Drone), so a
            single column reads better than a masonry even at full width. */}
        <MasonryColumns maxColumns={1}>
          {slugs.map((slug, index) => (
            <MechItemCard
              // biome-ignore lint/suspicious/noArrayIndexKey: the same slug may be installed twice, so slug alone is not unique; install order is stable
              key={`${slug}-${index}`}
              slug={slug}
              entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
              condition={conditions[slug] ?? 'intact'}
              usesRemaining={partner.itemUses?.[slug]}
              scrapPool={null}
              readOnly={readOnly}
              onStatusCycle={() => cycleItemCondition(kind, slug)}
              onUsesChange={(next) =>
                patch({ itemUses: { ...(partner.itemUses ?? {}), [slug]: next } })
              }
              // Repair means REPAIR: straight to Intact, not the next step of
              // the cycle (which would destroy a Damaged item).
              onRepair={() => setItemCondition(kind, slug, 'intact')}
              onRemove={
                editable
                  ? () =>
                      patch(
                        kind === 'system'
                          ? { systems: partner.systems.filter((_, i) => i !== index) }
                          : { modules: partner.modules.filter((_, i) => i !== index) }
                      )
                  : undefined
              }
            />
          ))}
        </MasonryColumns>
      </div>
    )
  }

  return (
    <ReferenceEntityCard
      data={statBlock ?? undefined}
      size="medium"
      titleOverride={partnerDisplayName(partner)}
      statsOverride={stats}
      controls={controls.length > 0 ? controls : undefined}
      afterExtraContent={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Field
              label="Name"
              value={partner.name ?? ''}
              placeholder={statBlock?.name ?? 'Unnamed'}
              ariaLabel="Edit name"
              onSave={editable ? (next) => patch({ name: next }) : undefined}
            />
            <Field
              label="A.I. Personality"
              value={partner.aiPersonality ?? ''}
              placeholder="Roll on the A.I. Personality Table, or choose your own."
              ariaLabel="Edit A.I. personality"
              onSave={editable ? (next) => patch({ aiPersonality: next }) : undefined}
            />
            <Field
              label="Appearance"
              value={partner.appearance ?? ''}
              multiline
              fill
              placeholder="However you wish."
              ariaLabel="Edit appearance"
              onSave={editable ? (next) => patch({ appearance: next }) : undefined}
            />
          </div>

          {/* THE HOLD — absent, not empty, when the partner cannot carry.
              Auto-Turret has cargoCapacity 0 AND the Immobile trait: it is not
              a container with nothing in it, it is not a container. */}
          {max.cargoCapacity > 0 && (
            <PartnerHold cargo={cargo} crawlerLinked={Boolean(crawler)} readOnly={readOnly} />
          )}

          {renderItems('system')}
          {renderItems('module')}
        </div>
      }
    />
  )
}
