/**
 * CrawlerSheetItems — the crawler sheet's bay cards, extracted from
 * CrawlerSheet.tsx (the crawler type's card is `CrawlerTypeCard`).
 * Presentational + callback-driven — CrawlerSheet owns all persistence.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { CSSProperties, ReactNode } from 'react'
import type { RefEntity, RefMetaEntity } from 'salvageunion-reference'
import type { CardFootMeta, ChoiceSelections, ReferenceEntityControl } from '../../components/index'
import {
  damagedEffectOf,
  embeddedPeekAddress,
  foldControl,
  ReferenceEntityCard,
  tokens,
  useDetailModal,
  useDisclosure,
  WhenDamaged,
} from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { findNpcChoiceByName, resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { BAY_REPAIR_COST, bayTechLines } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import { unitRowModel } from '../../lib/units/unitModel'
import type { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { LinkedCrewToken } from '../npc/LinkedCrewToken'
import { CrewLeadToken } from './CrewLeadToken'
import { LinkedUnitLink } from './LinkedUnitLink'
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
 * A bay on the sheet is drawn as the SRD's bay Page draws it: no kind pill
 * right of its title (its foot names no kind off a Page, EDL E9). An INTACT
 * bay shows its "When Damaged" section (a Slab over the clause, N5), as the
 * book prints it; a DAMAGED bay re-renders the clause in its expanded body
 * instead, so the card's own is held back then.
 */
const HIDE_INTACT = { axisMarkers: true } as const
const HIDE_DAMAGED = { ...HIDE_INTACT, damagedEffect: true } as const
/**
 * Read draws no unchosen pick: a "Choose a …" disclosure is a write cue (board
 * 10). A pick that WAS made still reads, so it is the unmade one that hides.
 */
const HIDE_INTACT_READ = { ...HIDE_INTACT, choices: true } as const
const HIDE_DAMAGED_READ = { ...HIDE_DAMAGED, choices: true } as const

/**
 * Several bays ALSO restate their damaged clause as a trailing content
 * paragraph, so hiding `damagedEffect` alone still left it on the card. This
 * catches that duplicate.
 */
const WHEN_DAMAGED = /\b(?:is|becomes|are|become)\s+damaged\b/i

/** "Docks [mech]": the word, then under it the docked mech's Token, filling its line (N4). */
const DOCKS = {
  color: tokens.color.ink,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[6],
  margin: `0 0 ${tokens.space[6]}`,
} satisfies CSSProperties

const EXPAND_STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
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

/**
 * What a FOLDED bay keeps of its rules: the line for the crawler's own Tech
 * Level (`bayTechLines`) and the bay's choice markers, so a pick still reads
 * where the book puts it. The rest of the prose waits behind the disclosure.
 */
function foldedBayContent(normal: unknown[], crawlerTl: number): unknown[] {
  const blocks = normal as { type?: unknown; label?: string }[]
  const tlLines = new Set<unknown>(bayTechLines(blocks, crawlerTl))
  return blocks.filter((block) => block.type === 'choice' || tlLines.has(block))
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
   * as its Token, linking to its sheet where it has one.
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
}

/**
 * CrawlerBayCard — one installed bay as a compact cb entity card: status
 * badge (Intact ↔ Damaged toggle), its crew lead's contentful Token
 * (`CrewLeadToken`, N3) in the expand slot,
 * function/Repair foot actions, and the bay's SRD choices (e.g. the Armament
 * Bay weapon pick). The bay's full rules open in a detail modal from the
 * function action.
 *
 * The bay starts FOLDED: it shows its state — condition, crew lead, the line
 * for the crawler's Tech Level, the roll bar, what it holds — and keeps its
 * prose behind the card's Row ⇄ Card disclosure (`foldControl`). The bay is a
 * child of the crawler sheet, and a child hides prose its parent shows
 * (ruleset §5); printed inline, every bay's rules ran the starter crawler
 * sheet to thousands of pixels.
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
  const hasPick = Object.values(selections).some((picked) =>
    Array.isArray(picked) ? picked.length > 0 : Boolean(picked)
  )
  const bay = resolveCrawlerBay(entry.bayRef)
  const detail = useDetailModal(bay ?? undefined)
  // Open is the bay's full prose; shut, it folds to its lead.
  const prose = useDisclosure()
  const folded = !prose.open

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
  // The crew lead is a contentful Token (N3): its head Peeks the bay's crew
  // NPC, embedded as its bay card nests it (`nestedEntityGroups`); its body is
  // what the sheet tracks about them, and in Edit their fields (owner's call,
  // 2026-10-17). A bay the book gives no crew NPC still has a crew lead.
  const inlineCrew = (
    <CrewLeadToken
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
        <LinkedCrewToken slotName={bay.name} assignment={assigned} fallback={inlineCrew} />
      ) : (
        inlineCrew
      )}
    </>
  )

  const functionLabel = BAY_FUNCTIONS[entry.bayRef] ?? 'Use'
  // No crew lead in the footer (owner's call, 2026-10-14): the crew is in the
  // card already, so naming them again only repeated it.
  const footMeta: CardFootMeta[] = damaged ? [{ label: 'Repair', value: `5·T${crawlerTl}` }] : []

  // Damaged disables the function action and promotes Repair. Both ride the
  // standard controls overlay — no footer.
  const controls: ReferenceEntityControl[] = [
    {
      key: 'function',
      label: functionLabel,
      ariaLabel: functionLabel,
      title: damaged
        ? `${bay.name} is damaged — its function is offline until repaired.`
        : `${functionLabel} — open the ${bay.name} rules`,
      onClick: () => (onFunction ? onFunction() : detail.control.onClick?.()),
      variant: 'primary',
      disabled: damaged,
    },
    {
      key: 'repair',
      label: 'Repair',
      ariaLabel: 'Repair',
      title: damaged
        ? repairShortfall > 0
          ? `Costs ${BAY_REPAIR_COST} Scrap (Tech ${crawlerTl} or higher) — pool is ${repairShortfall} short; repairing anyway is the table's call.`
          : `Costs ${BAY_REPAIR_COST} Scrap (Tech ${crawlerTl} or higher) from the pool.`
        : `${bay.name} is intact — nothing to repair.`,
      onClick: () => onRepair(entry, index),
      variant: 'danger',
      disabled: !damaged || readOnly,
    },
  ]

  // Folds the prose only: the card keeps its Card form and every live field,
  // so the disclosure is the one way to open it (no card-wide click — typing
  // in the crew lead must never unfold the bay around it).
  const fold = foldControl({
    subject: bay.name,
    disclosure: prose,
  })

  // The card renders WITHOUT the SRD npc block — the crew lead lives in the
  // expand slot instead, as its Token — and without the prose restating the
  // "when damaged" clause (see WHEN_DAMAGED): its section says it once.
  const { normal: bayRules } = splitBayContent(bay.content)
  const normal = folded ? foldedBayContent(bayRules, crawlerTl) : bayRules
  const damagedText = damagedEffectOf(bay) ?? ''
  const cardData = { ...bay, npc: undefined, content: normal } as unknown as RefEntity

  return (
    <>
      <ReferenceEntityCard
        data={cardData}
        size="compact"
        hide={
          readOnly && !hasPick
            ? damaged
              ? HIDE_DAMAGED_READ
              : HIDE_INTACT_READ
            : damaged
              ? HIDE_DAMAGED
              : HIDE_INTACT
        }
        // Read draws no controls (board 10): no condition tri-state for an
        // intact bay, no function or Repair. A damaged bay keeps its status,
        // which greys the card — that is the fact to read.
        status={readOnly && condition === 'intact' ? undefined : condition}
        onStatusClick={readOnly ? undefined : toggleCondition}
        selections={selections}
        onSelectionChange={readOnly ? undefined : setSelections}
        controls={readOnly ? [fold] : [...controls, fold]}
        footMeta={footMeta}
        expand={
          damaged && damagedText ? (
            <div style={EXPAND_STACK}>
              {contents}
              {/* The damaged clause, as the SRD card draws it: the card itself
                  is greyed by its `damaged` status, and this is the one thing
                  the reader needs off it while it is in that state. */}
              <WhenDamaged effect={damagedText} />
              {crew}
            </div>
          ) : contents ? (
            <div style={EXPAND_STACK}>
              {contents}
              {crew}
            </div>
          ) : (
            crew
          )
        }
      />
      {detail.modal}
    </>
  )
}
