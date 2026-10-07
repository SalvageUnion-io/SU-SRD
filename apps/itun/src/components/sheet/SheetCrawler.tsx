/**
 * SheetCrawler — the crawler branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The body owns the identity band now (Workshop-Manual layout): `CrawlerSheet`
 * renders the `SheetHero` band as its first region.
 * This component's remaining job is composing the economy band (the poster
 * `.econ` frame — `CrawlerEconFrame` — wrapping the SP `VitalGauge` + the
 * Tech-LVL/Upkeep/Upgrade/Trade/Crew lozenges, the R-4 action entry points),
 * which is handed to `CrawlerSheet` as `economy` and rendered as the identity
 * band's vitals rail, plus the docked-mech/lead-pilot rail content handed down
 * as `linkedUnits`. Owns the economy-dialog state (it was hoisted to Sheet
 * only because the branch wasn't a component).
 */

import { EntityRow, linesFromBreakdown, VitalGauge } from 'component-lib'
import { useState } from 'react'
import { crawlerMaxSPParts, pinFor, resolvePool } from 'salvageunion-reference/rules'
import { containerOf } from '../../lib/container'
import { parseCrawlerTechLevel, resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { bayGate, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import { LIVE_SHEET_OVERRIDE } from '../../stores/surfaceProvenance'
import { AppLink } from '../shared/AppLink'
import { AssignPicker } from '../wiring/AssignPicker'
import type { EconLozItem } from './CrawlerEcon'
import { CrawlerEconFrame } from './CrawlerEcon'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import { CrawlerSheet } from './CrawlerSheet'
import { changedFields, freshEntity } from './controlPrimitives'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { bayStates, mechRailItems, mechStatusPill, pilotRailItems, rowStats } from './railStats'
import { RailCta, WithheldUnitRow } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetCrawlerProps = SheetViewCommonProps & { crawler: Crawler }

/** The Upgrade pool's cap (rules C4). */
const UPGRADE_POOL_MAX = 30

export function SheetCrawler({
  crawler,
  composition,
  back,
  actions,
  segments,
  editable,
  readOnly,
  store,
  storeState,
  lookup,
  holds,
  hrefFor,
  withheld,
  patch,
}: SheetCrawlerProps) {
  // Crawler-economy dialog behind the UPKEEP/UPGRADE/TRADE lozenges (R-4).
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

  // Tech LVL / UPKEEP / UPGRADE-pool / TRADE / CREW lozenges (design §4.4,
  // poster `.lozrow`): upkeep is 5 Scrap of crawler TL per Downtime (rules
  // C3); the Upgrade Pool fills toward 30× TL (rules C4); the Trading Bay
  // sources TL+1 wares (p.223); crew leads = one per installed bay (rules
  // C11). On editable sheets the actionable lozenges (Upkeep/Upgrade/Trade)
  // are the R-4 action entry points (CrawlerEconomyControl); Tech LVL and
  // Crew are read-only readouts.
  const trading = bayGate(crawler, 'Trading Bay')
  const econItems: EconLozItem[] = [
    // Tech LVL is NOT here any more: it is the crawler's own rung, and it
    // reads in the identity beside the crawler type. The economy rail keeps the
    // things you SPEND (upkeep, upgrade pool, trade, crew).
    ...(tl !== undefined
      ? [
          {
            label: 'Upkeep',
            value: 5,
            caption: `Scrap · Tech ${tl}+`,
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
    // its Fund action still collects into the foot row with the others.
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
            label: 'Trade',
            value: tradingSourceTl(tl),
            caption: 'Wares',
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
  //
  // Each docked mech still carries its own pilot when it has one: its Max SP
  // depends on that pilot's abilities (Beefcake, ADR-029), so dropping the
  // pilot here would make this rail read a lower cap than the mech's own sheet.
  // Read through `lookup`, which also holds crewmates' pilots (a Game's crew).
  const dockedMechs = composition.crawlerMechs.map((mech) => {
    const link = storeState.softLinks.find(
      (l) => l.type === 'mech-to-pilot' && l.from.id === mech.id
    )
    return { mech, pilot: link ? lookup.get('pilot', link.to.id) : null }
  })
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
  // My Stuff — and never what is already aboard.
  const self = { type: 'crawler', id: crawler.id } as const
  const container = containerOf(crawler)
  const crewPicker = (
    <AssignPicker
      subject={self}
      container={container}
      pick="pilot"
      exclude={composition.crawlerPilots.map((p) => p.id)}
    />
  )
  const dockPicker = (
    <AssignPicker
      subject={self}
      container={container}
      pick="mech"
      exclude={composition.crawlerMechs.map((m) => m.id)}
    />
  )

  const rail = (
    <>
      {dockedMechs.length > 0 || withheldMechs.length > 0 ? (
        <>
          {dockedMechs.map(({ mech: dockedMech, pilot: dockedPilot }) => (
            <EntityRow
              key={dockedMech.id}
              entityType="mech"
              className="flex-[1_1_0%]"
              name={dockedMech.name}
              sheetHref={hrefFor('mech', dockedMech.id)}
              linkAs={AppLink}
              meta="Docked Mech"
              metaLine={mechStatusPill(dockedMech).label}
              stats={rowStats(
                mechRailItems(dockedMech, pilotingContext(dockedMech, dockedPilot?.abilities))
              )}
              onUnassignClick={unassignFrom('mech-to-crawler', dockedMech.id)}
            />
          ))}
          {withheldMechs.map((unit) => (
            <WithheldUnitRow key={unit.key} unit={unit} label="Docked Mech" />
          ))}
          {/* The bay takes more than one, so the way to dock the next has to
              survive the first — the same trailing slot the crew list uses. */}
          {editable && (
            <EntityRow
              empty
              entityType="mech"
              className="flex-[1_1_0%]"
              roleLabel="Bay"
              message="Dock another mech."
              actions={
                <>
                  {dockPicker}
                  <RailCta href="/mechs/new" label="+ Create" />
                </>
              }
            />
          )}
        </>
      ) : (
        <EntityRow
          empty
          entityType="mech"
          className="flex-[1_1_0%]"
          roleLabel="Docked Mechs"
          /* Says how a mech actually gets here: by its own assignment to this
             crawler (ADR-037), not by its pilot joining the crew. */
          message="No mechs in the bay. Dock a mech here — it is assigned on its own, separately from its pilot."
          actions={
            editable ? (
              <>
                {dockPicker}
                <RailCta href="/mechs/new" label="+ Create" primary />
              </>
            ) : undefined
          }
        />
      )}
      {composition.crawlerPilots.length > 0 || withheldPilots.length > 0 ? (
        <>
          {composition.crawlerPilots.map((crewPilot) => (
            <EntityRow
              key={crewPilot.id}
              entityType="pilot"
              className="flex-[1_1_0%]"
              name={crewPilot.name}
              sheetHref={hrefFor('pilot', crewPilot.id)}
              linkAs={AppLink}
              meta="Pilot"
              stats={rowStats(
                pilotRailItems(crewPilot, resolveEffectiveCrawlerLevel(crewPilot, crawler))
              )}
              onUnassignClick={unassignFrom('pilot-to-crawler', crewPilot.id)}
            />
          ))}
          {withheldPilots.map((unit) => (
            <WithheldUnitRow key={unit.key} unit={unit} label="Pilot" />
          ))}
          {/* A crew of one is not a full crew, so the way to add the second has
              to survive the first. Rendered as the same `empty` EntityRow the
              no-pilots branch uses rather than a bare button, so it inherits the
              rail's sizing instead of introducing a second layout to keep in
              step. */}
          {editable && (
            <EntityRow
              empty
              entityType="pilot"
              className="flex-[1_1_0%]"
              roleLabel="Crew"
              message="Bring another pilot aboard."
              actions={
                <>
                  {crewPicker}
                  <RailCta href="/pilots/new" label="+ Create" />
                </>
              }
            />
          )}
        </>
      ) : (
        <EntityRow
          empty
          entityType="pilot"
          className="flex-[1_1_0%]"
          roleLabel="Pilots"
          message="No pilots wired to this crawler yet."
          /* Both verbs, because they answer different questions. `+ Create` was
             the only one here, which quietly assumed the pilot you wanted did
             not exist yet — at a table, they almost always already do. */
          actions={
            editable ? (
              <>
                {crewPicker}
                <RailCta href="/pilots/new" label="+ Create" primary />
              </>
            ) : undefined
          }
        />
      )}
    </>
  )

  // Economy band (poster `.econ`: SP `VitalGauge` over the Tech-LVL/Upkeep/
  // Upgrade/Trade/Crew lozenges) — built here because it needs `patch` +
  // the econDialog state, which CrawlerSheet does not own; handed down as
  // `economy` and rendered inside the body's Identity card.
  const economy = (
    <CrawlerEconFrame
      gauge={
        <VitalGauge
          label="SP"
          subLabel="Structure"
          value={sp}
          max={maxSP}
          onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
          onMaxChange={
            editable
              ? (next) => overrideCrawlerMax({ maxSpOverride: pinFor(next, spParts) })
              : undefined
          }
          breakdown={editable ? spParts : undefined}
          provenance={spLines}
          onRevertOverride={
            editable ? () => overrideCrawlerMax({ maxSpOverride: undefined }) : undefined
          }
          readOnly={!editable}
        />
      }
      upgrade={
        <VitalGauge
          label="Upgrade"
          subLabel="Pool"
          value={crawler.upgradePool ?? 0}
          max={UPGRADE_POOL_MAX}
          onChange={editable ? (v) => patch({ upgradePool: v }) : undefined}
          readOnly={!editable}
        />
      }
      items={econItems}
    />
  )

  return (
    <>
      <LiveSheet
        variant="crawler"
        name={crawler.name}
        strip={strip}
        back={back}
        segments={segments}
        actions={actions}
        renderBody={() => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            store={store}
            readOnly={readOnly}
            economy={economy}
            linkedUnits={rail}
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
