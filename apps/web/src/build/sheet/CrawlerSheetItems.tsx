/**
 * CrawlerSheetItems — the crawler sheet's bay cards, extracted from
 * CrawlerSheet.tsx (the crawler type's card is `CrawlerTypeCard`).
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
  embeddedPeekAddress,
  MiniGroup,
  tokens,
  useDetailModal,
  WhenDamaged,
} from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { findNpcChoiceByName, resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { BAY_REPAIR_COST } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { unitRowModel } from '../../lib/units/unitModel'
import type { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { LinkedCrewMini } from '../npc/LinkedCrewMini'
import { CrewLeadMini } from './CrewLeadMini'
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
   * the canonical crawler prop so read-only/snapshot rendering does not
   * depend on the live store.
   */
  seedSelections: ChoiceSelections | undefined
  store: typeof useEntityStore
  readOnly: boolean
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
  /** In the sheet's sidebar, where nothing folds (ruleset §1.2): Bay Info and When Damaged stand open. */
  inSidebar?: boolean
}

/**
 * CrawlerBayCard — one installed bay as a CONTENTFUL Mini and what belongs to
 * it, in one subtle border (`MiniGroup`; owner's calls,
 * 2026-10-20): the bay's Mini (its condition stepping Intact ↔ Damaged from
 * its state slot, its function and Repair in its chip group, C8; its Bay Info
 * folded under its head), then on the lines under it its choices (the
 * Armament Bay's weapon pick), its roll table, what it holds, its crew lead's
 * contentful Mini (`CrewLeadMini`, N3) and its When Damaged, open once it
 * is damaged. None sits inside another (E6). In the sidebar nothing folds.
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
  dockedMech,
  contents,
  onFunction,
  assigned,
  inSidebar = false,
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
  const npc = bay.npc
  const maxHP = npc?.hitPoints ?? 0

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

  // Keepsake/Motto persist through the bay NPC's SRD freeform choices — same
  // bayChoices map as the bay's own choices, no extra schema field.
  const keepsakeChoice = findNpcChoiceByName(npc, 'Keepsake')
  const keepsake = keepsakeChoice ? (selections[keepsakeChoice.id]?.[0] ?? '') : ''
  function setKeepsake(next: string) {
    if (!keepsakeChoice) return
    setSelections({
      ...selections,
      [keepsakeChoice.id]: next.trim().length > 0 ? [next] : [],
    })
  }
  const mottoChoice = findNpcChoiceByName(npc, 'Motto')
  const motto = mottoChoice ? (selections[mottoChoice.id]?.[0] ?? '') : ''
  function setMotto(next: string) {
    if (!mottoChoice) return
    setSelections({
      ...selections,
      [mottoChoice.id]: next.trim().length > 0 ? [next] : [],
    })
  }

  // While a built NPC is assigned, the inline crew is never written: read-only
  // is what lets the unlink restore it byte for byte (Q2).
  const inlineReadOnly = readOnly || assigned !== undefined
  // The crew lead is a contentful Mini (N3): its head Peeks the bay's crew
  // NPC, embedded as its bay card nests it (`nestedEntityGroups`); its body is
  // what the sheet tracks about them, and in Edit their fields (owner's call,
  // 2026-10-17). A bay the book gives no crew NPC still has a crew lead.
  const inlineCrew = (
    <CrewLeadMini
      {...(npc
        ? {
            entity: { ...npc, name: npc.position, schemaName: 'npcs' } as unknown as RefMetaEntity,
            peekAt: embeddedPeekAddress('crawler-bays', bay.id, 'npc'),
          }
        : { model: unitRowModel({ kind: 'npc', name: 'Crew' }) })}
      instance={{ title: entry.npcName?.trim() || npc?.position || 'Crew' }}
      bayName={bay.name}
      title={npc?.position}
      name={entry.npcName ?? ''}
      hp={entry.npcCurrentHP ?? maxHP}
      maxHp={maxHP}
      keepsake={keepsake}
      motto={motto}
      detail={entry.npcDescription ?? ''}
      facts={entry.npcFacts ?? []}
      // Handler absence IS the read-only encoding: readOnly branches once
      // here instead of per-handler ternaries + a second readOnly prop.
      {...(inlineReadOnly
        ? {}
        : {
            onNameChange: (next: string) => patchEntry({ npcName: next }),
            onHpChange: (next: number) => patchEntry({ npcCurrentHP: next }),
            onKeepsakeChange: keepsakeChoice ? setKeepsake : undefined,
            onMottoChange: mottoChoice ? setMotto : undefined,
            onDetailChange: (next: string) => patchEntry({ npcDescription: next }),
            onFactsChange: (next: string[]) => patchEntry({ npcFacts: next }),
          })}
    />
  )
  const crew = (
    <>
      {dockedMech && (
        <div style={DOCKS}>
          <span>Docks</span>
          <LinkedUnitLink kind="mech" name={dockedMech.name} href={dockedMech.href} />
        </div>
      )}
      {assigned ? (
        <LinkedCrewMini slotName={bay.name} assignment={assigned} fallback={inlineCrew} />
      ) : (
        inlineCrew
      )}
    </>
  )

  const functionLabel = BAY_FUNCTIONS[entry.bayRef] ?? 'Use'

  // The bay's rules, less the clause its When Damaged says once (WHEN_DAMAGED)
  // and the SRD crew NPC, which is its crew lead's Mini here.
  const { normal } = splitBayContent(bay.content)
  const damagedText = damagedEffectOf(bay) ?? ''
  const tokenData = { ...bay, npc: undefined, content: normal } as unknown as RefMetaEntity
  // In the sidebar nothing folds (ruleset §1.2): its sections stand open.
  const infoFold = inSidebar ? undefined : 'closed'

  // The bay is a CONTENTFUL Mini (owner's call, 2026-10-20): its head (its
  // condition steps from the state slot, C8; a bay is Intact or Damaged,
  // never Destroyed; its function and Repair are the last slot) and its Bay
  // Info under it, folded on a sheet.
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
              <BayInfo subject={bay.name} fold={infoFold}>
                <Content body={normal as ComponentProps<typeof Content>['body']} />
              </BayInfo>
            ),
          }}
        />
      }
      name={bay.name}
      condition={condition}
      readOnly={readOnly}
      onConditionCycle={toggleCondition}
      nextCondition={damaged ? 'intact' : 'damaged'}
      actions={
        <>
          <Button
            size="mini"
            variant="primary"
            title={
              damaged
                ? `${bay.name} is damaged — its function is offline until repaired.`
                : `${functionLabel} — open the ${bay.name} rules`
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
                  ? `Costs ${BAY_REPAIR_COST} Scrap (Tech ${crawlerTl} or higher) — pool is ${repairShortfall} short; repairing anyway is the table's call.`
                  : `Costs ${BAY_REPAIR_COST} Scrap (Tech ${crawlerTl} or higher) from the pool.`
                : `${bay.name} is intact — nothing to repair.`
            }
            disabled={!damaged}
            onClick={() => onRepair(entry, index)}
          >
            Repair
          </Button>
        </>
      }
    />
  )

  // The bay and what belongs to it, one subtle border (owner's call,
  // 2026-10-20), none inside another (E6): its Mini, its roll table, what it
  // holds, its crew lead, then its When Damaged, open once it is damaged.
  return (
    <>
      <MiniGroup label={bay.name}>
        {line}
        <EntityChoices
          entity={bay as unknown as RefMetaEntity}
          selections={selections}
          onSelectionChange={readOnly ? undefined : setSelections}
          techLevel={crawlerTl}
        />
        <EntityRollMini entity={bay as unknown as RefMetaEntity} disabled={damaged} />
        {contents}
        {crew}
        {damagedText && (
          <WhenDamaged
            key={condition}
            effect={damagedText}
            subject={bay.name}
            fold={inSidebar ? undefined : damaged ? 'open' : 'closed'}
          />
        )}
      </MiniGroup>
      {detail.modal}
    </>
  )
}
