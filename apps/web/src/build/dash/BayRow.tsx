/**
 * A crawler bay's line on the dashboard: its opened detail (`BayDetail`) and
 * its Edit controls on the row (`BayControls`).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { ComponentProps, ReactNode } from 'react'
import {
  Button,
  Content,
  damagedEffectOf,
  EntityChoices,
  EntityRollMini,
  SlabSection,
} from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { BAY_REPAIR_COST } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { CrawlerCrewLead } from '../sheet/CrawlerCrewLead'
import type { CrawlerBayEntry } from '../sheet/CrawlerSheetItems'
import { splitBayContent } from '../sheet/CrawlerSheetItems'
import { LinkedUnitLink } from '../sheet/LinkedUnitLink'
import { ConditionStep, SheetRemoveButton } from '../sheet/rowControls'
import type { CrawlerDashEdit } from './CrawlerDash'

/** A bay's line opened: its rules, what a Damaged bay does, its choices and its crew lead. */
export function BayDetail({
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

/**
 * A bay's Edit controls on its row (C8): its condition (a bay is Intact or
 * Damaged, never Destroyed), Repair while Damaged (5 Scrap of the crawler's
 * Tech Level or higher; a short pool is said, never a block), and remove
 * for an expansion bay.
 */
export function BayControls({
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
