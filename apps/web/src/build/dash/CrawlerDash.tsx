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
import type { OpenColumn, OpenRow, PhoneVital } from '../../components/index'
import {
  Button,
  Content,
  damagedEffectOf,
  EntityChoices,
  EntityRollMini,
  embeddedPeekAddress,
  Facts,
  HeaderMenu,
  Mention,
  OpenLedger,
  Prose,
  SlabSection,
  STRIP_ART,
  Stat,
  Strip,
  StripFigure,
  TechLevel,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import {
  resolveCrawlerBay,
  resolveCrawlerType,
  resolveCrawlerTypeAbilities,
} from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { assignmentFor } from '../../lib/npcs/npcModel'
import { crawlerTypeArt } from '../../lib/photos/defaultArt'
import { BAY_REPAIR_COST, resolveCrawlerSystem } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { CrawlerCrewLead } from '../sheet/CrawlerCrewLead'
import { CrawlerIdentityFields } from '../sheet/CrawlerIdentity'
import type { CrawlerBayEntry } from '../sheet/CrawlerSheetItems'
import { splitBayContent } from '../sheet/CrawlerSheetItems'
import { LinkedUnitLink } from '../sheet/LinkedUnitLink'
import { ConditionStep, SheetRemoveButton } from '../sheet/rowControls'
import type { SheetPatch } from '../sheet/sheetViewProps.model'
import { TypeCrewLead } from '../sheet/TypeCrewLead'
import { LeadCell } from './bayLead'
import { leadOf } from './bayLead.model'
import { Dash, DashColumn, DashGroup } from './Dash'
import { StorageBay } from './StorageBay'

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
  edit,
  assigned,
  dockedMech,
  contents,
}: {
  crawler: Crawler
  entry: CrawlerBayEntry
  index: number
  store: UnitsStore
  liveCondition: boolean
  /** Edit: its choices pick and its crew lead's fields write. */
  edit: boolean
  assigned: CrewAssignment | undefined
  dockedMech?: { name: string; href: string | undefined } | undefined
  contents?: ReactNode
}) {
  const storeState = store()
  const { selections, setSelections } = useEntityChoices(
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
  const patchEntry = (patch: Partial<CrawlerBayEntry>) =>
    runWrite(() =>
      storeState.updateCrawlerBay(crawler.id, entry.bayRef, patch, index, LIVE_SHEET_MANUAL)
    )
  return (
    <div className="su-bay-detail">
      <div className="su-bay-detail__part">
        <SlabSection title={buildSheetCopy('bayRules')} size="mini" as="h4">
          <div className="su-dash-prose">
            <Content body={normal as ComponentProps<typeof Content>['body']} fontSize="sm" />
          </div>
        </SlabSection>
        <EntityChoices
          entity={bay}
          selections={selections}
          onSelectionChange={edit ? setSelections : undefined}
          techLevel={crawler.techLevel}
        />
        <EntityRollMini entity={bay} disabled={damaged} />
        {contents}
      </div>
      <div className="su-bay-detail__part">
        {damagedText && (
          <SlabSection title={buildSheetCopy('ifDamaged')} size="mini" as="h4">
            <p className="su-dash-prose">{damagedText}</p>
          </SlabSection>
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
        {edit ? (
          // Edit writes the crew lead's fields in place.
          <CrawlerCrewLead
            npc={bay.npc}
            slot={{ schemaName: 'crawler-bays', id: bay.id, name: bay.name }}
            state={entry}
            selections={selections}
            setSelections={setSelections}
            onPatch={patchEntry}
            assigned={assigned}
          />
        ) : (
          (entry.npcDescription?.trim() || (entry.npcFacts ?? []).length > 0) && (
            <SlabSection
              title={buildSheetCopy('crewLeadColumn')}
              size="mini"
              as="h4"
              aria-label={buildSheetCopy('crewLead', { bayName: bay.name })}
            >
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
            </SlabSection>
          )
        )}
        {/* A bay's condition is session state: it writes in Read (R11); in
            Edit its stepper is on its row. */}
        {liveCondition && !edit && (
          <div>
            <Button
              size="mini"
              onClick={() => patchEntry({ condition: damaged ? 'intact' : 'damaged' })}
            >
              {buildSheetCopy(damaged ? 'markIntact' : 'markDamaged')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

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
      <OpenLedger
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

  const bayRows: OpenRow[] = bays.map((entry, index) => {
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
      state:
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
      <Dash>
        <DashColumn wide label={buildSheetCopy('bays')}>
          <OpenLedger
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
          {linkedUnits}
        </DashColumn>
        <DashColumn label={buildSheetCopy('whatCarries', { name: crawler.name })}>
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
              {edit && crawler.type && (
                <TypeCrewLead
                  crawler={crawler}
                  typeRef={crawler.type}
                  store={store}
                  assigned={assignmentFor(crew, { kind: 'type' })}
                />
              )}
              {!edit && typeLead && (typeLead.name || typeLead.position) && (
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

/** The Armament Bay's own weapon choice holds a pick. */
function armamentPicked(crawler: Crawler): boolean {
  return Object.values(crawler.bayChoices?.['armament-bay'] ?? {}).some(
    (picks) => Array.isArray(picks) && picks.length > 0
  )
}

/**
 * A bay's Edit controls on its row (C8): its condition (a bay is Intact or
 * Damaged, never Destroyed), Repair while Damaged (5 Scrap of the crawler's
 * Tech Level or higher; a short pool is said, never a block), and remove
 * for an expansion bay.
 */
function BayControls({
  crawlerId,
  entry,
  index,
  name,
  tl,
  store,
  edit,
}: {
  crawlerId: string
  entry: CrawlerBayEntry
  index: number
  name: string
  tl: number
  store: UnitsStore
  edit: CrawlerDashEdit
}) {
  const storeState = store()
  const condition = entry.condition ?? 'intact'
  const damaged = condition === 'damaged'
  return (
    <>
      <ConditionStep
        name={name}
        condition={condition}
        next={damaged ? 'intact' : 'damaged'}
        onCycle={() =>
          runWrite(() =>
            storeState.updateCrawlerBay(
              crawlerId,
              entry.bayRef,
              { condition: damaged ? 'intact' : 'damaged' },
              index,
              LIVE_SHEET_MANUAL
            )
          )
        }
      />
      {damaged && (
        <Button
          size="mini"
          variant="ink"
          title={
            edit.repairShortfall > 0
              ? buildSheetCopy('costsScrapTechOrHigher', {
                  bayRepairCost: BAY_REPAIR_COST,
                  crawlerTl: tl,
                  repairShortfall: edit.repairShortfall,
                })
              : buildSheetCopy('costsScrapTechOrHigher2', {
                  bayRepairCost: BAY_REPAIR_COST,
                  crawlerTl: tl,
                })
          }
          onClick={() => edit.repairBay(entry, index)}
        >
          {buildSheetCopy('repair')}
        </Button>
      )}
      {edit.removable.has(entry.bayRef) && (
        <SheetRemoveButton name={name} onRemove={() => edit.removeBay(index)} />
      )}
    </>
  )
}
