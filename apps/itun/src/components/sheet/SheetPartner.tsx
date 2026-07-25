/**
 * SheetPartner — the live sheet for a statted Drone / Companion.
 *
 * A partner "uses the same rules as Mechs for attaching Systems and Modules;
 * taking damage and being repaired; as well as Heat and Heat Checks" (Core Book,
 * stated at all four partner entries), so this is the mech sheet's shape minus
 * the things a partner does not have: no chassis, no pattern, no cargo hold on
 * the Immobile ones — and no Push, which is the rules' one explicit carve-out
 * and lives on the Dashboard anyway (ADR-021).
 *
 * It renders through `LiveSheet` directly rather than through `Sheet`, because
 * `Sheet` is built around store entities: it resolves a composition from
 * SoftLinks and offers a Change Log, a single-entity export, and a workspace
 * assignment. A partner has none of those — it is not in a store, it belongs to
 * its host, and it inherits that host's workspace. Threading it through `Sheet`
 * would have meant special-casing every one of those affordances OFF.
 *
 * There is deliberately NO index route. A partner is reachable only from its
 * host's sheet or a direct link, because it has no independent existence.
 */

import {
  Badge,
  buttonVariants,
  EntityGridRow,
  Field,
  MasonryColumns,
  SheetSectionCard,
  SheetSectionSlab,
  Stat,
} from 'component-lib'

import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { replacePartner } from '../../lib/partnerLookup'
import type { PartnerWithHost } from '../../lib/partnerLookup'
import {
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../../lib/rules/partnerStats'
import type { PartnerInstance } from '../../lib/schemas/partner'
import type { Crawler } from '../../lib/schemas/crawler'
import { cn } from '../../lib/utils'
import { useEntityStore } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { MechItemCard } from './MechItemCard'
import { partnerDisplayName } from './PartnerRows'
import { resolveModule, resolveSystem } from './mechItemRules'

type SheetPartnerProps = {
  found: PartnerWithHost
  /** The host pilot's crawler, when there is one — drives pilot-granted tech level. */
  crawler?: Crawler | null
  readOnly?: boolean
  store?: typeof useEntityStore
}

export function SheetPartner({
  found,
  crawler,
  readOnly = false,
  store = useEntityStore,
}: SheetPartnerProps) {
  const { partner, hostKind, host } = found
  const storeState = store()
  const editable = !readOnly

  // Pilot-granted partners scale off the UNION CRAWLER; mech-granted drones are
  // fixed by their stat block and ignore this entirely (Core Book pp.29/48/68).
  const crawlerTechLevel =
    hostKind === 'pilot' ? resolveEffectiveCrawlerLevel(host, crawler) : undefined
  const techLevel = partnerTechLevel(partner, crawlerTechLevel)
  const max = partnerDerivedStats(partner, techLevel)
  const statBlock = resolvePartnerStatBlock(partner) as { name?: string } | null

  const sp = Math.min(partner.currentSP ?? max.structurePoints, max.structurePoints)
  const ep = Math.min(partner.currentEP ?? max.energyPoints, max.energyPoints)
  const heat = Math.min(partner.currentHeat ?? 0, max.heatCapacity)

  /** Write through the HOST — a partner has no store row of its own. */
  const patch = (fields: Partial<PartnerInstance>): void => {
    if (readOnly) return
    void storeState.update(hostKind, host.id, {
      partners: replacePartner(host.partners, partner.id, fields),
    })
  }

  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: 'SP', stat: 'sp', value: sp, max: max.structurePoints },
    { key: 'ep', label: 'EP', stat: 'ep', value: ep, max: max.energyPoints, mobilePriority: false },
    { key: 'heat', label: 'Heat', stat: 'heat', value: heat, max: max.heatCapacity },
  ]

  const conditionsFor = (kind: 'system' | 'module') =>
    (kind === 'system' ? partner.systemConditions : partner.moduleConditions) ?? {}

  const setItemCondition = (kind: 'system' | 'module', slug: string): void => {
    const current = conditionsFor(kind)[slug] ?? 'intact'
    const next =
      current === 'intact' ? 'damaged' : current === 'damaged' ? 'destroyed' : ('intact' as const)
    patch(
      kind === 'system'
        ? { systemConditions: { ...conditionsFor('system'), [slug]: next } }
        : { moduleConditions: { ...conditionsFor('module'), [slug]: next } }
    )
  }

  const renderItems = (kind: 'system' | 'module') => {
    const slugs = kind === 'system' ? partner.systems : partner.modules
    if (slugs.length === 0) {
      return (
        <p className="font-body text-caption text-wk-muted">
          {kind === 'system' ? 'No systems installed.' : 'No modules installed.'}
        </p>
      )
    }
    const conditions = conditionsFor(kind)
    return (
      // Single column, matching the drone loadout's existing treatment: a
      // partner's slot budget is small (3 systems on a Survey Drone) and these
      // sit inside an already-narrow sheet.
      <MasonryColumns maxColumns={1}>
        {slugs.map((slug, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same slug may be installed twice, so slug alone is not unique; install order is stable
          <EntityGridRow key={`${slug}-${index}`}>
            <MechItemCard
              slug={slug}
              entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
              condition={conditions[slug] ?? 'intact'}
              usesRemaining={partner.itemUses?.[slug]}
              scrapPool={null}
              readOnly={readOnly}
              onStatusCycle={() => setItemCondition(kind, slug)}
              onUsesChange={(next) =>
                patch({ itemUses: { ...(partner.itemUses ?? {}), [slug]: next } })
              }
              onRepair={() => setItemCondition(kind, slug)}
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
          </EntityGridRow>
        ))}
      </MasonryColumns>
    )
  }

  return (
    <LiveSheet
      variant="partner"
      name={partnerDisplayName(partner)}
      strip={strip}
      back={{ href: `/sheet/${hostKind}/${host.id}`, label: host.name }}
      pill={{ label: statBlock?.name ?? 'Partner', tone: 'partner' }}
      actions={
        // The host badge is the partner's whole navigation story: it has no
        // roster entry to return to, so the one link that matters is upward.
        <AppLink
          href={`/sheet/${hostKind}/${host.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
          aria-label={`Open ${host.name}'s ${hostKind} sheet`}
        >
          <Badge shape="chip" surface="tone" tone={hostKind}>
            {host.name}
          </Badge>
        </AppLink>
      }
      renderBody={({ heroRef }) => (
        <div ref={heroRef as React.Ref<HTMLDivElement>} className="flex flex-col gap-4">
          <SheetSectionCard title="Identity" source={statBlock?.name}>
            <div className="flex flex-col gap-3">
              <Field
                label="Name"
                value={partner.name ?? ''}
                prominent
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
          </SheetSectionCard>

          <SheetSectionCard title="Stats">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Tech level is DERIVED, never typed in: for this partner it
                  comes from the Union Crawler (pilot-granted) or is fixed by
                  the stat block (mech-granted). See partnerTechLevel. */}
              <Stat label="Tech Level" value={techLevel} />
              <Stat label="System Slots" value={partner.systems.length} max={max.systemSlots} />
              <Stat label="Module Slots" value={partner.modules.length} max={max.moduleSlots} />
              <Stat label="Cargo" value={max.cargoCapacity} />
            </div>
          </SheetSectionCard>

          <SheetSectionSlab title="Systems" count={partner.systems.length}>
            {renderItems('system')}
          </SheetSectionSlab>

          <SheetSectionSlab title="Modules" count={partner.modules.length}>
            {renderItems('module')}
          </SheetSectionSlab>
        </div>
      )}
    />
  )
}
