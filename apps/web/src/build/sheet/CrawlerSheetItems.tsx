import type { UnitsStore } from '../../replica/units'
/**
 * CrawlerSheetItems — the crawler sheet's bay cards (the crawler type's card
 * is `CrawlerTypeCard`).
 * Presentational + callback-driven — CrawlerSheet owns all persistence.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../components/index'
import {
  BayInfo,
  Button,
  Content,
  damagedEffectOf,
  Entity,
  EntityChoices,
  EntityRollMini,
  MiniGroup,
  tokens,
  useDetailModal,
  WhenDamaged,
} from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { BAY_REPAIR_COST } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { CrawlerCrewLead } from './CrawlerCrewLead'
import { LinkedUnitLink } from './LinkedUnitLink'
import { SheetItemLine } from './SheetItemLine'
import { UnknownItemLine } from './UnknownItemLine'

export type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/** Each bay's function-action verb, by bay slug (Dock/Craft/Heal/Mount…). */

const BAY_FUNCTIONS: Record<string, string> = {
  'command-bay': 'Scan',
  'mech-bay': 'Dock',
  'storage-bay': 'Store',
  'armament-bay': 'Mount',
  'crafting-bay': 'Craft',
  'trading-bay': 'Trade',
  'med-bay': 'Heal',
  'pilot-bay': 'Train',
  armoury: 'Equip',
  cantina: 'Rumour',
  'bio-mech-bay': 'Restore',
  'bio-crafting-bay': 'Craft',
  'nanite-processing-bay': 'Process',
}

/**
 * Several bays ALSO restate their damaged clause as a trailing content
 * paragraph, so hiding `damagedEffect` alone still left it on the card. This
 * catches that duplicate.
 */
const WHEN_DAMAGED = /\b(?:is|becomes|are|become)\s+damaged\b/i

/** "Docks [mech]": the word, then under it the docked mech's Mini, filling its line (N4). */
const DOCKS = {
  color: tokens.color.ink,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[6],
  margin: `0 0 ${tokens.space[6]}`,
} satisfies CSSProperties

/** Split a bay's rules content into its always-true half and its damaged half. */
function splitBayContent(content: unknown): { normal: unknown[]; damaged: string[] } {
  if (!Array.isArray(content)) return { normal: [], damaged: [] }
  const normal: unknown[] = []
  const damaged: string[] = []
  for (const block of content) {
    const value = (block as { value?: unknown })?.value
    if (typeof value === 'string' && WHEN_DAMAGED.test(value)) damaged.push(value)
    else normal.push(block)
  }
  return { normal, damaged }
}

type CrawlerBayCardProps = {
  crawlerId: string
  entry: CrawlerBayEntry
  index: number
  /** Crawler tech level — names the repair cost ('5·T3'). */
  crawlerTl: number
  /** Shortfall (scrap) if the pool can't fully cover a repair right now. */
  repairShortfall: number
  /** Repair this bay: pool decrement + condition flip (owned by the parent). */
  onRepair: (entry: CrawlerBayEntry, index: number) => void
  /**
   * Persisted choice selections for this bay (keyed by `entry.bayRef`), from
   * the canonical crawler prop so a read-only rendering does not
   * depend on the live store.
   */
  seedSelections: ChoiceSelections | undefined
  store: UnitsStore
  readOnly: boolean
  /** Read on a sheet its owner tracks: the bay's condition still steps. */
  liveCondition?: boolean
  /**
   * Docked-mech one-liner (poster: "Docks <mech>") — set on the Mech Bay when
   * the composition has a docked mech; renders above the crew lead, the mech
   * as its Mini, linking to its sheet where it has one.
   */
  dockedMech?: { name: string; href: string | undefined }
  /**
   * Contents this bay HOLDS, rendered inside it above the crew lead — the
   * Armament Bay's mounted weapons. A bay's contents belong in the bay, not in
   * a section elsewhere on the sheet describing it from a distance.
   */
  contents?: ReactNode
  /**
   * Overrides the bay's function action (Mount / Dock / Craft …). Without it
   * the button opens the bay's rules; the Armament Bay points it at the weapons
   * picker instead, which is the thing "Mount" actually means.
   */
  onFunction?: () => void
  /**
   * The built NPC crewing this bay (ADR-044). While set, the crew lead shows
   * that NPC, read-only, in place of the inline crew — which stays exactly as
   * it was, and comes back when the link goes (Q2).
   */
  assigned?: CrewAssignment
  /** Uninstall the bay (Edit, expansion bays only); absent, it cannot be removed. */
  onRemove?: () => void
}

/**
 * CrawlerBayCard — one installed bay as a CONTENTFUL Mini, in one subtle
 * border (`MiniGroup`): its head (its
 * condition stepping Intact ↔ Damaged from its state slot, its function and
 * Repair in its chip group, C8), then in its body (R46) its Bay Info,
 * folded, and its When Damaged, open once it is
 * damaged, first; then its choices (the Armament Bay's
 * weapon pick), its roll table, what it holds and its crew lead's collapsed
 * Mini (`CrewLeadMini`); every section at the Mini Size, the sidebar's
 * Storage Bay's alike.
 * The bay's full rules open in a detail modal from the function action.
 */
export function CrawlerBayCard({
  crawlerId,
  entry,
  index,
  crawlerTl,
  repairShortfall,
  onRepair,
  seedSelections,
  store,
  readOnly,
  liveCondition = false,
  dockedMech,
  contents,
  onFunction,
  assigned,
  onRemove,
}: CrawlerBayCardProps) {
  const storeState = store()
  const { selections, setSelections } = useEntityChoices(
    'crawler',
    crawlerId,
    entry.bayRef,
    'bayChoices',
    seedSelections,
    store
  )
  const bay = resolveCrawlerBay(entry.bayRef)
  const detail = useDetailModal(bay ?? undefined)

  if (!bay) {
    return (
      <UnknownItemLine
        slug={entry.bayRef}
        schemaName="crawler-bays"
        condition={entry.condition ?? 'intact'}
        readOnly
      />
    )
  }

  const condition = entry.condition ?? 'intact'
  const damaged = condition === 'damaged'

  function patchEntry(patch: Partial<CrawlerBayEntry>) {
    // Per-bay merge at the store level: updateCrawlerBay re-reads
    // the freshest persisted record and patches only this entry, so
    // concurrent edits to different bays don't clobber each other. index
    // disambiguates duplicate bayRefs.
    runWrite(() =>
      storeState.updateCrawlerBay(crawlerId, entry.bayRef, patch, index, LIVE_SHEET_MANUAL)
    )
  }

  /** Bays are Intact/Damaged ONLY — never Destroyed. */
  function toggleCondition() {
    patchEntry({ condition: damaged ? 'intact' : 'damaged' })
  }

  const crew = (
    <>
      {dockedMech && (
        <div style={DOCKS}>
          <span>{buildSheetCopy('docks')}</span>
          <LinkedUnitLink kind="mech" name={dockedMech.name} href={dockedMech.href} />
        </div>
      )}
      <CrawlerCrewLead
        npc={bay.npc}
        slot={{ schemaName: 'crawler-bays', id: bay.id, name: bay.name }}
        state={entry}
        selections={selections}
        setSelections={setSelections}
        onPatch={readOnly ? undefined : patchEntry}
        assigned={assigned}
      />
    </>
  )

  const functionLabel = BAY_FUNCTIONS[entry.bayRef] ?? 'Use'

  // The bay's rules, less the clause its When Damaged says once (WHEN_DAMAGED)
  // and the SRD crew NPC, which is its crew lead's Mini here.
  const { normal } = splitBayContent(bay.content)
  const damagedText = damagedEffectOf(bay) ?? ''
  const tokenData = { ...bay, npc: undefined, content: normal } as unknown as RefMetaEntity
  // Its Bay Info folds, the sidebar's Storage Bay's too.
  const infoFold = 'closed'

  // The bay is a CONTENTFUL Mini: its head (its
  // condition steps from the state slot, C8; a bay is Intact or Damaged,
  // never Destroyed; its function and Repair are the last slot), then in its
  // body everything that is the bay's: its Bay
  // Info and When Damaged first, then its choices and roll
  // table, what it holds and its crew lead's collapsed Mini, each section at
  // the Mini Size.
  const line = (
    <SheetItemLine
      token={
        <Entity
          size="mini"
          context="loadout"
          entity={tokenData}
          instance={{ condition }}
          mode={{ kind: 'link' }}
          body={{
            text: false,
            children: (
              <>
                <BayInfo subject={bay.name} fold={infoFold} size="mini">
                  <Content body={normal as ComponentProps<typeof Content>['body']} />
                </BayInfo>
                {/* Bay Info and When Damaged first, then everything else (R46). */}
                {damagedText && (
                  <WhenDamaged
                    key={condition}
                    effect={damagedText}
                    subject={bay.name}
                    // Its When Damaged folds in the sidebar too (R46).
                    fold={damaged ? 'open' : 'closed'}
                    size="mini"
                  />
                )}
                <EntityChoices
                  entity={bay as unknown as RefMetaEntity}
                  selections={selections}
                  onSelectionChange={readOnly ? undefined : setSelections}
                  techLevel={crawlerTl}
                />
                <EntityRollMini entity={bay as unknown as RefMetaEntity} disabled={damaged} />
                {contents}
                {crew}
              </>
            ),
          }}
        />
      }
      name={bay.name}
      condition={condition}
      readOnly={readOnly}
      onConditionCycle={toggleCondition}
      nextCondition={damaged ? 'intact' : 'damaged'}
      liveCondition={liveCondition}
      onRemove={readOnly ? undefined : onRemove}
      actions={
        <>
          <Button
            size="mini"
            variant="primary"
            title={
              damaged
                ? buildSheetCopy('isDamagedItsFunctionIs', { name: bay.name })
                : buildSheetCopy('openTheRules', { functionLabel, name: bay.name })
            }
            disabled={damaged}
            onClick={() => (onFunction ? onFunction() : detail.control.onClick?.())}
          >
            {functionLabel}
          </Button>
          <Button
            size="mini"
            variant="ink"
            title={
              damaged
                ? repairShortfall > 0
                  ? buildSheetCopy('costsScrapTechOrHigher', {
                      bayRepairCost: BAY_REPAIR_COST,
                      crawlerTl,
                      repairShortfall,
                    })
                  : buildSheetCopy('costsScrapTechOrHigher2', {
                      bayRepairCost: BAY_REPAIR_COST,
                      crawlerTl,
                    })
                : buildSheetCopy('isIntactNothingToRepair', { name: bay.name })
            }
            disabled={!damaged}
            onClick={() => onRepair(entry, index)}
          >
            {buildSheetCopy('repair')}
          </Button>
        </>
      }
    />
  )

  // The bay's Mini, in one subtle border.
  return (
    <>
      <MiniGroup label={bay.name}>{line}</MiniGroup>
      {detail.modal}
    </>
  )
}
