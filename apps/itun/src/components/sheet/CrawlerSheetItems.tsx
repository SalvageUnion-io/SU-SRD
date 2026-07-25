/**
 * CrawlerSheetItems — the crawler sheet's building blocks (bay cards, the
 * crawler-type NPC card), extracted from CrawlerSheet.tsx (audit item 19).
 * Presentational + callback-driven — CrawlerSheet owns all persistence.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { type ReferenceEntityControl, ReferenceEntityCard, useDetailModal } from 'component-lib'
import type { CardFootMeta, ChoiceSelections } from 'component-lib'

import { findNpcChoiceByName, resolveCrawlerBay, resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { useEntityStore } from '../../stores/entityStore'
import { useEntityChoices } from '../shared/useEntityChoices'
import type { ComponentProps, ReactNode } from 'react'
import { Content, NpcInset } from 'component-lib'
import { BAY_REPAIR_COST } from './crawlerSheetItemRules'

export type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/** Each bay's function-action verb (design §4.4 — Dock/Craft/Heal/Mount…). */

const BAY_FUNCTIONS: Record<string, string> = {
  'Command Bay': 'Scan',
  'Mech Bay': 'Dock',
  'Storage Bay': 'Store',
  'Armament Bay': 'Mount',
  'Crafting Bay': 'Craft',
  'Trading Bay': 'Trade',
  'Med Bay': 'Heal',
  'Pilot Bay': 'Train',
  Armoury: 'Equip',
  Cantina: 'Rumour',
}

/**
 * The card's OWN "When Damaged" block is always suppressed: the clause is held
 * back while the bay is INTACT — it describes a state you are not in, and
 * printed inline it read as though it applied now — and when the bay IS damaged
 * it is re-rendered as a centred callout over the dimmed card instead.
 */
const HIDE_DAMAGED = { damagedEffect: true } as const

/**
 * Several bays ALSO restate their damaged clause as a trailing content
 * paragraph, so hiding `damagedEffect` alone still left it on the card. This
 * catches that duplicate.
 */
const WHEN_DAMAGED = /\b(?:is|becomes|are|become)\s+damaged\b/i

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
}

/**
 * CrawlerBayCard — one installed bay as a compact cb entity card: status
 * badge (Intact ↔ Damaged toggle), crew-lead NpcInset in the expand slot,
 * function/Repair foot actions, and the bay's SRD choices (e.g. the Armament
 * Bay weapon pick). The bay's full rules open in a detail modal from the
 * function action.
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
      <div className="rounded border border-ink px-2 py-1 text-sm text-wk-muted">
        {entry.bayRef}
      </div>
    )
  }

  const condition = entry.condition ?? 'intact'
  const damaged = condition === 'damaged'
  const npc = bay.npc
  const maxHP = npc?.hitPoints ?? 0

  function patchEntry(patch: Partial<CrawlerBayEntry>) {
    // Per-bay merge at the store level (plan 2.7): updateCrawlerBay re-reads
    // the freshest persisted record and patches only this entry, so
    // concurrent edits to different bays don't clobber each other. index
    // disambiguates duplicate bayRefs.
    void storeState.updateCrawlerBay(crawlerId, entry.bayRef, patch, index)
  }

  /** Bays are Intact/Damaged ONLY — never Destroyed (rules C8). */
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

  const crew = (
    <>
      {dockedMechName && (
        <p className="m-0 mb-1.5 truncate font-body text-caption text-ink">
          Docks <span className="font-bold">{dockedMechName}</span>
        </p>
      )}
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
        {...(readOnly
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
    </>
  )

  const functionLabel = BAY_FUNCTIONS[bay.name] ?? 'Use'
  const leadName = entry.npcName?.trim() ? entry.npcName : (npc?.position ?? '—')
  const footMeta: CardFootMeta[] = [
    { label: 'Lead', value: leadName },
    ...(damaged ? [{ label: 'Repair', value: `5·T${crawlerTl}` }] : []),
  ]

  // Damaged disables the function action and promotes Repair (design §4.4 /
  // interaction pattern 8). Both ride the standard controls overlay — no footer.
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

  // The card renders WITHOUT the SRD npc block — the crew lead lives in the
  // expand inset instead (design §4.4) — and without the "when damaged" clause,
  // which is held back until it applies (see WHEN_DAMAGED).
  const { normal } = splitBayContent(bay.content)
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
        hide={HIDE_DAMAGED}
        status={condition}
        onStatusClick={readOnly ? undefined : toggleCondition}
        selections={selections}
        onSelectionChange={readOnly ? undefined : setSelections}
        controls={controls}
        footMeta={footMeta}
        expand={
          damaged && damagedText ? (
            <div className="flex flex-col gap-3">
              {contents}
              {/* The damaged clause, centred: the card itself is greyed by its
                  `damaged` status, and this is the one thing the reader needs
                  off it while it is in that state. */}
              <div className="rounded-card border-chrome border-status-bad bg-paper px-4 py-3 text-center">
                <span className="mb-1 block font-cond text-label font-bold uppercase leading-none tracking-caps text-status-bad">
                  When Damaged
                </span>
                <p className="m-0 font-body text-sm leading-snug text-ink">{damagedText}</p>
              </div>
              {crew}
            </div>
          ) : contents ? (
            <div className="flex flex-col gap-3">
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

type CrawlerNpcState = NonNullable<Crawler['typeNpc']>

type CrawlerTypeCardProps = {
  crawlerId: string
  /** The crawler-type ref (SRD id) — also the bayChoices key for its NPC. */
  typeRef: string
  /** Live state for the type's special NPC. */
  typeNpc: CrawlerNpcState | undefined
  /** Persisted Keepsake/Motto selections for the type NPC (from the crawler prop). */
  seedSelections: ChoiceSelections | undefined
  store: typeof useEntityStore
  readOnly: boolean
  /**
   * The type's special-ability card(s). Rendered INSIDE this card, beside the
   * crew inset (see the `expand` slot), because both describe the same type.
   */
  ability?: ReactNode
  /**
   * Compact identity-band placement (redesign phase 3): renders the card
   */
}

/**
 * CrawlerTypeCard — the chosen crawler type as an entity card (description +
 * special action(s)), with its special NPC rendered as an NpcInset in the
 * expand slot. Mirrors CrawlerBayCard: the SRD npc block is stripped from the
 * card (it lives in the inset); Keepsake/Motto persist through the NPC's
 * freeform choices into the crawler's bayChoices map keyed by the type ref;
 * structured name/HP/description/facts persist into the `typeNpc` field.
 */
export function CrawlerTypeCard({
  crawlerId,
  typeRef,
  typeNpc,
  seedSelections,
  store,
  readOnly,
  ability,
}: CrawlerTypeCardProps) {
  const storeState = store()
  const { selections, setSelections } = useEntityChoices(
    'crawler',
    crawlerId,
    typeRef,
    'bayChoices',
    seedSelections,
    store
  )
  const type = resolveCrawlerType(typeRef)
  if (!type) return null

  const npc = type.npc
  const maxHP = npc?.hitPoints ?? 0

  function patchNpc(patch: Partial<CrawlerNpcState>) {
    const fresh = storeState.get('crawler', crawlerId)
    void storeState.update('crawler', crawlerId, {
      typeNpc: { ...(fresh?.typeNpc ?? {}), ...patch },
    })
  }

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

  const crew = npc ? (
    <NpcInset
      bayName={type.name}
      title={npc.position}
      name={typeNpc?.npcName ?? ''}
      hp={typeNpc?.npcCurrentHP ?? maxHP}
      maxHp={maxHP}
      keepsake={keepsake}
      motto={motto}
      detail={typeNpc?.npcDescription ?? ''}
      facts={typeNpc?.npcFacts ?? []}
      // Handler absence IS the read-only encoding: readOnly branches once
      // here instead of per-handler ternaries + a second readOnly prop.
      {...(readOnly
        ? {}
        : {
            onNameChange: (next: string) => patchNpc({ npcName: next }),
            onHpChange: (next: number) => patchNpc({ npcCurrentHP: next }),
            onKeepsakeChange: keepsakeChoice ? setKeepsake : undefined,
            onMottoChange: mottoChoice ? setMotto : undefined,
            onDetailChange: (next: string) => patchNpc({ npcDescription: next }),
            onFactsChange: (next: string[]) => patchNpc({ npcFacts: next }),
          })}
    />
  ) : undefined

  // NO card container. The crawler type used to render as a full entity card
  // with its ability and crew folded into the `expand` slot — a frame around a
  // frame around a frame, and the outer one left a band of empty paper down the
  // identity card. Its INTERNALS are handed back instead, for the identity
  // panel to lay out beside its own fields.
  //
  // The type's own choices ride the ability column, so a type that carries a
  // permanent pick is still editable without the card that used to host it.
  // The type's own PROSE survives the dissolved card. Losing the frame was the
  // point; losing the paragraph that says what an Exploratory crawler IS was
  // not — it is the only place that text appears on the sheet.
  // The cast is the duplicated-structural-type problem, not a shape mismatch:
  // `component-lib` and `salvageunion-reference` each declare their own content
  // block type with identical members, so TS treats them as unrelated.
  const description = <Content body={type.content as ComponentProps<typeof Content>['body']} />

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {description}
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 @2xl:grid-cols-2">
        {ability}
        {crew}
      </div>
    </div>
  )
}
