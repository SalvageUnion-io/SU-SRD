/**
 * SheetCrawler — the crawler branch of the live sheet (extracted from
 * Sheet.tsx), in the poster layout.
 *
 * The body owns the identity band now (Workshop-Manual layout): `CrawlerSheet`
 * renders the `SheetHero` band as its first region.
 * This component's remaining job is composing the economy band (the poster
 * `.econ` frame — `CrawlerEconFrame` — wrapping the SP `VitalGauge` + the
 * Tech-LVL/Upkeep/Upgrade/Trade/Crew lozenges) and its action entry points
 * (`CrawlerEconActions`), handed to `CrawlerSheet` as `economy` and
 * `economyActions` and rendered as the identity band's vitals card and its head
 * chips, plus the docked-mech/lead-pilot rail content handed down
 * as `linkedUnits`. Owns the economy-dialog state (it was hoisted to Sheet
 * only because the branch wasn't a component).
 */

import { containerOf } from 'game-domain/container'
import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { Crawler } from 'game-domain/schemas/crawler'
import { useState } from 'react'
import {
  crawlerMaxSPParts,
  parseCrawlerTechLevel,
  pinFor,
  resolvePool,
} from 'salvageunion-reference/rules'
import { linesFromBreakdown, Stat } from '../../components/index'
import { bayGate, SCRAP_TLS, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { runWrite } from '../../lib/runWrite'
import { LIVE_SHEET_OVERRIDE } from '../../stores/surfaceProvenance'
import { AssignPicker } from '../wiring/AssignPicker'
import type { AssignedSlot, AssignedUnit } from './AssignedUnits'
import { AssignedUnits } from './AssignedUnits'
import { crawlerStamp } from './bandStamps.model'
import type { EconLozItem } from './CrawlerEcon'
import { CrawlerEconActions, CrawlerEconFrame } from './CrawlerEcon'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import { CrawlerSheet } from './CrawlerSheet'
import { changedFields, freshEntity } from './controlPrimitives'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { bayStates, mechRailItems, pilotRailItems, rowStats } from './railStats.model'
import { SheetVitalGauge } from './SheetVitalGauge'
import type { SheetViewCommonProps } from './sheetViewProps.model'

type SheetCrawlerProps = SheetViewCommonProps & { crawler: Crawler }

/** The Upgrade pool's cap. */
const UPGRADE_POOL_MAX = 30

export function SheetCrawler({
  crawler,
  composition,
  actions,
  segments,
  band,
  editable,
  readOnly,
  store,
  storeState,
  holds,
  hrefFor,
  withheld,
  patch,
}: SheetCrawlerProps) {
  // Crawler-economy dialog behind the UPKEEP/UPGRADE/TRADE lozenges.
  const [econDialog, setEconDialog] = useState<CrawlerEconomyDialog | null>(null)

  const spParts = crawlerMaxSPParts(crawler)
  const maxSP = spParts.total
  const spLines = linesFromBreakdown(spParts, {
    base: `Tech ${crawler.techLevel?.replace(/\D/g, '') || '?'} Crawler`,
    baseDetail: 'base',
    installed: 'Crawler type bonus',
  })
  const sp = resolvePool(crawler.currentSP, maxSP)
  // Cap override (ADR-022, Free Edit): pin Max SP as an absolute
  // `maxSpOverride`; the gauge shows "overridden from N" + a revert. Tagged
  // `override`. The pin is normalised with `pinFor` (equal to the derivation
  // means none), and a commit that changes nothing is not written.
  const overrideCrawlerMax = (fields: Partial<Crawler>) => {
    const changed = changedFields(freshEntity(storeState, 'crawler', crawler), fields)
    if (!changed) return
    runWrite(() => storeState.update('crawler', crawler.id, changed, LIVE_SHEET_OVERRIDE))
  }
  const states = bayStates(crawler)
  const intactBays = states.filter((s) => s === 'intact').length
  const tl = parseCrawlerTechLevel(crawler.techLevel)

  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: 'SP', value: sp, max: maxSP },
    ...(states.length > 0
      ? [
          {
            key: 'bays',
            label: 'Bays',

            value: intactBays,
            max: states.length,
          },
        ]
      : []),
  ]

  // Tech LVL / UPKEEP / UPGRADE-pool / TRADE / CREW lozenges (poster
  // `.lozrow`): upkeep is 5 Scrap of crawler TL per Downtime;
  // the Upgrade Pool fills toward 30× TL; the Trading Bay
  // sources TL+1 wares (p.223); crew leads = one per installed bay.
  // On editable sheets the actionable lozenges (Upkeep/Upgrade/Trade)
  // are the economy action entry points (CrawlerEconomyControl); Tech LVL and
  // Crew are read-only readouts.
  const trading = bayGate(crawler, 'trading-bay')
  const econItems: EconLozItem[] = [
    // Tech LVL is NOT here any more: it is the crawler's own rung, and it
    // reads as the band's TL chip beside the crawler type. The economy rail keeps the
    // things you SPEND (upkeep, upgrade pool, trade, crew).
    ...(tl !== undefined
      ? [
          {
            label: 'Upkeep',
            value: 5,
            caption: `T${tl}+ Scrap`,
            action: editable
              ? {
                  label: 'Pay',
                  ariaLabel: 'Pay Upkeep',
                  onClick: () => setEconDialog('upkeep'),
                }
              : undefined,
          },
        ]
      : []),
    // Upgrade is NOT a flat readout: it FILLS toward a cap, which is what a
    // gauge shows and a number cannot. It renders as one below the SP gauge —
    // its Fund action still collects onto the Vitals card's head with the others.
    ...(editable
      ? [
          {
            label: 'Upgrade',
            value: crawler.upgradePool ?? 0,
            actionOnly: true,
            action: {
              label: 'Fund',
              ariaLabel: 'Upgrade Crawler',
              onClick: () => setEconDialog('upgrade'),
            },
          },
        ]
      : []),
    ...(trading.present && tl !== undefined
      ? [
          {
            // Its Trade action only: the rail reads no Trade (owner, round 5).
            label: 'Trade',
            value: tradingSourceTl(tl),
            actionOnly: true,
            action: editable
              ? {
                  label: 'Trade',
                  ariaLabel: 'Open the Trading Bay',
                  onClick: () => setEconDialog('trade'),
                }
              : undefined,
          },
        ]
      : []),
  ]

  // A crawler has no single "lead pilot" and no single docked mech: it is a
  // home for a CREW. Both slots are lists — every pilot wired to this crawler,
  // and every mech docked in it by its OWN `mech-to-crawler` link (ADR-037).
  // A mech is assigned independently of its pilot, so a crew pilot's mech that
  // is docked somewhere else is not in this bay, and a docked mech with no
  // pilot still is.
  const withheldMechs = withheld.filter((u) => u.kind === 'mech')
  const withheldPilots = withheld.filter((u) => u.kind === 'pilot')

  /**
   * Take one pilot off the crew, or one mech out of the bay — the link, never
   * the entity (always available on editable sheets; no confirm, ADR-007).
   *
   * Only for one this sheet holds: a link is undrawn from its pilot or mech, so
   * a crewmate's on the list is theirs to take off, not yours.
   */
  function unassignFrom(type: 'pilot-to-crawler' | 'mech-to-crawler', fromId: string) {
    const linkId = storeState.softLinks.find(
      (l) => l.type === type && l.to.id === crawler.id && l.from.id === fromId
    )?.id
    const fromKind = type === 'pilot-to-crawler' ? 'pilot' : 'mech'
    return editable && linkId && holds(fromKind, fromId)
      ? () => runWrite(() => storeState.delete('softLink', linkId))
      : undefined
  }
  // The pickers offer only what lives where this crawler does — its Game, or
  // Shelves — and never what is already aboard.
  const self = { type: 'crawler', id: crawler.id } as const
  const container = containerOf(crawler)
  const crewPicker = (
    <AssignPicker
      subject={self}
      container={container}
      pick="pilot"
      exclude={composition.crawlerPilots.map((p) => p.id)}
      size="mini"
    />
  )
  const dockPicker = (
    <AssignPicker
      subject={self}
      container={container}
      pick="mech"
      exclude={composition.crawlerMechs.map((m) => m.id)}
      size="mini"
    />
  )

  // Assigned units: every docked mech and every crew pilot a contentful Mini
  // with its vitals, the same in Read and Edit; Edit adds Unassign after each
  // (one this sheet holds), and Assign / + Create for the next of each kind.
  const units: AssignedUnit[] = [
    ...composition.crawlerMechs.map((dockedMech) => ({
      key: dockedMech.id,
      kind: 'mech' as const,
      name: dockedMech.name,
      readings: rowStats(mechRailItems(dockedMech)),
      href: hrefFor('mech', dockedMech.id),
      onUnassign: unassignFrom('mech-to-crawler', dockedMech.id),
    })),
    ...withheldMechs.map((unit) => ({
      key: unit.key,
      kind: 'mech' as const,
      name: unit.name ?? 'Not shared',
    })),
    ...composition.crawlerPilots.map((crewPilot) => ({
      key: crewPilot.id,
      kind: 'pilot' as const,
      name: crewPilot.name,
      readings: rowStats(
        pilotRailItems(crewPilot, resolveEffectiveCrawlerLevel(crewPilot, crawler))
      ),
      href: hrefFor('pilot', crewPilot.id),
      onUnassign: unassignFrom('pilot-to-crawler', crewPilot.id),
    })),
    ...withheldPilots.map((unit) => ({
      key: unit.key,
      kind: 'pilot' as const,
      name: unit.name ?? 'Not shared',
    })),
  ]
  // A crawler takes more than one of each, so the way to add the next
  // survives the first.
  const slots: AssignedSlot[] = [
    { key: 'mech', kind: 'mech', assign: dockPicker, placeholder: 'Dock a Mech' },
    { key: 'pilot', kind: 'pilot', assign: crewPicker, placeholder: 'Add a Pilot to the crew' },
  ]
  const rail = <AssignedUnits units={units} slots={slots} editable={editable} />

  // Economy band (poster `.econ`: SP `VitalGauge` over the Tech-LVL/Upkeep/
  // Upgrade/Trade/Crew lozenges) — built here because it needs `patch` +
  // the econDialog state, which CrawlerSheet does not own; handed down as
  // `economy` and rendered inside the body's Identity card.
  const economy = (
    <CrawlerEconFrame
      gauge={
        <SheetVitalGauge
          vital="sp"
          value={sp}
          max={maxSP}
          onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
          onMaxChange={
            editable
              ? (next) => overrideCrawlerMax({ maxSpOverride: pinFor(next, spParts) })
              : undefined
          }
          breakdown={editable ? spParts : undefined}
          provenance={editable ? spLines : undefined}
          onRevertOverride={
            editable ? () => overrideCrawlerMax({ maxSpOverride: undefined }) : undefined
          }
          readOnly={!editable}
        />
      }
      upgrade={
        <SheetVitalGauge
          vital="upgrade"
          value={crawler.upgradePool ?? 0}
          max={UPGRADE_POOL_MAX}
          onChange={editable ? (v) => patch({ upgradePool: v }) : undefined}
          readOnly={!editable}
        />
      }
      items={econItems}
    />
  )
  // Pay / Fund / Trade: chips on the Vitals card's head, not a row in its body.
  const economyActions = econItems.some((item) => item.action) ? (
    <CrawlerEconActions items={econItems} />
  ) : undefined

  return (
    <>
      <LiveSheet
        variant="crawler"
        name={crawler.name}
        strip={strip}
        segments={segments}
        band={band}
        source={crawler.seedRef ? 'starter' : undefined}
        kindDetail={crawlerStamp(crawler.type)}
        // The crawler's rung is the band's TL chip, ahead of its type (C2's
        // rank before relation); Edit grows its stepper on the chip, a Free
        // Edit of the stored rung (the Upgrade dialog is the play path).
        rank={
          <Stat
            label="TL"
            value={tl ?? '—'}
            mode={readOnly || tl === undefined ? 'read' : 'edit'}
            onChange={
              readOnly || tl === undefined
                ? undefined
                : (next) => patch({ techLevel: `tech-${next}` })
            }
            min={SCRAP_TLS[0]}
            ceiling={SCRAP_TLS[SCRAP_TLS.length - 1]}
            stepperLabel="Tech Level"
          />
        }
        actions={actions}
        renderBody={() => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            mechHref={composition.mech ? hrefFor('mech', composition.mech.id) : undefined}
            store={store}
            readOnly={readOnly}
            economy={economy}
            economyActions={economyActions}
            linkedUnits={rail}
            crew={composition.crew}
            crewHref={
              readOnly ? undefined : `/npcs/new?view=crew&crawler=${encodeURIComponent(crawler.id)}`
            }
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
