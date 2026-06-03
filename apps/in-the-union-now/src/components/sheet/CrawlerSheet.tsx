/**
 * CrawlerSheet — read-only crawler section for the sheet view.
 *
 * Renders: crawler name + tech level, crawler bays (with editable per-bay NPC
 * HP), systems, and pilot roster. When no pilots are wired, renders
 * CrawlerPilotsStandIn.
 *
 * Pilot data is dep-injectable for testing via the `pilots` prop.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { ChoiceSelections } from 'suref-react'

import type { Crawler } from '../../lib/schemas/crawler'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerPilotsStandIn } from '../shared/CrawlerPilotsStandIn'
import { useEntityChoices } from '../shared/useEntityChoices'
import { EditableStatRow } from './EditableStatRow'
import { InlineEditField } from './InlineEditField'
import { PipTracker } from './PipTracker'
import { SheetSectionHeading } from './SheetSectionHeading'

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

type ResolvedBay = { id: string; name: string; npc?: { hitPoints?: number } }

/** Resolve a stored crawler-bay ref (id or name) to its SRD entity. */
function resolveCrawlerBay(ref: string): ResolvedBay | null {
  try {
    const all = SalvageUnionReference.CrawlerBays.all() as ReadonlyArray<ResolvedBay>
    return all.find((b) => b.id === ref || b.name === ref) ?? null
  } catch {
    return null
  }
}

/**
 * Resolve a crawler's max Structure Points from its tech level. The stored
 * techLevel is a slug like "tech-3"; crawler-tech-levels data exposes the
 * structurePoints per level (20/25/30/35/40/50 for I–VI).
 */
function resolveCrawlerMaxSP(techLevel: string): number {
  try {
    const n = Number.parseInt(techLevel.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(n)) return 0
    const all = SalvageUnionReference.CrawlerTechLevels.all() as ReadonlyArray<{
      techLevel: number
      structurePoints: number
    }>
    return all.find((t) => t.techLevel === n)?.structurePoints ?? 0
  } catch {
    return 0
  }
}

/**
 * CrawlerBayCard — a single installed crawler bay rendered as a pink entity
 * card with its embedded NPC. The NPC's name + current HP are editable and
 * persist back onto the crawler's `crawlerBays` array.
 */
function CrawlerBayCard({
  crawlerId,
  entry,
  index,
  bays,
  seedSelections,
  store,
  readOnly,
}: {
  crawlerId: string
  entry: CrawlerBayEntry
  index: number
  bays: CrawlerBayEntry[]
  /**
   * Persisted choice selections for this bay, sourced from the canonical crawler
   * prop (keyed by `entry.bayRef`). Used directly as the controlled `selections`
   * so read-only/snapshot rendering does not depend on the live store.
   */
  seedSelections: ChoiceSelections | undefined
  store: typeof useEntityStore
  readOnly: boolean
}) {
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
  if (!bay) {
    return (
      <div className="rounded border border-border px-2 py-1 text-sm text-muted-foreground">
        {entry.bayRef}
      </div>
    )
  }

  const maxHP = bay.npc?.hitPoints ?? 0
  const currentHP = entry.npcCurrentHP ?? maxHP

  function patchEntry(patch: Partial<CrawlerBayEntry>) {
    // Read the freshest crawlerBays array from the store (not the render-time
    // `bays` prop) so concurrent edits to different bays/fields don't clobber
    // each other — the db layer merges only at the top level, replacing the
    // whole array. Mirrors the sibling freshest-read writers (PilotSheet,
    // MechSheet, HeatCheckControl). Target the entry by bayRef + index so
    // matching is stable even if entries share a bayRef.
    const fresh = storeState.get('crawler', crawlerId)?.crawlerBays ?? bays
    const next = fresh.map((b, i) =>
      i === index && b.bayRef === entry.bayRef ? { ...b, ...patch } : b
    )
    void storeState.update('crawler', crawlerId, { crawlerBays: next })
  }

  const hpSlot =
    maxHP > 0 ? (
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
          HP
        </span>
        <div className="flex items-baseline gap-0.5 font-mono">
          <InlineEditField
            value={currentHP}
            onSave={(next) => patchEntry({ npcCurrentHP: Number(next) })}
            type="number"
            min={0}
            max={maxHP}
            ariaLabel={`Edit ${bay.name} NPC HP`}
            readOnly={readOnly}
          />
          <span className="text-su-ink-soft">/ {maxHP}</span>
        </div>
      </div>
    ) : undefined

  return (
    <ReferenceEntityDisplay
      data={bay as unknown as SURefEntity}
      compact
      selections={selections}
      onSelectionChange={readOnly ? undefined : setSelections}
      npcConfig={{
        hpSlot,
        name: entry.npcName ?? '',
        onNameChange: readOnly ? undefined : (name) => patchEntry({ npcName: name }),
        readOnly,
        damaged: maxHP > 0 && currentHP <= 0,
      }}
    />
  )
}

type CrawlerSheetProps = {
  crawler: Crawler
  /**
   * Resolved pilot records for the pilots wired to this crawler.
   * When empty, renders the stand-in placeholder.
   */
  pilots?: Pilot[]
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
  /**
   * When true, stat cells render as plain text with no click-to-edit affordance.
   * Use in read-only contexts like published snapshots.
   */
  readOnly?: boolean
}

export function CrawlerSheet({
  crawler,
  pilots = [],
  store = useEntityStore,
  readOnly = false,
}: CrawlerSheetProps) {
  const maxSP = resolveCrawlerMaxSP(crawler.techLevel)
  return (
    <section aria-labelledby="crawler-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2
          id="crawler-sheet-heading"
          className="font-cond text-xl font-bold uppercase tracking-wide text-su-black"
        >
          {crawler.name}
        </h2>
        <p className="text-sm text-muted-foreground">Tech Level: {crawler.techLevel}</p>
      </div>

      {/* Stats — SP (live-play tracking, #245) */}
      <div>
        <SheetSectionHeading kind="crawler">Stats</SheetSectionHeading>
        <dl className="grid grid-cols-1 gap-2">
          <div className="flex min-h-16 flex-col items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper py-2 text-center">
            <dt className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
              SP
            </dt>
            <dd className="font-mono text-lg font-bold text-su-black">
              <EditableStatRow
                label="SP"
                value={crawler.currentSP ?? maxSP}
                entityKind="crawler"
                entityId={crawler.id}
                fieldPath="currentSP"
                min={0}
                store={store}
                readOnly={readOnly}
              />
            </dd>
            <PipTracker
              max={maxSP}
              value={crawler.currentSP ?? maxSP}
              tone="hp"
              ariaLabel={`SP ${crawler.currentSP ?? maxSP} of ${maxSP}`}
              className="mt-1.5"
            />
          </div>
        </dl>
      </div>

      {/* Crawler Bays — installed SRD bays as pink cards, each with its NPC and
          an editable HP tracker. */}
      {(crawler.crawlerBays ?? []).length > 0 && (
        <div>
          <SheetSectionHeading kind="crawler">Crawler Bays</SheetSectionHeading>
          <div className="flex flex-col gap-3">
            {(crawler.crawlerBays ?? []).map((entry, i) => (
              <CrawlerBayCard
                key={`${entry.bayRef}-${i}`}
                crawlerId={crawler.id}
                entry={entry}
                index={i}
                bays={crawler.crawlerBays ?? []}
                seedSelections={crawler.bayChoices?.[entry.bayRef]}
                store={store}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}

      {/* Systems */}
      {crawler.systems.length > 0 && (
        <div>
          <SheetSectionHeading kind="crawler" className="mb-1">
            Systems
          </SheetSectionHeading>
          <ul className="flex flex-col gap-1">
            {crawler.systems.map((slug) => (
              <li key={slug} className="rounded border border-border px-2 py-1 text-sm">
                {slug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pilot Roster */}
      <div>
        <SheetSectionHeading kind="crawler" className="mb-1">
          Pilot Roster
        </SheetSectionHeading>
        {pilots.length === 0 ? (
          <CrawlerPilotsStandIn />
        ) : (
          <ul className="flex flex-col gap-1">
            {pilots.map((pilot) => (
              <li key={pilot.id} className="rounded border border-border px-2 py-1 text-sm">
                {pilot.callsign ? `"${pilot.callsign}" ` : ''}
                {pilot.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
