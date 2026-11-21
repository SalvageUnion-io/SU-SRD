/**
 * CrawlerDash — A Union Crawler's Read
 * sheet as a dashboard, in the printed sheet's order.
 *
 *   The strip: the art, SP and the Upgrade Pool live, then Tech Level,
 *     Upkeep and the bays still Intact; Pay Upkeep, Fund and Trade on its foot.
 *   The bays: ONE crew manifest, a line a bay in the sheet's own order: who
 *     leads it, their Keepsake and Motto, their HP, and a stamp only where
 *     the bay is Damaged. A line opens the bay's rules, what it does when
 *     damaged, its choices and its crew lead in full.
 *   The Storage Bay: one flat ledger, not a box in a box. Scrap by Tech
 *     Level as six cells on the colour map, then what is stored, a line a
 *     lot. Its condition and its crew lead are its line in the manifest, as
 *     every bay's are.
 *   Then the weapons, the crawler's type (its ability and its crew) and
 *     what was written about it.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { ComponentProps, ReactNode } from 'react'
import { STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
import { EntityChoices, Facts, Prose, STRIP_ART, Strip, StripFigure } from '../../components/app'
import type { CSSVarStyle, OpenColumn, OpenRow, PhoneVital } from '../../components/index'
import {
  Button,
  Content,
  capsLabel,
  damagedEffectOf,
  EntityRollMini,
  embeddedPeekAddress,
  Mention,
  OpenLedger,
  Stat,
  TechLevel,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { cn } from '../../lib/cn'
import {
  resolveCrawlerBay,
  resolveCrawlerType,
  resolveCrawlerTypeAbilities,
} from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { assignmentFor } from '../../lib/npcs/npcModel'
import { crawlerTypeArt } from '../../lib/photos/defaultArt'
import { resolveCrawlerSystem } from '../../lib/rules/crawlerItems'
import { EXOTIC_RESOURCES, exoticBucket, hasExotic } from '../../lib/rules/exoticSalvage'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import type { CrawlerBayEntry } from '../sheet/CrawlerSheetItems'
import { splitBayContent } from '../sheet/CrawlerSheetItems'
import { EXOTIC_NAME } from '../sheet/exoticNames.model'
import { LinkedUnitLink } from '../sheet/LinkedUnitLink'
import { LeadCell } from './bayLead'
import { leadOf } from './bayLead.model'
import { Dash, DashColumn, DashGroup, PinnedVitals } from './Dash'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

const BAY_COLUMNS: readonly OpenColumn[] = [
  { key: 'lead', label: buildSheetCopy('crewLeadColumn'), kind: 'text', phone: true },
  { key: 'keepsake', label: buildSheetCopy('keepsake'), kind: 'text' },
  { key: 'motto', label: buildSheetCopy('motto'), kind: 'text' },
  { key: 'hp', label: buildSheetCopy('hp'), phone: true },
]

const WEAPON_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'range', label: buildSheetCopy('rng'), title: buildSheetCopy('range'), phone: true },
  { key: 'damage', label: buildSheetCopy('dmg'), title: buildSheetCopy('damage'), phone: true },
]

const STORED_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'units', label: buildSheetCopy('units'), phone: true },
]

const TYPE_COLUMNS: readonly OpenColumn[] = [
  { key: 'hp', label: buildSheetCopy('hp'), phone: true },
]

/** A bay's line opened: its rules, what a Damaged bay does, its choices and its crew lead. */
function BayDetail({
  crawler,
  entry,
  index,
  store,
  liveCondition,
  dockedMech,
  contents,
}: {
  crawler: Crawler
  entry: CrawlerBayEntry
  index: number
  store: UnitsStore
  liveCondition: boolean
  assigned: CrewAssignment | undefined
  dockedMech?: { name: string; href: string | undefined } | undefined
  contents?: ReactNode
}) {
  const storeState = store()
  const { selections } = useEntityChoices(
    'crawler',
    crawler.id,
    entry.bayRef,
    'bayChoices',
    crawler.bayChoices?.[entry.bayRef],
    store
  )
  const bay = resolveCrawlerBay(entry.bayRef)
  if (!bay) return null
  const damaged = (entry.condition ?? 'intact') === 'damaged'
  const { normal } = splitBayContent(bay.content)
  const damagedText = damagedEffectOf(bay) ?? ''
  return (
    <div className="su-bay-detail">
      <div className="su-bay-detail__part">
        <p className={cn('su-dash-sub', CAPS, CAPS)}>{buildSheetCopy('bayRules')}</p>
        <div className="su-dash-prose">
          <Content body={normal as ComponentProps<typeof Content>['body']} fontSize="sm" />
        </div>
        <EntityChoices
          entity={bay}
          selections={selections}
          onSelectionChange={undefined}
          techLevel={crawler.techLevel}
        />
        <EntityRollMini entity={bay} disabled={damaged} />
        {contents}
      </div>
      <div className="su-bay-detail__part">
        {damagedText && (
          <>
            <p className={cn('su-dash-sub', CAPS, CAPS)}>{buildSheetCopy('ifDamaged')}</p>
            <p className="su-dash-prose">{damagedText}</p>
          </>
        )}
        {dockedMech && (
          <p className="su-dash-prose">
            {buildSheetCopy('docks')}{' '}
            <LinkedUnitLink kind="mech" name={dockedMech.name} href={dockedMech.href} />
          </p>
        )}
        {/* The crew lead prints once, on the bay's own
            line (name, Keepsake, Motto, HP); opened, the line adds what the
            table wrote about them, which the line has no room for. */}
        {(entry.npcDescription?.trim() || (entry.npcFacts ?? []).length > 0) && (
          <section aria-label={buildSheetCopy('crewLead', { bayName: bay.name })}>
            <p className={cn('su-dash-sub', CAPS, CAPS)}>{buildSheetCopy('crewLeadColumn')}</p>
            {entry.npcDescription?.trim() && (
              <p className="su-dash-prose">{entry.npcDescription}</p>
            )}
            {(entry.npcFacts ?? []).length > 0 && (
              <ul className="su-dash-prose">
                {(entry.npcFacts ?? []).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            )}
          </section>
        )}
        {/* A bay's condition is session state: it writes in Read (R11). */}
        {liveCondition && (
          <div>
            <Button
              size="mini"
              onClick={() =>
                runWrite(() =>
                  storeState.updateCrawlerBay(
                    crawler.id,
                    entry.bayRef,
                    { condition: damaged ? 'intact' : 'damaged' },
                    index,
                    LIVE_SHEET_MANUAL
                  )
                )
              }
            >
              {buildSheetCopy(damaged ? 'markIntact' : 'markDamaged')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

type CrawlerDashProps = {
  crawler: Crawler
  mech: Mech | null
  mechHref?: string | undefined
  store: UnitsStore
  cargo: UseCargoResult
  /** The viewer may write session state (SP, the pool, a bay's condition) in Read. */
  liveCondition: boolean
  /** SP, the Upgrade Pool and Upkeep as rows (`CrawlerLiveSheet`). */
  vitals: readonly PhoneVital[]
  /** Pay Upkeep, Fund, Trade: the economy's dialogs. */
  vitalActions: readonly { key: string; label: string; onClick: () => void }[]
  linkedUnits?: ReactNode
  crew?: readonly CrewAssignment[] | undefined
  /** A phone: the vitals pinned, the groups stacked. */
  phone: boolean
}

export function CrawlerDash({
  crawler,
  mech,
  mechHref,
  store,
  cargo,
  liveCondition,
  vitals,
  vitalActions,
  linkedUnits,
  crew,
  phone,
}: CrawlerDashProps) {
  const tl = crawler.techLevel
  const bays = crawler.crawlerBays ?? []
  const intact = bays.filter((bay) => (bay.condition ?? 'intact') === 'intact').length
  const pool = crawler.scrapPool ?? {}
  const lots = cargo.state.depotLots
  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  const abilities = resolveCrawlerTypeAbilities(crawler.type)
  const gauges = vitals.filter((vital) => vital.max !== undefined)
  const upkeep = vitals.find((vital) => vital.key === 'upkeep')

  const weapons: OpenRow[] = crawler.systems.map((slug) => {
    const system = resolveCrawlerSystem(slug)
    const model = system ? toEntityModel(system) : undefined
    const short = (key: string) => {
      const found = model?.facts.find((fact) => fact.key === key)
      return found ? (found.shortValue ?? found.value) : ''
    }
    return {
      id: slug,
      name: model?.title ?? slug,
      entityRef: model?.ref,
      // Traits are the open row's, not the line's.
      cells: [
        model?.techLevel !== undefined ? <TechLevel key="tl" level={model.techLevel} /> : '',
        short('range'),
        short('damage'),
      ],
    }
  })
  const weaponsLedger =
    weapons.length > 0 ? (
      <OpenLedger
        title={buildSheetCopy('weapons')}
        columns={WEAPON_COLUMNS}
        groups={[{ key: 'weapons', rows: weapons }]}
      />
    ) : null

  const bayRows: OpenRow[] = bays.map((entry, index) => {
    const bay = resolveCrawlerBay(entry.bayRef)
    // Only a bay's first slot is crewed by a built NPC (D8).
    const first = bays.findIndex((other) => other.bayRef === entry.bayRef) === index
    const assigned = first ? assignmentFor(crew, { kind: 'bay', bayRef: entry.bayRef }) : undefined
    const lead = leadOf(bay?.npc, entry, crawler.bayChoices?.[entry.bayRef], assigned)
    const damaged = (entry.condition ?? 'intact') === 'damaged'
    return {
      id: `${entry.bayRef}-${index}`,
      name: bay?.name ?? entry.bayRef,
      entityRef: bay ? toEntityModel({ ...bay, npc: undefined }).ref : undefined,
      state: damaged ? (
        <Stat size="mini" label={buildSheetCopy('damaged')} state="critical" />
      ) : undefined,
      cells: [
        lead.name || lead.position ? (
          <LeadCell
            key="lead"
            lead={lead}
            peekAt={bay?.npc ? embeddedPeekAddress('crawler-bays', bay.id, 'npc') : undefined}
          />
        ) : (
          ''
        ),
        lead.keepsake,
        lead.motto,
        lead.hp,
      ],
      ...(bay
        ? {
            detailLabel: buildSheetCopy('bayRulesOf', { name: bay.name }),
            detail: (
              <BayDetail
                crawler={crawler}
                entry={entry}
                index={index}
                store={store}
                liveCondition={liveCondition}
                assigned={assigned}
                dockedMech={
                  entry.bayRef === 'mech-bay' && mech
                    ? { name: mech.name, href: mechHref }
                    : undefined
                }
              />
            ),
          }
        : {}),
    }
  })

  const typeLead = type
    ? leadOf(
        type.npc,
        crawler.typeNpc,
        crawler.type ? crawler.bayChoices?.[crawler.type] : undefined,
        assignmentFor(crew, { kind: 'type' })
      )
    : undefined

  const figures = (
    <>
      <StripFigure
        label={buildSheetCopy('tl')}
        name={buildSheetCopy('techLevel')}
        value={tl}
        meter="bar"
        tint={{ tl }}
      />
      {upkeep && (
        <StripFigure
          label={STAT_LABELS.upkeepCost.short}
          name={buildSheetCopy('tScrapEachDowntime', { tl })}
          value={upkeep.value}
          unit={buildSheetCopy('tScrap', { tl })}
        />
      )}
      {bays.length > 0 && (
        <StripFigure
          label={buildSheetCopy('bays')}
          name={`${buildSheetCopy('bays')}: ${intact}/${bays.length} ${buildSheetCopy('intact')}`}
          value={intact}
          max={bays.length}
          meter="pips"
          tint="ink"
        />
      )}
    </>
  )
  const actionsFoot = (size: 'compact' | 'full') =>
    vitalActions.length > 0
      ? vitalActions.map((action) => (
          <Button key={action.key} variant="default" size={size} onClick={action.onClick}>
            {action.label}
          </Button>
        ))
      : undefined
  const art = (
    <EntityPhoto
      photo={crawler.photo}
      fallback={crawlerTypeArt(crawler.type)}
      name={crawler.name}
      frame={STRIP_ART}
    />
  )
  return (
    <>
      {phone && (
        <PinnedVitals
          label={buildSheetCopy('unitVitals', { name: crawler.name })}
          name={crawler.name}
          vitals={vitals}
          foot={actionsFoot('full')}
        />
      )}
      <Strip
        label={buildSheetCopy('unitVitals', { name: crawler.name })}
        art={phone ? undefined : art}
        vitals={phone ? [] : gauges}
        figures={figures}
        foot={phone ? undefined : actionsFoot('compact')}
        identity={
          // On a page what was written about the crawler sits beside its numbers.
          crawler.description ? (
            <Facts
              facts={[
                {
                  key: 'about',
                  label: buildSheetCopy('about'),
                  value: <Prose text={crawler.description} lines={phone ? 3 : 5} />,
                  wide: true,
                },
              ]}
            />
          ) : undefined
        }
      />
      <Dash>
        <DashColumn wide label={buildSheetCopy('bays')}>
          <OpenLedger
            as="h2"
            title={buildSheetCopy('bays')}
            tally={{ label: buildSheetCopy('intact'), value: intact, max: bays.length }}
            columns={BAY_COLUMNS}
            groups={[{ key: 'bays', rows: bayRows }]}
            className="su-open--manifest"
          />
          {linkedUnits}
        </DashColumn>
        <DashColumn label={buildSheetCopy('whatCarries', { name: crawler.name })}>
          {/* The Storage Bay as one deliberate object:
              "Unlimited" on its head, Scrap as a six-cell board (a Tech Level
              chip over its count), then what is stored as its rows. */}
          <DashGroup title={buildSheetCopy('storageBay')} tally={buildSheetCopy('unlimited')}>
            <p className={cn('su-dash-sub su-scrap__label', CAPS)}>{buildSheetCopy('scrap')}</p>
            <Facts
              className="su-scrap"
              itemClassName="su-scrap__cell"
              label={buildSheetCopy('scrapByTechLevel')}
              facts={NUMERIC_TECH_LEVELS.map((level) => {
                const count = scrapPoolBucket(pool, level)
                return {
                  key: String(level),
                  label: <TechLevel level={level} />,
                  value: count,
                  empty: count === 0,
                  style: { '--tl': `var(--color-tl-${level})` } as CSSVarStyle,
                }
              })}
            />
            {hasExotic(pool) && (
              <Facts
                facts={EXOTIC_RESOURCES.map((resource) => ({
                  key: resource.key,
                  label: EXOTIC_NAME[resource.key],
                  value: exoticBucket(pool, resource.key),
                }))}
              />
            )}
            <OpenLedger
              as="h3"
              title={buildSheetCopy('stored')}
              columns={STORED_COLUMNS}
              groups={[
                {
                  key: 'lots',
                  rows: lots.map((lot) => ({
                    id: lot.id,
                    name: lot.name,
                    meta: lot.cat === 'SCRAP' ? undefined : lot.cat,
                    cells: [
                      lot.tl !== undefined ? <TechLevel key="tl" level={lot.tl} /> : '',
                      lot.units,
                    ],
                  })),
                },
              ]}
              empty={buildSheetCopy('nothingStored')}
              className="su-open--sub"
            />
          </DashGroup>
          {weaponsLedger}
          {type && (
            <DashGroup title={buildSheetCopy('crawlerType', { type: type.name })}>
              {abilities.map((ability) => {
                const model = toEntityModel(ability)
                return (
                  <div key={ability.id} className="su-dash-item">
                    <p className="su-dash-entity__name">
                      <Mention entityRef={model.ref}>{model.title}</Mention>
                    </p>
                    {/* An ability is text, every word showing. */}
                    <Content
                      body={(ability.content ?? []) as ComponentProps<typeof Content>['body']}
                      fontSize="sm"
                    />
                  </div>
                )
              })}
              {typeLead && (typeLead.name || typeLead.position) && (
                <OpenLedger
                  as="h3"
                  title={buildSheetCopy('typeCrew')}
                  columns={TYPE_COLUMNS}
                  groups={[
                    {
                      key: 'type',
                      rows: [
                        {
                          id: 'type-lead',
                          name: <LeadCell lead={typeLead} />,
                          cells: [typeLead.hp],
                          under:
                            typeLead.keepsake || typeLead.motto ? (
                              <p className="su-open__clamp">
                                {[
                                  typeLead.keepsake &&
                                    `${buildSheetCopy('keepsake')}: ${typeLead.keepsake}`,
                                  typeLead.motto && `${buildSheetCopy('motto')}: ${typeLead.motto}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : undefined,
                        },
                      ],
                    },
                  ]}
                  className="su-open--sub"
                />
              )}
            </DashGroup>
          )}
        </DashColumn>
      </Dash>
    </>
  )
}
