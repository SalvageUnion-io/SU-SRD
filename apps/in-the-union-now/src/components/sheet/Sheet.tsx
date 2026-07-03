/**
 * Sheet — root live-sheet component on the Header C LiveSheet shell (plan
 * 4.1–4.3). Resolves the entity + its SoftLink composition (the ported
 * resolver in composition.ts), then renders ONE entity's sheet: hero =
 * entity-card-writ-large with live trackers, linked entities as rail chips
 * (live mini stats, whole-chip navigation), and the variant sheet as the
 * body.
 *
 * This replaces the old multi-pane composition layout (SheetHeader +
 * SheetSegmentSwitcher + stand-ins): linked entities are no longer
 * co-rendered as full sheets — they live in the rail and navigate.
 *
 * Stats are store-backed: hero trackers write current* fields through the
 * entity store; the condensed strip reads the same record, so hero and strip
 * stay in lockstep (§4.1).
 */

import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { btnVariants, MChip, Pill, StatBlock } from 'suref-react'
import type { PillTone, StatBlockState } from 'suref-react'

import { resolveClassName } from '../../lib/classRef'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import {
  crawlerMaxSP,
  isPilotDead,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { computeMechCapacity } from '../../lib/rules/capacity'
import { describePushOutcome } from '../../lib/rules/coreMechanic'
import { bayGate, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { defaultRoll, heatCheckPatch, performPush } from '../../lib/rules/heatCheck'
import { cn } from '../../lib/utils'
import { useEntityStore } from '../../stores/entityStore'
import type { SoftLinkStore } from '../wiring/useSoftLinks'
import { AppLink } from '../shared/AppLink'
import { AssignCrawlerToPilot } from '../wiring/AssignCrawlerToPilot'
import { AssignPilotToMech } from '../wiring/AssignPilotToMech'

import { resolveSheetComposition } from './composition'
import type { EntityLookup } from './composition'
import { ConditionsEditor } from './ConditionsEditor'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetSegment, LiveSheetStripItem } from './LiveSheet'
import { SheetHero, ChassisStats } from './SheetHero'
import type { ChassisStatItem } from './SheetHero'
import { RailChip, RailEmpty } from './SheetRail'
import { PilotIdentityLines } from './PilotIdentity'
import type { UsedToggleKey } from './PilotIdentity'
import { PilotSheet } from './PilotSheet'
import { MechSheet } from './MechSheet'
import { MechConditionsEditor } from './MechConditionsEditor'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerSheet } from './CrawlerSheet'
import { PublishButton } from './PublishButton'
import { QuickRollFab } from './QuickRollFab'
import { SheetActionsMenu } from './SheetActionsMenu'

// Re-exported so existing consumers (PublishButton, tests) keep their import.
export type { EntityLookup } from './composition'

type SheetProps = {
  kind: EntityRef['type']
  id: string
  /** Injectable entity lookup for testing; the live store when omitted. */
  entityStore?: EntityLookup
  /** Injectable soft-link snapshot for testing; the live store when omitted. */
  softLinkStore?: SoftLinkStore
  /** Injectable store hook (writes); the real Zustand store when omitted. */
  store?: typeof useEntityStore
  /** Hides publish + disables all stat editing (snapshot contexts). */
  readOnly?: boolean
}

/** Anchor CTA for rail empty slots ('+ Create'). */
function RailCta({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <AppLink
      href={href}
      className={cn(
        'rounded-[3px] border-chrome px-2.5 py-1.5 text-center font-body text-xs font-medium no-underline transition-colors duration-[120ms]',
        primary
          ? 'border-rust bg-rust text-su-white hover:bg-rust-hi'
          : 'border-ink bg-paper text-ink hover:bg-wk-bg-2'
      )}
    >
      {label}
    </AppLink>
  )
}

/** Live mini stats for a linked mech (rail chip body). */
function MechRailStats({ mech }: { mech: Mech }) {
  const maxSP = mechMaxSP(mech)
  const maxEP = mechMaxEP(mech)
  const maxHeat = mechMaxHeat(mech)
  return (
    <>
      <StatBlock
        code="SP"
        size="sm"
        stat="sp"
        value={mech.currentSP ?? maxSP}
        max={maxSP}
        editable={false}
      />
      <StatBlock
        code="EP"
        size="sm"
        stat="ep"
        value={mech.currentEP ?? maxEP}
        max={maxEP}
        editable={false}
      />
      <StatBlock
        code="HEAT"
        size="sm"
        stat="heat"
        value={mech.currentHeat ?? maxHeat}
        max={maxHeat}
        editable={false}
      />
    </>
  )
}

/** Live mini stats for a linked pilot (rail chip body). */
function PilotRailStats({ pilot }: { pilot: Pilot }) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  return (
    <>
      <StatBlock
        code="HP"
        size="sm"
        stat="hp"
        value={pilot.currentHP ?? maxHP}
        max={maxHP}
        editable={false}
      />
      <StatBlock
        code="AP"
        size="sm"
        stat="ap"
        value={pilot.currentAP ?? maxAP}
        max={maxAP}
        editable={false}
      />
    </>
  )
}

/** Live mini stats for a linked crawler (rail chip body). */
function CrawlerRailStats({ crawler }: { crawler: Crawler }) {
  const maxSP = crawlerMaxSP(crawler)
  const states = bayStates(crawler)
  return (
    <>
      <StatBlock
        code="SP"
        size="sm"
        stat="sp"
        value={crawler.currentSP ?? maxSP}
        max={maxSP}
        editable={false}
      />
      {states.length > 0 && <StatBlock code="BAYS" size="sm" states={states} />}
    </>
  )
}

function bayStates(crawler: Crawler): StatBlockState[] {
  return (crawler.crawlerBays ?? []).map((bay) => bay.condition ?? 'intact')
}

function mechStatusPill(mech: Mech): { label: string; tone: PillTone } {
  if (mech.destroyed) return { label: 'Destroyed', tone: 'bad' }
  const anyDamaged = [
    ...Object.values(mech.systemConditions ?? {}),
    ...Object.values(mech.moduleConditions ?? {}),
  ].some((c) => c !== 'intact')
  return anyDamaged ? { label: 'Damaged', tone: 'warn' } : { label: 'Intact', tone: 'ok' }
}

export function Sheet({
  kind,
  id,
  entityStore,
  softLinkStore,
  store = useEntityStore,
  readOnly = false,
}: SheetProps) {
  const storeState = store()
  // Crawler-economy dialog behind the UPKEEP/UPGRADE/TRADE lozenges (R-4).
  // Top-level (unconditional hook) — only the crawler branch reads it.
  const [econDialog, setEconDialog] = useState<CrawlerEconomyDialog | null>(null)

  const lookup: EntityLookup =
    entityStore ??
    ({
      get: (type, entityId) => storeState.get(type, entityId),
    } as EntityLookup)
  const links = softLinkStore ? softLinkStore.softLinks : storeState.softLinks

  const composition = resolveSheetComposition({
    kind,
    id,
    links,
    store: lookup,
  })
  const entity = lookup.get(kind, id)

  if (!entity) {
    return (
      <main className="mx-auto max-w-7xl p-3 sm:p-6">
        <p className="text-wk-muted text-sm">Entity not found.</p>
      </main>
    )
  }

  const wired = composition.mode === 'wired'
  const back = { href: '/', label: 'Dashboard' }
  // Top-bar trailing actions (§1.3): Edit as a sm ghost btn linking the
  // entity's edit wizard route, then Share (publish). Below the sm endpoint
  // both fold into a "⋯" overflow menu (design review U-5) so the condensed
  // bar keeps its width for the priority MiniStats; the menu items mount only
  // while open, so the inline copies stay the unique Edit/Share in the DOM.
  const editLink = (
    <AppLink
      href={`/${kind}s/${id}/edit`}
      aria-label={`Edit this ${kind}`}
      className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
    >
      Edit
    </AppLink>
  )
  const actions = !readOnly ? (
    <>
      <div className="hidden items-center gap-2.5 sm:flex">
        {editLink}
        <PublishButton entityKind={kind} entityId={id} entityStore={entityStore} />
      </div>
      <SheetActionsMenu className="sm:hidden">
        {editLink}
        <PublishButton entityKind={kind} entityId={id} entityStore={entityStore} />
      </SheetActionsMenu>
    </>
  ) : undefined

  // Mobile segmented Pilot/Mech/Crawler switch (design §3.7) — wired sheets
  // only; each present counterpart gets a segment, the viewed kind is active.
  let segments: LiveSheetSegment[] | undefined
  if (wired) {
    segments = []
    if (composition.pilot) {
      segments.push({
        key: 'pilot',
        label: 'Pilot',
        href: `/sheet/pilot/${composition.pilot.id}`,
        active: kind === 'pilot',
      })
    }
    if (composition.mech) {
      segments.push({
        key: 'mech',
        label: 'Mech',
        href: `/sheet/mech/${composition.mech.id}`,
        active: kind === 'mech',
      })
    }
    if (composition.crawler) {
      segments.push({
        key: 'crawler',
        label: 'Crawler',
        href: `/sheet/crawler/${composition.crawler.id}`,
        active: kind === 'crawler',
      })
    }
  }

  /** Persist a partial patch on the sheet's own entity (fire-and-forget). */
  function patch(fields: Partial<Pilot> & Partial<Mech> & Partial<Crawler>) {
    void storeState.update(kind, id, fields)
  }
  const editable = !readOnly

  // -------------------------------------------------------------------------
  // Pilot sheet
  // -------------------------------------------------------------------------
  if (kind === 'pilot') {
    const pilot = entity as Pilot
    const maxHP = Math.max(0, pilotMaxHP(pilot))
    const maxAP = Math.max(0, pilotMaxAP(pilot))
    const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
    const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)
    const tp = pilot.trainingPoints ?? 0

    const strip: LiveSheetStripItem[] = [
      { key: 'hp', label: 'HP', stat: 'hp', value: hp, max: maxHP },
      { key: 'ap', label: 'AP', stat: 'ap', value: ap, max: maxAP },
    ]

    const dead = isPilotDead(pilot)

    /** Toggle one of the once-per-Downtime used flags (rules A8–A10). */
    function toggleUsed(key: UsedToggleKey, next: boolean) {
      // Read the freshest flags from the store (not the render-time prop) so
      // rapid toggles on sibling lines don't stomp each other.
      const fresh = storeState.get('pilot', pilot.id)
      const prev = fresh?.usedToggles ?? pilot.usedToggles ?? {}
      void storeState.update('pilot', pilot.id, {
        usedToggles: { ...prev, [key]: next },
      })
    }

    /** Persist the full conditions list (flat string set, no partial merge). */
    function handleConditionsChange(next: string[]) {
      void storeState.update('pilot', pilot.id, { conditions: next })
    }

    const rail = (
      <>
        {composition.mech ? (
          <RailChip
            tone="mech"
            roleLabel="Assigned Mech"
            name={composition.mech.name}
            href={`/sheet/mech/${composition.mech.id}`}
            status={mechStatusPill(composition.mech)}
            stats={<MechRailStats mech={composition.mech} />}
          />
        ) : (
          <RailEmpty
            tone="mech"
            roleLabel="Assigned Mech"
            message="No mech assigned — build one to track its loadout and heat from here."
            actions={editable ? <RailCta href="/mechs/new" label="+ Create" primary /> : undefined}
          />
        )}
        {composition.crawler ? (
          <RailChip
            tone="crawler"
            roleLabel="Home Crawler"
            name={composition.crawler.name}
            href={`/sheet/crawler/${composition.crawler.id}`}
            tl={parseCrawlerTechLevel(composition.crawler.techLevel)}
            stats={<CrawlerRailStats crawler={composition.crawler} />}
          />
        ) : (
          <RailEmpty
            tone="crawler"
            roleLabel="Home Crawler"
            message="No crawler linked. Set the crawler level by hand until your union home is wired in."
            mock={
              <StatBlock
                code="CRAWLER"
                name="Level"
                unit="Tech Level"
                max={6}
                value={pilot.crawlerLevel ?? 1}
                onChange={editable ? (v) => patch({ crawlerLevel: Math.max(1, v) }) : undefined}
                editable={editable}
              />
            }
            actions={
              editable ? (
                <>
                  <RailCta href="/crawlers/new" label="+ Create" primary />
                  <AssignCrawlerToPilot pilotId={pilot.id} />
                </>
              ) : undefined
            }
          />
        )}
      </>
    )

    return (
      <LiveSheet
        variant="pilot"
        name={pilot.name}
        strip={strip}
        back={back}
        pill={dead ? { label: 'Dead', tone: 'bad' } : { label: 'Pilot', tone: 'pilot' }}
        wired={wired}
        rail={rail}
        segments={segments}
        actions={actions}
        fab={editable ? <QuickRollFab /> : undefined}
        renderHero={({ heroRef, rail: heroRail }) => (
          <SheetHero
            heroRef={heroRef}
            cat="Pilot"
            name={pilot.name}
            meta={
              <>
                <MChip label="Callsign" value={`“${pilot.callsign}”`} variant="call" />
                <MChip label="Class" value={resolveClassName(pilot.classRef)} variant="class" />
                {dead && <Pill tone="bad">Dead</Pill>}
              </>
            }
            specs={
              <PilotIdentityLines pilot={pilot} onToggleUsed={editable ? toggleUsed : undefined} />
            }
            trackers={
              <>
                <StatBlock
                  code="HP"
                  name="Hit Points"
                  unit="Points"
                  stat="hp"
                  max={maxHP}
                  value={hp}
                  onChange={editable ? (v) => patch({ currentHP: v }) : undefined}
                  editable={editable}
                />
                <StatBlock
                  code="AP"
                  name="Ability Points"
                  unit="Points"
                  stat="ap"
                  max={maxAP}
                  value={ap}
                  onChange={editable ? (v) => patch({ currentAP: v }) : undefined}
                  editable={editable}
                />
                <StatBlock
                  code="TP"
                  name="Training"
                  unit="Points"
                  value={tp}
                  onChange={editable ? (v) => patch({ trainingPoints: v }) : undefined}
                  editable={editable}
                />
              </>
            }
            inset={
              <div className="w-full sm:max-w-[360px]">
                <span className="mb-1 block text-right font-cond text-label font-bold uppercase leading-none tracking-caps text-ink">
                  Conditions
                </span>
                <ConditionsEditor
                  conditions={pilot.conditions}
                  onChange={handleConditionsChange}
                  readOnly={readOnly}
                />
              </div>
            }
            rail={heroRail}
          />
        )}
        renderBody={() => <PilotSheet pilot={pilot} store={store} readOnly={readOnly} />}
      />
    )
  }

  // -------------------------------------------------------------------------
  // Mech sheet
  // -------------------------------------------------------------------------
  if (kind === 'mech') {
    const mech = entity as Mech
    const chassis = SalvageUnionReference.Chassis.find((c) => c.name === mech.chassisRef) ?? null
    const maxSP = mechMaxSP(mech, chassis)
    const maxEP = mechMaxEP(mech, chassis)
    const maxHeat = mechMaxHeat(mech, chassis)
    const maxCargo = mechMaxCargo(mech, chassis)
    const cargoUsed = totalLotUnits(mech.cargoLots)
    const sp = Math.min(mech.currentSP ?? maxSP, maxSP)
    const ep = Math.min(mech.currentEP ?? maxEP, maxEP)
    const heat = Math.min(mech.currentHeat ?? maxHeat, maxHeat)

    const capacity = computeMechCapacity({
      chassisRef: mech.chassisRef,
      systems: mech.systems.map((ref) => ({ ref })),
      modules: mech.modules.map((ref) => ({ ref })),
    })

    const specs: ChassisStatItem[] = [
      {
        code: 'SYS',
        name: 'Slots',
        value: capacity.systemSlotsUsed,
        max: capacity.systemSlotsMax,
        pips: capacity.systemSlotsMax <= 12,
      },
      {
        code: 'MOD',
        name: 'Slots',
        value: capacity.moduleSlotsUsed,
        max: capacity.moduleSlotsMax,
        pips: capacity.moduleSlotsMax <= 12,
      },
      ...(typeof chassis?.salvageValue === 'number'
        ? [{ code: 'SV', name: 'Salvage', value: chassis.salvageValue }]
        : []),
    ]

    // U-5: on phones the condensed bar leads with Heat + SP; EP/Hold fold
    // until the sm breakpoint.
    const strip: LiveSheetStripItem[] = [
      { key: 'sp', label: 'SP', stat: 'sp', value: sp, max: maxSP },
      { key: 'ep', label: 'EP', stat: 'ep', value: ep, max: maxEP, mobilePriority: false },
      { key: 'heat', label: 'Heat', stat: 'heat', value: heat, max: maxHeat },
      {
        key: 'cargo',
        label: 'Hold',
        stat: 'cargo',
        value: cargoUsed,
        max: maxCargo,
        mobilePriority: false,
      },
    ]

    // Quick Ref p.233: "Can't Push if it'd take you over your Heat Cap" —
    // the FAB's Push is disabled (never clamped) when +2 Heat would exceed it.
    const pushLocked =
      heat + 2 > maxHeat
        ? `Can't Push at Heat ${heat}/${maxHeat} — +2 Heat would take the mech over its Heat Cap (p.233).`
        : undefined

    /**
     * Push (design review R-6/U-3): +2 Heat then an immediate Heat Check,
     * written through the store exactly like HeatCheckControl (ADR-007 —
     * deterministic bookkeeping auto-applies; marking a destroyed System or
     * Module stays a player call via its status badge). Reads the freshest
     * mech so rapid sequential actions don't stomp each other.
     */
    async function pushMech(): Promise<string> {
      const fresh = lookup.get('mech', mech.id) ?? mech
      const cap = mechMaxHeat(fresh, chassis)
      const freshMaxSP = mechMaxSP(fresh, chassis)
      const { nextHeat, effect } = performPush({
        heat: Math.min(fresh.currentHeat ?? cap, cap),
        heatCap: cap,
        currentSP: Math.min(fresh.currentSP ?? freshMaxSP, freshMaxSP),
        roll: defaultRoll,
      })
      await storeState.update('mech', mech.id, heatCheckPatch(effect, nextHeat))
      return describePushOutcome(nextHeat, effect)
    }

    const rail = (
      <>
        {composition.pilot ? (
          <RailChip
            tone="pilot"
            roleLabel="Assigned Pilot"
            name={composition.pilot.name}
            href={`/sheet/pilot/${composition.pilot.id}`}
            status={{ label: 'Active', tone: 'pilot' }}
            stats={<PilotRailStats pilot={composition.pilot} />}
          />
        ) : (
          <RailEmpty
            tone="pilot"
            roleLabel="Assigned Pilot"
            message="No pilot assigned. Link a pilot to speak for this machine."
            actions={
              editable ? (
                <>
                  <RailCta href="/pilots/new" label="+ Create" primary />
                  <AssignPilotToMech mechId={mech.id} />
                </>
              ) : undefined
            }
          />
        )}
        {composition.crawler ? (
          <RailChip
            tone="crawler"
            roleLabel="Home Crawler"
            name={composition.crawler.name}
            href={`/sheet/crawler/${composition.crawler.id}`}
            tl={parseCrawlerTechLevel(composition.crawler.techLevel)}
            stats={<CrawlerRailStats crawler={composition.crawler} />}
          />
        ) : (
          <RailEmpty
            tone="crawler"
            roleLabel="Home Crawler"
            message="No crawler linked — the assigned pilot's home crawler appears here."
            actions={
              editable ? <RailCta href="/crawlers/new" label="+ Create" primary /> : undefined
            }
          />
        )}
      </>
    )

    return (
      <LiveSheet
        variant="mech"
        name={mech.name}
        strip={strip}
        back={back}
        pill={mechStatusPill(mech)}
        wired={wired}
        rail={rail}
        segments={segments}
        syncStats={{ cargo: cargoUsed }}
        actions={actions}
        fab={editable ? <QuickRollFab onPush={pushMech} pushLocked={pushLocked} /> : undefined}
        renderHero={({ heroRef, rail: heroRail }) => (
          <SheetHero
            heroRef={heroRef}
            cat="Mech"
            name={mech.name}
            meta={
              <>
                <MChip label="Chassis" value={chassis?.name ?? mech.chassisRef} variant="class" />
                {chassis && typeof chassis.techLevel === 'number' && (
                  <MChip label="Tech LV" value={chassis.techLevel} />
                )}
              </>
            }
            identity={mech.patternName ? [{ label: 'Pattern', value: mech.patternName }] : []}
            specs={<ChassisStats items={specs} />}
            trackers={
              <>
                <StatBlock
                  code="Structure"
                  name="Points"
                  unit="Points"
                  stat="sp"
                  max={maxSP}
                  value={sp}
                  onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
                  editable={editable}
                />
                <StatBlock
                  code="Energy"
                  name="Points"
                  unit="Points"
                  stat="ep"
                  max={maxEP}
                  value={ep}
                  onChange={editable ? (v) => patch({ currentEP: v }) : undefined}
                  editable={editable}
                />
                <StatBlock
                  code="Heat"
                  name="Capacity"
                  unit="Heat"
                  stat="heat"
                  max={maxHeat}
                  value={heat}
                  onChange={editable ? (v) => patch({ currentHeat: v }) : undefined}
                  editable={editable}
                />
                {/* Cargo derives from hold usage (syncStats) — never editable. */}
                <StatBlock
                  code="Cargo"
                  name="Slots"
                  unit="Slots"
                  stat="cargo"
                  max={maxCargo}
                  value={cargoUsed}
                  editable={false}
                />
              </>
            }
            inset={
              <div className="flex w-full max-w-[360px] flex-col items-stretch gap-1">
                <span className="font-cond text-label font-bold uppercase tracking-caps text-ink">
                  Conditions
                </span>
                <MechConditionsEditor mech={mech} store={store} readOnly={readOnly} />
              </div>
            }
            rail={heroRail}
          />
        )}
        renderBody={() => (
          <MechSheet mech={mech} store={store} readOnly={readOnly} crawler={composition.crawler} />
        )}
      />
    )
  }

  // -------------------------------------------------------------------------
  // Crawler sheet
  // -------------------------------------------------------------------------
  const crawler = entity as Crawler
  const maxSP = crawlerMaxSP(crawler)
  const sp = Math.min(crawler.currentSP ?? maxSP, maxSP)
  const states = bayStates(crawler)
  const intactBays = states.filter((s) => s === 'intact').length
  const tl = parseCrawlerTechLevel(crawler.techLevel)

  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: 'SP', stat: 'sp', value: sp, max: maxSP },
    ...(states.length > 0
      ? [
          {
            key: 'bays',
            label: 'Bays',
            stat: 'cw' as const,
            value: intactBays,
            max: states.length,
          },
        ]
      : []),
  ]

  // UPKEEP / UPGRADE-pool / TRADE / CREW spec lozenges (design §4.4): upkeep
  // is 5 Scrap of crawler TL per Downtime (rules C3); the Upgrade Pool fills
  // toward 30× TL (rules C4); the Trading Bay sources TL+1 wares (p.223);
  // crew leads = one per installed bay (rules C11). On editable sheets the
  // economy lozenges are the R-4 action entry points (CrawlerEconomyControl).
  const trading = bayGate(crawler, 'Trading Bay')
  const crawlerSpecs: ChassisStatItem[] = [
    ...(tl !== undefined
      ? [
          {
            code: 'UPKEEP',
            name: 'Scrap/wk',
            unit: `Tech ${tl}`,
            value: 5,
            pips: false,
            onClick: editable ? () => setEconDialog('upkeep') : undefined,
            actionLabel: 'Pay Upkeep',
          },
        ]
      : []),
    {
      code: 'UPGRADE',
      name: 'Pool',
      value: crawler.upgradePool ?? 0,
      max: 30,
      pips: false,
      onClick: editable ? () => setEconDialog('upgrade') : undefined,
      actionLabel: 'Upgrade Crawler',
    },
    ...(trading.present && tl !== undefined
      ? [
          {
            code: 'TRADE',
            name: 'Wares',
            unit: `Tech ${tradingSourceTl(tl)}`,
            value: tradingSourceTl(tl),
            pips: false,
            onClick: editable ? () => setEconDialog('trade') : undefined,
            actionLabel: 'Open the Trading Bay',
          },
        ]
      : []),
    ...(states.length > 0
      ? [{ code: 'CREW', name: 'Leads', value: states.length, pips: false }]
      : []),
  ]

  /** Bays are Intact/Damaged ONLY (rules C8) — clicking a pip toggles. */
  function toggleBay(index: number) {
    const bay = (crawler.crawlerBays ?? [])[index]
    if (!bay || typeof storeState.updateCrawlerBay !== 'function') return
    const next = (bay.condition ?? 'intact') === 'intact' ? 'damaged' : 'intact'
    void storeState.updateCrawlerBay(crawler.id, bay.bayRef, { condition: next }, index)
  }

  const rail = (
    <>
      {composition.mech ? (
        <RailChip
          tone="mech"
          roleLabel="Docked Mech"
          name={composition.mech.name}
          href={`/sheet/mech/${composition.mech.id}`}
          status={mechStatusPill(composition.mech)}
          stats={<MechRailStats mech={composition.mech} />}
        />
      ) : (
        <RailEmpty
          tone="mech"
          roleLabel="Docked Mech"
          message="No mech in the bay — dock one to repair, re-arm and track it from here."
          actions={editable ? <RailCta href="/mechs/new" label="+ Create" primary /> : undefined}
        />
      )}
      {composition.pilot ? (
        <RailChip
          tone="pilot"
          roleLabel="Lead Pilot"
          name={composition.pilot.name}
          href={`/sheet/pilot/${composition.pilot.id}`}
          status={{ label: 'Active', tone: 'pilot' }}
          stats={<PilotRailStats pilot={composition.pilot} />}
        />
      ) : (
        <RailEmpty
          tone="pilot"
          roleLabel="Lead Pilot"
          message="No lead pilot set. Assign a crew member to speak for the crawler."
          actions={editable ? <RailCta href="/pilots/new" label="+ Create" primary /> : undefined}
        />
      )}
    </>
  )

  return (
    <>
      <LiveSheet
        variant="crawler"
        name={crawler.name}
        strip={strip}
        back={back}
        pill={{ label: 'Crawler', tone: 'crawler' }}
        wired={wired}
        rail={rail}
        segments={segments}
        actions={actions}
        fab={editable ? <QuickRollFab /> : undefined}
        renderHero={({ heroRef, rail: heroRail }) => (
          <SheetHero
            heroRef={heroRef}
            cat="Crawler"
            name={crawler.name}
            meta={tl !== undefined ? <MChip label="Tech LV" value={tl} /> : undefined}
            specs={crawlerSpecs.length > 0 ? <ChassisStats items={crawlerSpecs} /> : undefined}
            trackers={
              <>
                <StatBlock
                  code="Structure"
                  name="Points"
                  unit="Points"
                  stat="sp"
                  max={maxSP}
                  value={sp}
                  onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
                  editable={editable}
                />
                {states.length > 0 && (
                  <StatBlock
                    code="Bays"
                    name="Condition"
                    unit="Bays"
                    states={states}
                    onBay={editable ? toggleBay : undefined}
                  />
                )}
              </>
            }
            rail={heroRail}
          />
        )}
        renderBody={() => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            store={store}
            readOnly={readOnly}
          />
        )}
      />
      {editable && (
        <CrawlerEconomyControl
          crawler={crawler}
          store={store}
          open={econDialog}
          onClose={() => setEconDialog(null)}
        />
      )}
    </>
  )
}
