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
 *
 * Edit is the same dashboard with its controls in place (R11): the identity's
 * fields under the board, the photo, SP's max, each bay's condition, Repair
 * and remove on its row, its choices and crew lead's fields in its
 * opened line, + Bay and Crew on the manifest's head, the pool's steppers and
 * the hold's moves and intake, the weapons' Mount and remove, and the type's
 * crew lead's fields.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { ComponentProps, ReactNode } from 'react'
import { STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { Facts, Prose, STRIP_ART, Strip, StripFigure } from '../../components/app'
import type { LedgerColumn, LedgerRow, PhoneVital } from '../../components/index'
import {
  Button,
  Content,
  embeddedPeekAddress,
  HeaderMenu,
  Ledger,
  Mention,
  Stat,
  TechLevel,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import {
  resolveCrawlerBay,
  resolveCrawlerType,
  resolveCrawlerTypeAbilities,
} from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { assignmentFor } from '../../lib/npcs/npcModel'
import { crawlerTypeArt } from '../../lib/photos/defaultArt'
import { upkeepOwed } from '../../lib/rules/crawlerEconomy'
import { resolveCrawlerSystem } from '../../lib/rules/crawlerItems'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { CrawlerIdentityFields } from '../sheet/CrawlerIdentity'
import type { CrawlerBayEntry } from '../sheet/CrawlerSheetItems'
import { SheetRemoveButton } from '../sheet/rowControls'
import type { SheetPatch } from '../sheet/sheetViewProps.model'
import { TypeCrewLead } from '../sheet/TypeCrewLead'
import { BayControls, BayDetail } from './BayRow'
import { LeadCell } from './bayLead'
import { leadOf } from './bayLead.model'
import { Dash, DashColumn, DashGroup } from './Dash'
import { StorageBay } from './StorageBay'

const BAY_COLUMNS: readonly LedgerColumn[] = [
  { key: 'lead', label: buildSheetCopy('crewLeadColumn'), kind: 'text', phone: true },
  { key: 'keepsake', label: buildSheetCopy('keepsake'), kind: 'text' },
  { key: 'motto', label: buildSheetCopy('motto'), kind: 'text' },
  { key: 'hp', label: buildSheetCopy('hp'), phone: true },
]

const WEAPON_COLUMNS: readonly LedgerColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'range', label: buildSheetCopy('rng'), title: buildSheetCopy('range'), phone: true },
  { key: 'damage', label: buildSheetCopy('dmg'), title: buildSheetCopy('damage'), phone: true },
]

const TYPE_COLUMNS: readonly LedgerColumn[] = [
  { key: 'hp', label: buildSheetCopy('hp'), phone: true },
]

/** Edit's writes, from `CrawlerSheet`; absent, the dashboard reads. */
export type CrawlerDashEdit = {
  patch: SheetPatch
  /** Repair a damaged bay from the pool (`bayRepairPatch`). */
  repairBay: (entry: CrawlerBayEntry, index: number) => void
  /** Scrap the pool is short of a repair: advisory, said on Repair. */
  repairShortfall: number
  /** The expansion bays it may add, and which installed ones it may remove. */
  installable: readonly { slug: string; name: string }[]
  addBay: (slug: string) => void
  removable: ReadonlySet<string>
  removeBay: (index: number) => void
  removeWeapon: (slug: string) => void
  /** Opens the weapons picker: the Armament Bay's Mount. */
  mountWeapons: () => void
  /** The crew board for this crawler (D8). */
  crewHref?: string | undefined
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
  /** Edit: the same dashboard with its controls in place. */
  edit?: CrawlerDashEdit | undefined
  /** A phone: the groups stacked. */
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
  edit,
  phone,
}: CrawlerDashProps) {
  const editing = edit !== undefined
  const tl = crawler.techLevel
  const bays = crawler.crawlerBays ?? []
  const type = crawler.type ? resolveCrawlerType(crawler.type) : null
  const abilities = resolveCrawlerTypeAbilities(crawler.type)
  const gauges = vitals.filter((vital) => vital.max !== undefined)
  const upkeep = vitals.find((vital) => vital.key === 'upkeep')

  const weapons: LedgerRow[] = crawler.systems.map((slug) => {
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
      controls: edit ? (
        <SheetRemoveButton name={model?.title ?? slug} onRemove={() => edit.removeWeapon(slug)} />
      ) : undefined,
      // Traits are the open row's, not the line's.
      cells: [
        model?.techLevel !== undefined ? <TechLevel key="tl" level={model.techLevel} /> : '',
        short('range'),
        short('damage'),
      ],
    }
  })
  const weaponsLedger =
    weapons.length > 0 || edit ? (
      <Ledger
        open
        title={buildSheetCopy('weapons')}
        columns={WEAPON_COLUMNS}
        groups={[{ key: 'weapons', rows: weapons }]}
        actions={
          edit ? (
            <Button size="compact" onClick={edit.mountWeapons}>
              {buildSheetCopy('mount')}
            </Button>
          ) : undefined
        }
        // A weapon picked on the Armament Bay's own choice is mounted.
        empty={armamentPicked(crawler) ? undefined : buildSheetCopy('noWeaponsMounted')}
      />
    ) : null

  const bayRows: LedgerRow[] = bays.map((entry, index) => {
    const bay = resolveCrawlerBay(entry.bayRef)
    // Only a bay's first slot is crewed by a built NPC (D8).
    const first = bays.findIndex((other) => other.bayRef === entry.bayRef) === index
    const assigned = first ? assignmentFor(crew, { kind: 'bay', bayRef: entry.bayRef }) : undefined
    const lead = leadOf(bay?.npc, entry, crawler.bayChoices?.[entry.bayRef], assigned)
    const damaged = (entry.condition ?? 'intact') === 'damaged'
    const name = bay?.name ?? entry.bayRef
    return {
      id: `${entry.bayRef}-${index}`,
      name,
      entityRef: bay ? toEntityModel({ ...bay, npc: undefined }).ref : undefined,
      stamp:
        damaged && !edit ? (
          <Stat size="mini" label={buildSheetCopy('damaged')} state="critical" />
        ) : undefined,
      controls: edit ? (
        <BayControls
          crawlerId={crawler.id}
          entry={entry}
          index={index}
          name={name}
          tl={tl}
          store={store}
          edit={edit}
        />
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
                edit={editing}
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

  const owed = upkeepOwed(tl, crawler.type)
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
          // The row's note carries the working where the type takes some off (r4 A8).
          name={upkeep.note ?? buildSheetCopy('tScrapEachDowntime', { tl })}
          value={upkeep.value}
          unit={
            owed.less > 0
              ? `${buildSheetCopy('tScrap', { tl })} ${buildSheetCopy('upkeepWorking', owed)}`
              : buildSheetCopy('tScrap', { tl })
          }
        />
      )}
    </>
  )
  const actionsFoot =
    vitalActions.length > 0
      ? vitalActions.map((action) => (
          <Button key={action.key} size="compact" onClick={action.onClick}>
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
      onChange={
        edit
          ? (photo) => store.getState().update('crawler', crawler.id, { photo }, LIVE_SHEET_MANUAL)
          : undefined
      }
    />
  )
  return (
    <>
      <Strip
        label={buildSheetCopy('unitVitals', { name: crawler.name })}
        art={phone && !edit ? undefined : art}
        vitals={gauges}
        figures={figures}
        foot={actionsFoot}
        edit={editing}
        identity={
          edit ? (
            <CrawlerIdentityFields
              crawler={crawler}
              storeState={store.getState()}
              patch={edit.patch}
            />
          ) : // On a page what was written about the crawler sits beside its numbers.
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
      {phone && linkedUnits}
      <Dash>
        <DashColumn wide label={buildSheetCopy('bays')}>
          <Ledger
            open
            as="h2"
            title={buildSheetCopy('bays')}
            columns={BAY_COLUMNS}
            groups={[{ key: 'bays', rows: bayRows }]}
            className="su-open--manifest"
            actions={
              edit && (edit.installable.length > 0 || edit.crewHref !== undefined) ? (
                <>
                  {edit.installable.length > 0 && (
                    // + Bay: a menu of the bays it can add, Crew beside it.
                    <HeaderMenu
                      variant="button"
                      size="compact"
                      trigger={buildSheetCopy('addBay')}
                      label={buildSheetCopy('addAnExpansionBay')}
                      sections={[
                        edit.installable.map((b) => ({
                          id: b.slug,
                          label: b.name,
                          onSelect: () => edit.addBay(b.slug),
                        })),
                      ]}
                    />
                  )}
                  {edit.crewHref !== undefined && (
                    <Button
                      href={edit.crewHref}
                      size="compact"
                      aria-label={buildSheetCopy('crewDesignAndAssignCrawler', {
                        name: crawler.name,
                      })}
                    >
                      {buildSheetCopy('crew')}
                    </Button>
                  )}
                </>
              ) : undefined
            }
          />
        </DashColumn>
        <DashColumn label={buildSheetCopy('whatCarries', { name: crawler.name })}>
          {!phone && linkedUnits}
          <StorageBay crawler={crawler} mech={mech} cargo={cargo} store={store} edit={editing} />
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
              {/* The type's crew lead is a section of its own: the abilities' Mentions are no strip of theirs (C8). */}
              {edit && crawler.type && (
                <section className="su-dash-item" aria-label={buildSheetCopy('typeCrew')}>
                  <TypeCrewLead
                    crawler={crawler}
                    typeRef={crawler.type}
                    store={store}
                    assigned={assignmentFor(crew, { kind: 'type' })}
                  />
                </section>
              )}
              {!edit && typeLead && (typeLead.name || typeLead.position) && (
                <Ledger
                  open
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

/** The Armament Bay's own weapon choice holds a pick. */
function armamentPicked(crawler: Crawler): boolean {
  return Object.values(crawler.bayChoices?.['armament-bay'] ?? {}).some(
    (picks) => Array.isArray(picks) && picks.length > 0
  )
}
