/**
 * CrawlerSheetItems — the crawler sheet's bay cards, extracted from
 * CrawlerSheet.tsx (the crawler type's card is `CrawlerTypeCard`).
 * Presentational + callback-driven — CrawlerSheet owns all persistence.
 */

import type { CardFootMeta, ChoiceSelections, ReferenceEntityControl } from 'component-lib'
import {
  Entity,
  embeddedPeekAddress,
  foldControl,
  ReferenceEntityCard,
  tokens,
  useDetailModal,
} from 'component-lib'
import type { Crawler } from 'itun-domain/schemas/crawler'
import type { CSSProperties, ReactNode } from 'react'
import { useId, useState } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { findNpcChoiceByName, resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { CrewAssignment } from '../../lib/npcs/npcModel'
import { BAY_REPAIR_COST, bayTechLines } from '../../lib/rules/crawlerItems'
import { runWrite } from '../../lib/runWrite'
import type { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { LinkedCrewInset } from '../npc/LinkedCrewInset'
import { useEntityChoices } from '../shared/useEntityChoices'
import { NpcInset } from './NpcInset'
import { SheetItemLine } from './SheetItemLine'

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
 * The card's OWN "When Damaged" block is always suppressed: the clause is held
 * back while the bay is INTACT — it describes a state you are not in, and
 * printed inline it read as though it applied now — and when the bay IS damaged
 * it is re-rendered as a centred callout over the dimmed card instead.
 */
const HIDE_DAMAGED = { damagedEffect: true } as const
/**
 * Read draws no unchosen pick: a "Choose a …" disclosure is a write cue (board
 * 10). A pick that WAS made still reads, so it is the unmade one that hides.
 */
const HIDE_DAMAGED_READ = { damagedEffect: true, choices: true } as const

/**
 * Several bays ALSO restate their damaged clause as a trailing content
 * paragraph, so hiding `damagedEffect` alone still left it on the card. This
 * catches that duplicate.
 */
const WHEN_DAMAGED = /\b(?:is|becomes|are|become)\s+damaged\b/i

/** A bay's crew: its Token's line, then (Edit, opened) the crew's fields. */
const CREW_STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

/** The placeholder for a bay ref the catalog does not know. */
const UNKNOWN_BAY = {
  borderRadius: '0.25rem',
  border: `${tokens.borderWidth.hairline} solid ${tokens.color.ink}`,
  padding: `${tokens.space[4]} ${tokens.space[8]}`,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.25 / 0.875,
  color: tokens.color.wkMuted,
} satisfies CSSProperties

const DOCKS = {
  margin: `0 0 ${tokens.space[6]}`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  color: tokens.color.ink,
} satisfies CSSProperties

const BOLD = { fontWeight: tokens.weight.bold } satisfies CSSProperties

const EXPAND_STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const DAMAGED_CALLOUT = {
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.statusBad}`,
  backgroundColor: tokens.color.paper,
  padding: `${tokens.space[12]} ${tokens.space[16]}`,
  textAlign: 'center',
} satisfies CSSProperties

const DAMAGED_LABEL = {
  marginBottom: tokens.space[4],
  display: 'block',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tokens.tracking.caps,
  color: tokens.color.statusBad,
} satisfies CSSProperties

const DAMAGED_TEXT = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.375,
  color: tokens.color.ink,
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
   * the composition has a docked mech; renders above the crew inset.
   */
  dockedMechName?: string
  /**
   * Contents this bay HOLDS, rendered inside it above the crew inset — the
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
 * badge (Intact ↔ Damaged toggle), crew-lead NpcInset in the expand slot,
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
  dockedMechName,
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
  const [folded, setFolded] = useState(true)
  // Edit: whether the crew's fields are open under their Token.
  const [crewOpen, setCrewOpen] = useState(false)
  const surfaceId = useId()

  if (!bay) {
    return <div style={UNKNOWN_BAY}>{entry.bayRef}</div>
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
  const inlineCrew = (
    <NpcInset
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
      {dockedMechName && (
        <p style={DOCKS}>
          Docks <span style={BOLD}>{dockedMechName}</span>
        </p>
      )}
      {assigned ? (
        <LinkedCrewInset slotName={bay.name} assignment={assigned} fallback={inlineCrew} />
      ) : npc ? (
        // The crew is a Token named for them, Peeking the bay's NPC card
        // (owner's calls, 2026-10-14). Edit puts Details on its line, opening
        // the crew's fields under it, as a pilot's equipment does.
        <div style={CREW_STACK}>
          <SheetItemLine
            token={
              <Entity
                form="token"
                // The embedded crew, as its bay card nests it (`nestedEntityGroups`).
                entity={
                  { ...npc, name: npc.position, schemaName: 'npcs' } as unknown as SURefMetaEntity
                }
                instance={{ title: entry.npcName?.trim() || npc.position }}
                peekAt={embeddedPeekAddress('crawler-bays', bay.id, 'npc')}
              />
            }
            name={`${bay.name} crew`}
            readOnly={readOnly}
            actions={
              <button
                type="button"
                className="su-sheet-ctl"
                aria-expanded={crewOpen}
                aria-label={`${crewOpen ? 'Collapse' : 'Expand'} ${bay.name} crew`}
                onClick={() => setCrewOpen((open) => !open)}
              >
                Details
              </button>
            }
          />
          {!readOnly && crewOpen && inlineCrew}
        </div>
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
  // in the crew inset must never unfold the bay around it).
  const fold = foldControl({
    subject: bay.name,
    folded,
    surfaceId,
    onToggle: () => setFolded((f) => !f),
  })

  // The card renders WITHOUT the SRD npc block — the crew lead lives in the
  // expand inset instead — and without the "when damaged" clause,
  // which is held back until it applies (see WHEN_DAMAGED).
  const { normal: bayRules } = splitBayContent(bay.content)
  const normal = folded ? foldedBayContent(bayRules, crawlerTl) : bayRules
  const damagedText =
    typeof (bay as { damagedEffect?: unknown }).damagedEffect === 'string'
      ? (bay as { damagedEffect: string }).damagedEffect
      : ''
  const cardData = { ...bay, npc: undefined, content: normal } as unknown as SURefEntity

  return (
    <>
      <ReferenceEntityCard
        data={cardData}
        size="medium"
        hide={readOnly && !hasPick ? HIDE_DAMAGED_READ : HIDE_DAMAGED}
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
              {/* The damaged clause, centred: the card itself is greyed by its
                  `damaged` status, and this is the one thing the reader needs
                  off it while it is in that state. */}
              <div style={DAMAGED_CALLOUT}>
                <span style={DAMAGED_LABEL}>When Damaged</span>
                <p style={DAMAGED_TEXT}>{damagedText}</p>
              </div>
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
