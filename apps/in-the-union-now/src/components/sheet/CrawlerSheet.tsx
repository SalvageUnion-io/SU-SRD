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

import { crawlerMaxSP } from '../../lib/rules/derivedStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerPilotsStandIn } from '../shared/CrawlerPilotsStandIn'
import { useEntityChoices } from '../shared/useEntityChoices'
import { EditableStatRow } from './EditableStatRow'
import { InlineEditField } from './InlineEditField'
import { InlineEditTextArea } from './InlineEditTextArea'
import { NpcFactsEditor } from './NpcFactsEditor'
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
 * CrawlerBayCard — a single installed crawler bay rendered as a pink entity
 * card with its embedded NPC. The NPC's name + current HP are editable and
 * persist back onto the crawler's `crawlerBays` array.
 */
function CrawlerBayCard({
  crawlerId,
  entry,
  index,
  seedSelections,
  store,
  readOnly,
}: {
  crawlerId: string
  entry: CrawlerBayEntry
  index: number
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
    // Per-bay merge at the store level (plan 2.7): updateCrawlerBay re-reads
    // the freshest persisted record and patches only this entry, so
    // concurrent edits to different bays — including from another tab — don't
    // clobber each other with whole-array writes. index disambiguates
    // duplicate bayRefs.
    void storeState.updateCrawlerBay(crawlerId, entry.bayRef, patch, index)
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

  const npcLabel = bay.name
  const npcFacts = entry.npcFacts ?? []

  // Editable NPC fields rendered below the SRD bay rules text + NPC block. The
  // bay's own rules description (`content`) is surfaced read-only by
  // ReferenceEntityDisplay's compact content rendering.
  const afterContent = (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
          NPC Description
        </span>
        <InlineEditTextArea
          value={entry.npcDescription ?? ''}
          onSave={(next) => patchEntry({ npcDescription: next })}
          ariaLabel={`Edit ${npcLabel} NPC description`}
          readOnly={readOnly}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
          NPC Facts
        </span>
        <NpcFactsEditor
          facts={npcFacts}
          onChange={(next) => patchEntry({ npcFacts: next })}
          npcLabel={npcLabel}
          readOnly={readOnly}
        />
      </div>
    </div>
  )

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
        afterContent,
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
  const maxSP = crawlerMaxSP(crawler)
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
