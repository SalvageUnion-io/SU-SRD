/**
 * CrawlerSheetItems — the crawler sheet's building blocks (bay cards, the
 * crawler-type NPC card, the scrap-pool slab), extracted from
 * CrawlerSheet.tsx (audit item 19). Presentational + callback-driven —
 * CrawlerSheet owns all persistence.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Btn, ReferenceEntityDisplay, StepBtn, useDetailModal } from 'suref-react'
import type { CardFootMeta, ChoiceSelections } from 'suref-react'

import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { findNpcChoiceByName, resolveCrawlerBay, resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import { useEntityStore } from '../../stores/entityStore'
import { useEntityChoices } from '../shared/useEntityChoices'
import { NpcInset } from './NpcInset'

export type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/** Resolve a stored crawler-system ref (id or name) to its SRD entity [gap 20]. */
// eslint-disable-next-line react-refresh/only-export-components -- shared control helpers, colocated by design (audit items 24/19)
export function resolveCrawlerSystem(ref: string): SURefEntity | null {
  try {
    const all = SalvageUnionReference.Systems.all() as ReadonlyArray<{
      id: string
      name: string
    }>
    return (all.find((s) => s.id === ref || s.name === ref) ?? null) as SURefEntity | null
  } catch {
    return null
  }
}

/** Bay repair cost: 5 Scrap of crawler TL or higher (rules C8, S12). */
// eslint-disable-next-line react-refresh/only-export-components -- shared control helpers, colocated by design (audit items 24/19)
export const BAY_REPAIR_COST = 5

/** Each bay's function-action verb (design §4.4 — Dock/Craft/Heal/Mount…). */
// eslint-disable-next-line react-refresh/only-export-components -- shared control helpers, colocated by design (audit items 24/19)
export const BAY_FUNCTIONS: Record<string, string> = {
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

/** Stable hide literal — the bay's long rules text lives in the detail modal. */
export const HIDE_BAY_CONTENT = { content: true } as const

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
  const detail = useDetailModal(bay ? (bay as unknown as SURefEntity) : undefined)

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
      onNameChange={readOnly ? undefined : (next) => patchEntry({ npcName: next })}
      onHpChange={readOnly ? undefined : (next) => patchEntry({ npcCurrentHP: next })}
      onKeepsakeChange={readOnly || !keepsakeChoice ? undefined : setKeepsake}
      onMottoChange={readOnly || !mottoChoice ? undefined : setMotto}
      onDetailChange={readOnly ? undefined : (next) => patchEntry({ npcDescription: next })}
      onFactsChange={readOnly ? undefined : (next) => patchEntry({ npcFacts: next })}
      readOnly={readOnly}
    />
  )

  const functionLabel = BAY_FUNCTIONS[bay.name] ?? 'Use'
  const leadName = entry.npcName?.trim() ? entry.npcName : (npc?.position ?? '—')
  const footMeta: CardFootMeta[] = [
    { label: 'Lead', value: leadName },
    ...(damaged ? [{ label: 'Repair', value: `5·T${crawlerTl}` }] : []),
  ]

  // Damaged disables the function action and promotes Repair to primary
  // (design §4.4 / interaction pattern 8).
  const footActions = (
    <>
      <Btn
        size="sm"
        variant={damaged ? 'default' : 'primary'}
        disabled={damaged}
        title={
          damaged
            ? `${bay.name} is damaged — its function is offline until repaired.`
            : `${functionLabel} — open the ${bay.name} rules`
        }
        onClick={() => detail.control.onClick()}
      >
        {functionLabel}
      </Btn>
      <Btn
        size="sm"
        variant={damaged ? 'primary' : 'ghost'}
        disabled={!damaged || readOnly}
        title={
          damaged
            ? repairShortfall > 0
              ? `Costs ${BAY_REPAIR_COST} Scrap (Tech ${crawlerTl} or higher) — pool is ${repairShortfall} short; repairing anyway is the table's call.`
              : `Costs ${BAY_REPAIR_COST} Scrap (Tech ${crawlerTl} or higher) from the pool.`
            : `${bay.name} is intact — nothing to repair.`
        }
        onClick={() => onRepair(entry, index)}
      >
        Repair
      </Btn>
    </>
  )

  // The card renders WITHOUT the SRD npc block — the crew lead lives in the
  // expand inset instead (design §4.4); the rules text lives in the modal.
  const cardData = { ...bay, npc: undefined } as unknown as SURefEntity

  return (
    <>
      <ReferenceEntityDisplay
        data={cardData}
        compact
        hide={HIDE_BAY_CONTENT}
        status={condition}
        onStatusClick={readOnly ? undefined : toggleCondition}
        selections={selections}
        onSelectionChange={readOnly ? undefined : setSelections}
        footActions={footActions}
        footMeta={footMeta}
        expand={crew}
      />
      {detail.modal}
    </>
  )
}

export type CrawlerNpcState = NonNullable<Crawler['typeNpc']>

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
      onNameChange={readOnly ? undefined : (next) => patchNpc({ npcName: next })}
      onHpChange={readOnly ? undefined : (next) => patchNpc({ npcCurrentHP: next })}
      onKeepsakeChange={readOnly || !keepsakeChoice ? undefined : setKeepsake}
      onMottoChange={readOnly || !mottoChoice ? undefined : setMotto}
      onDetailChange={readOnly ? undefined : (next) => patchNpc({ npcDescription: next })}
      onFactsChange={readOnly ? undefined : (next) => patchNpc({ npcFacts: next })}
      readOnly={readOnly}
    />
  ) : undefined

  // Card renders WITHOUT the SRD npc block — the special NPC lives in the inset.
  const cardData = { ...type, npc: undefined } as unknown as SURefEntity

  return (
    <ReferenceEntityDisplay
      data={cardData}
      selections={selections}
      onSelectionChange={readOnly ? undefined : setSelections}
      expand={crew}
    />
  )
}

type ScrapPoolSlabProps = {
  pool: ScrapPool
  /** Adjust one TL bucket by ±1 (reads the freshest pool at call time). */
  onAdjust?: (tl: number, delta: number) => void
  readOnly: boolean
}

export const SCRAP_TLS = [1, 2, 3, 4, 5, 6] as const

/**
 * ScrapPoolSlab — the shared party scrap pool as six editable TL-bucket
 * lozenges with `--cargo` semantics (design-review item, rules C5).
 */
export function ScrapPoolSlab({ pool, onAdjust, readOnly }: ScrapPoolSlabProps) {
  const editable = !readOnly && onAdjust !== undefined
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {SCRAP_TLS.map((tl) => {
        const value = scrapPoolBucket(pool, tl)
        return (
          <span
            key={tl}
            role="group"
            aria-label={`Tech ${tl} scrap: ${value}`}
            className="inline-flex items-stretch overflow-hidden rounded-[2px] border-chrome border-cargo-deep bg-paper"
          >
            <span className="flex items-center bg-cargo-deep px-1.5 font-cond text-micro font-bold uppercase leading-none text-su-white">
              T{tl}
            </span>
            <span className="flex min-w-7 items-center justify-center px-1.5 font-body text-sm font-bold leading-none text-cargo-deep">
              {value}
            </span>
            {editable && (
              <span className="flex items-center gap-1 border-l-chrome border-cargo-deep px-1 py-0.5">
                <StepBtn
                  aria-label={`Decrease Tech ${tl} scrap`}
                  disabled={value <= 0}
                  onClick={() => onAdjust(tl, -1)}
                >
                  &ndash;
                </StepBtn>
                <StepBtn aria-label={`Increase Tech ${tl} scrap`} onClick={() => onAdjust(tl, 1)}>
                  +
                </StepBtn>
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
