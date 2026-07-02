/**
 * CraftingControl — the Crafting Bay flow on the crawler sheet
 * (design-review R-7; Core Book p.222 + p.244).
 *
 * Pick any Chassis/System/Module at the crawler's Tech Level or lower from a
 * searchable compact listing; crafting costs the item's Salvage Value in
 * Scrap of its Tech Level or higher, drawn from the shared pool (lowest
 * qualifying bucket first). A confirm dialog shows the full cost breakdown;
 * on confirm the pool is deducted and the crafted item lands in the hold as
 * an Intact lot.
 *
 * Gates (p.222): the Crafting Bay must be installed and not Damaged. The
 * "during Downtime only" rule is the honor system (ADR-001) — surfaced as
 * copy, never enforced. ADR-007: the deduction + hold deposit are pure
 * bookkeeping and auto-apply on confirm; WHAT to craft is entirely the
 * player's pick.
 *
 * Pure quote/lot logic lives in lib/rules/crafting.ts.
 */

import { useId, useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn } from 'suref-react'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { CRAFTING_BAY, craftQuote, craftedLot } from '../../lib/rules/crafting'
import type { CraftableItem } from '../../lib/rules/crafting'
import { bayGate } from '../../lib/rules/crawlerEconomy'
import type { Crawler } from '../../lib/schemas/crawler'
import { useEntityStore } from '../../stores/entityStore'
import { ConfirmDialog } from '../shared/ConfirmDialog'

/** Minimal shape read off the reference models for catalog entries. */
type RefItem = {
  id: string
  name: string
  techLevel?: unknown
  salvageValue?: unknown
}

type CatalogKind = 'chassis' | 'system' | 'module'

type CatalogEntry = CraftableItem & {
  key: string
  kind: CatalogKind
}

const KIND_LABEL: Record<CatalogKind, string> = {
  chassis: 'Chassis',
  system: 'System',
  module: 'Module',
}

/** Cap on rendered matches — refine the search past this. */
const MAX_RESULTS = 30

/** Read a reference model defensively — empty when data isn't preloaded (tests). */
function loadRef(all: () => ReadonlyArray<unknown>): RefItem[] {
  try {
    return (all() as ReadonlyArray<RefItem>).slice()
  } catch {
    return []
  }
}

function numericTl(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : undefined
}

/** Flatten one reference model into craftable catalog entries (numeric TL only). */
function toEntries(kind: CatalogKind, items: RefItem[]): CatalogEntry[] {
  return items.flatMap((item) => {
    const tl = numericTl(item.techLevel)
    if (tl === undefined) return []
    return [
      {
        key: `${kind}:${item.id}`,
        kind,
        name: item.name,
        techLevel: tl,
        salvageValue: typeof item.salvageValue === 'number' ? item.salvageValue : 1,
      },
    ]
  })
}

type CraftingControlProps = {
  crawler: Crawler
  /** Injectable store — defaults to useEntityStore. */
  store?: typeof useEntityStore
}

export function CraftingControl({ crawler, store = useEntityStore }: CraftingControlProps) {
  const storeState = store()
  const searchId = useId()

  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<CatalogEntry | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const gate = bayGate(crawler, CRAFTING_BAY)
  const pool = crawler.scrapPool ?? {}

  // The craftable catalog: every Chassis/System/Module at crawler TL or lower
  // (p.222), sorted TL-then-name. Reference data is static — load once.
  const catalog = useMemo(() => {
    const entries = [
      ...toEntries(
        'chassis',
        loadRef(() => SalvageUnionReference.Chassis.all())
      ),
      ...toEntries(
        'system',
        loadRef(() => SalvageUnionReference.Systems.all())
      ),
      ...toEntries(
        'module',
        loadRef(() => SalvageUnionReference.Modules.all())
      ),
    ]
    return entries.sort((a, b) => a.techLevel - b.techLevel || a.name.localeCompare(b.name))
  }, [])

  const craftable = useMemo(() => catalog.filter((e) => e.techLevel <= tl), [catalog, tl])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return craftable
    return craftable.filter((e) => e.name.toLowerCase().includes(q))
  }, [craftable, query])

  const shown = matches.slice(0, MAX_RESULTS)

  // The live quote for the pending pick (recomputed on confirm from the
  // freshest record — this one only renders the dialog).
  const pendingQuote = pending ? craftQuote(pending, pool, tl) : null

  /** Deduct the pool and deposit the Intact lot — one write (ADR-008). */
  async function handleCraft() {
    if (!pending) return
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    const freshTl = parseCrawlerTechLevel(fresh.techLevel) ?? 1
    const quote = craftQuote(pending, fresh.scrapPool ?? {}, freshTl)
    if (!quote.eligible || !quote.affordable) {
      setNote('The pool no longer covers that craft.')
      setPending(null)
      return
    }
    await storeState.update('crawler', crawler.id, {
      scrapPool: quote.pool,
      cargoLots: [craftedLot(pending), ...(fresh.cargoLots ?? [])],
    })
    const drawText = quote.draws.map((d) => `${d.count}× T${d.tl}`).join(' + ')
    setNote(`Crafted ${pending.name} (${drawText}) — added to the hold, Intact.`)
    setPending(null)
  }

  if (!gate.present) {
    return (
      <p className="m-0 font-body text-sm text-wk-muted">
        No Crafting Bay is installed on this crawler.
      </p>
    )
  }

  if (gate.damaged) {
    return (
      <p
        role="alert"
        className="m-0 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2 font-body text-sm text-rust"
      >
        The Crafting Bay is Damaged — nothing can be crafted until it is repaired to Intact (p.222).
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-[3px] border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-2 bg-ink px-3 py-1.5">
        <span className="font-cond text-xs font-bold uppercase tracking-wider text-su-white">
          Crafting Bay
        </span>
        <span className="font-cond text-xs uppercase text-su-white/60">
          Downtime only · Tech {tl} or lower
        </span>
      </div>

      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        <p className="m-0 font-body text-sm text-wk-muted">
          Crafting costs an item&rsquo;s Salvage Value in Scrap of its Tech Level or higher (p.244),
          drawn from the pool. The crafted item lands in the hold, Intact.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={searchId} className="font-cond text-xs font-bold uppercase text-ink">
            Search the catalog
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chassis, System, or Module name…"
            className="w-full rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-wk-muted focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
          />
        </div>

        {shown.length === 0 ? (
          <p className="m-0 font-body text-sm text-wk-muted">
            No craftable match — only Tech {tl} or lower can be crafted here.
          </p>
        ) : (
          <ul className="m-0 flex max-h-64 list-none flex-col gap-1 overflow-y-auto p-0">
            {shown.map((entry) => (
              <li key={entry.key} className="m-0">
                <div className="flex items-center gap-2 rounded-[3px] border-chrome border-ink/40 px-2 py-1">
                  <span className="rounded-[2px] bg-ink px-1.5 py-0.5 font-cond text-xs font-bold uppercase leading-none text-su-white">
                    T{entry.techLevel}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">
                    {entry.name}
                    <span className="text-wk-muted"> · {KIND_LABEL[entry.kind]}</span>
                  </span>
                  <span className="font-cond text-xs font-bold uppercase text-wk-muted">
                    {entry.salvageValue} Scrap
                  </span>
                  <Btn
                    size="sm"
                    variant="primary"
                    aria-label={`Craft ${entry.name}`}
                    onClick={() => setPending(entry)}
                  >
                    Craft
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
        {matches.length > MAX_RESULTS && (
          <p className="m-0 font-body text-xs text-wk-muted">
            Showing {MAX_RESULTS} of {matches.length} matches — refine the search.
          </p>
        )}

        {note && (
          <p role="status" className="m-0 font-body text-sm text-ink">
            {note}
          </p>
        )}
      </div>

      {pending && pendingQuote && (
        <ConfirmDialog
          open
          title={`Craft ${pending.name}?`}
          confirmLabel="Craft"
          confirmDisabled={!pendingQuote.affordable}
          onConfirm={() => {
            void handleCraft()
          }}
          onCancel={() => setPending(null)}
        >
          <div className="flex flex-col gap-2">
            <p className="m-0">
              Crafting a Tech {pending.techLevel} {KIND_LABEL[pending.kind].toLowerCase()} costs its
              Salvage Value — <strong>{pendingQuote.cost} Scrap</strong> of Tech {pending.techLevel}{' '}
              or higher (p.244).
            </p>
            {pendingQuote.affordable ? (
              <p className="m-0">
                Draws{' '}
                <strong>
                  {pendingQuote.draws.map((d) => `${d.count}× T${d.tl}`).join(' + ') || 'nothing'}
                </strong>{' '}
                from the pool. {pending.name} lands in the hold, Intact.
              </p>
            ) : (
              <p className="m-0 text-rust" role="alert">
                The pool is {pendingQuote.shortfall} Scrap short at Tech {pending.techLevel}+. Trade
                Scrap between Tech Levels at the Trading Bay first.
              </p>
            )}
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
