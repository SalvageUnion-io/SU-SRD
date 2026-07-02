/**
 * CrawlerSheet — the crawler variant body on the LiveSheet shell (design
 * §4.4, plan 4.6). The hero (SP/Bays trackers, UPKEEP/UPGRADE/CREW specs,
 * rail) lives in Sheet.tsx; this renders the body slabs:
 *
 *   - Crawler Bays — Erow'd entity cards (cb accent), each with its crew
 *     lead as an NpcInset `expand`, a status badge (Intact/Damaged ONLY,
 *     rules C8) and a function/Repair action pair. A Damaged bay disables
 *     its function action and promotes Repair to primary; Repair decrements
 *     5 Scrap from the crawler-TL pool bucket, spilling into higher buckets
 *     (rules: TL+ scrap allowed) — a short pool is advisory, never a block
 *     (S12).
 *   - Crawler Systems — proper entity cards [gap 20], not raw slugs.
 *   - Scrap Pool — 6 editable TL buckets as cargo-toned spec lozenges
 *     (rules C5: the party economy).
 *   - The Hold — unlimited StorageManifest (side='crawler'); ← Load is
 *     cap-checked against the docked mech, bulk lots partial-fill ('Load N').
 *
 * readOnly suppresses every edit affordance (snapshot contexts).
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Btn, ReferenceEntityDisplay, Slab, StepBtn, useDetailModal } from 'suref-react'
import type { CardFootMeta, ChoiceSelections } from 'suref-react'

import { cn } from '../../lib/utils'
import { addToScrapPool, scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { useCargo } from '../../lib/cargo/useCargo'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { findNpcChoiceByName, resolveCrawlerBay, resolveCrawlerType } from '../../lib/crawlerRefs'
import type { Crawler, ScrapPool } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { useEntityChoices } from '../shared/useEntityChoices'
import { CraftingControl } from './CraftingControl'
import { Ecflow, Erow } from './Erow'
import { NpcInset } from './NpcInset'
import { SalvageControl } from './SalvageControl'
import { StorageManifest } from './StorageManifest'

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/** Resolve a stored crawler-system ref (id or name) to its SRD entity [gap 20]. */
function resolveCrawlerSystem(ref: string): SURefEntity | null {
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
const BAY_REPAIR_COST = 5

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

/** Stable hide literal — the bay's long rules text lives in the detail modal. */
const HIDE_BAY_CONTENT = { content: true } as const

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
function CrawlerBayCard({
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
}

/**
 * CrawlerTypeCard — the chosen crawler type as an entity card (description +
 * special action(s)), with its special NPC rendered as an NpcInset in the
 * expand slot. Mirrors CrawlerBayCard: the SRD npc block is stripped from the
 * card (it lives in the inset); Keepsake/Motto persist through the NPC's
 * freeform choices into the crawler's bayChoices map keyed by the type ref;
 * structured name/HP/description/facts persist into the `typeNpc` field.
 */
function CrawlerTypeCard({
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

const SCRAP_TLS = [1, 2, 3, 4, 5, 6] as const

/**
 * ScrapPoolSlab — the shared party scrap pool as six editable TL-bucket
 * lozenges with `--cargo` semantics (design-review item, rules C5).
 */
function ScrapPoolSlab({ pool, onAdjust, readOnly }: ScrapPoolSlabProps) {
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
            <span className="flex items-center bg-cargo-deep px-1.5 font-cond text-[9.5px] font-bold uppercase leading-none text-su-white">
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

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * The docked mech (the lead pilot's mech, resolved by the composition
   * resolver) — the Hold's ← Load target. Null when nothing is docked.
   */
  mech?: Mech | null
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
  /** Suppresses every edit affordance (published snapshots). */
  readOnly?: boolean
}

export function CrawlerSheet({
  crawler,
  mech = null,
  store = useEntityStore,
  readOnly = false,
}: CrawlerSheetProps) {
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const bays = crawler.crawlerBays ?? []
  const intactBays = bays.filter((b) => (b.condition ?? 'intact') === 'intact').length
  const pool = crawler.scrapPool ?? {}
  const totalScrap = SCRAP_TLS.reduce((sum, t) => sum + scrapPoolBucket(pool, t), 0)
  const lots = crawler.cargoLots ?? []

  // Repair affordability is advisory only — TL+ buckets count (S12).
  const repairable = SCRAP_TLS.filter((t) => t >= tl).reduce(
    (sum, t) => sum + scrapPoolBucket(pool, t),
    0
  )
  const repairShortfall = Math.max(0, BAY_REPAIR_COST - repairable)

  /**
   * Repair a damaged bay: decrement 5 Scrap starting at the crawler-TL
   * bucket, spilling into higher buckets, then flip the bay Intact. A short
   * pool still repairs — the shortfall is surfaced on the button, never a
   * block (S12).
   */
  function repairBay(entry: CrawlerBayEntry, index: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    let nextPool: ScrapPool = { ...(fresh.scrapPool ?? {}) }
    let remaining = BAY_REPAIR_COST
    for (let t = tl; t <= 6 && remaining > 0; t++) {
      const take = Math.min(scrapPoolBucket(nextPool, t), remaining)
      if (take > 0) {
        nextPool = addToScrapPool(nextPool, t, -take)
        remaining -= take
      }
    }
    void storeState.update('crawler', crawler.id, { scrapPool: nextPool })
    void storeState.updateCrawlerBay(crawler.id, entry.bayRef, { condition: 'intact' }, index)
  }

  /** Hand-edit one scrap bucket (±1), reading the freshest pool at call time. */
  function adjustScrapBucket(bucketTl: number, delta: number) {
    if (readOnly) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    void storeState.update('crawler', crawler.id, {
      scrapPool: addToScrapPool(fresh.scrapPool ?? {}, bucketTl, delta),
    })
  }

  /** Set the crawler's tech level (1–6), recomputing SP/capacity downstream. */
  function setTechLevel(next: number) {
    if (readOnly) return
    if (next < 1 || next > 6 || next === tl) return
    void storeState.update('crawler', crawler.id, { techLevel: `tech-${next}` })
  }

  const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

  return (
    <section aria-label={`${crawler.name} crawler sheet`} className="flex flex-col gap-7">
      {/* Crawler Type — only when a type was chosen (legacy crawlers have none) */}
      {crawler.type && (
        <div>
          <Slab label="Crawler Type" count="special action + special NPC" />
          <Ecflow>
            <Erow>
              <CrawlerTypeCard
                crawlerId={crawler.id}
                typeRef={crawler.type}
                typeNpc={crawler.typeNpc}
                seedSelections={crawler.bayChoices?.[crawler.type]}
                store={store}
                readOnly={readOnly}
              />
            </Erow>
          </Ecflow>
        </div>
      )}

      {/* Tech Level — editable stepper (rules: upgraded on the live sheet) */}
      <div>
        <Slab label="Tech Level" count={`Tech ${tl} crawler`} />
        {readOnly ? (
          <p className="font-body text-sm text-ink">Tech Level {tl}</p>
        ) : (
          <div
            role="group"
            aria-label="Crawler tech level"
            className="inline-flex items-stretch overflow-hidden rounded-[2px] border-chrome border-ink bg-paper"
          >
            {TECH_LEVELS.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Set tech level ${n}`}
                aria-pressed={n === tl}
                onClick={() => setTechLevel(n)}
                className={cn(
                  'min-w-9 px-2 py-1 font-cond text-sm font-bold leading-none',
                  n === tl ? 'bg-ink text-su-white' : 'text-ink hover:bg-su-paper'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Crawler Bays */}
      {bays.length > 0 && (
        <div>
          <Slab
            label="Crawler Bays"
            count={`${intactBays} of ${bays.length} intact · each run by its own crew`}
          />
          <Ecflow>
            {bays.map((entry, i) => (
              <Erow key={`${entry.bayRef}-${i}`}>
                <CrawlerBayCard
                  crawlerId={crawler.id}
                  entry={entry}
                  index={i}
                  crawlerTl={tl}
                  repairShortfall={repairShortfall}
                  onRepair={repairBay}
                  seedSelections={crawler.bayChoices?.[entry.bayRef]}
                  store={store}
                  readOnly={readOnly}
                />
              </Erow>
            ))}
          </Ecflow>
        </div>
      )}

      {/* Crawler Systems — proper entity cards [gap 20] */}
      {crawler.systems.length > 0 && (
        <div>
          <Slab label="Crawler Systems" count={`${crawler.systems.length}`} />
          <Ecflow>
            {crawler.systems.map((slug) => {
              const system = resolveCrawlerSystem(slug)
              return (
                <Erow key={slug}>
                  {system ? (
                    <ReferenceEntityDisplay data={system} compact />
                  ) : (
                    <div className="rounded border border-ink px-2 py-1 text-sm text-wk-muted">
                      {slug}
                    </div>
                  )}
                </Erow>
              )
            })}
          </Ecflow>
        </div>
      )}

      {/* Scrap Pool — the shared party economy (rules C5) */}
      <div>
        <Slab label="Scrap Pool" count={`${totalScrap} scrap · Tech ${tl} crawler`} />
        <ScrapPoolSlab
          pool={pool}
          onAdjust={readOnly ? undefined : adjustScrapBucket}
          readOnly={readOnly}
        />
      </div>

      {/* Salvaging — Area + Mech Salvage rollers (design-review R-3, pp.244-248).
          Live-play only: rolls are ephemeral, so snapshots have nothing to show. */}
      {!readOnly && (
        <div>
          <Slab label="Salvaging" count="Area & Mech Salvage · deposits to the pool and hold" />
          <SalvageControl crawler={crawler} store={store} />
        </div>
      )}

      {/* Crafting — the Crafting Bay flow (design-review R-7, p.222/p.244).
          Live-play only: crafting writes only pool/hold bookkeeping. */}
      {!readOnly && (
        <div>
          <Slab label="Crafting" count="salvage-value cost · deducts the pool, fills the hold" />
          <CraftingControl crawler={crawler} store={store} />
        </div>
      )}

      {/* The Hold — unlimited crawler storage (rules C6) */}
      <div>
        <Slab
          label="The Hold"
          count={`${lots.length} ${lots.length === 1 ? 'lot' : 'lots'} · unlimited`}
        />
        <StorageManifest
          side="crawler"
          cargo={cargo}
          mechName={mech?.name ?? null}
          crawlerName={crawler.name}
          readOnly={readOnly}
        />
      </div>
    </section>
  )
}
