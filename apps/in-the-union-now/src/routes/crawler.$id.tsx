import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { ArrowLeft, Truck, Plus, Package, Trash2 } from 'lucide-react'
import { useCrawler, useUpdateCrawler } from '../hooks/useCrawler'
import { useEntityRefs, useUpdateEntityRef } from '../hooks/useEntityRefs'
import { useCargo, useCreateCargoItem, useDeleteCargoItem } from '../hooks/useCargo'
import {
  ResourceStepper,
  InlineEdit,
  ConditionControl,
  DEBOUNCE_TIMINGS,
  TECH_LEVELS,
  SCRAP_CONVERSION_RATES,
  UPKEEP_STEP,
  MAX_UPGRADE,
} from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import type { TechLevel } from 'suref-react'
import type { Crawler, ItemCondition } from '../types/common'

export const Route = createFileRoute('/crawler/$id')({
  component: CrawlerSheetPage,
})

function CrawlerSheetPage() {
  const { id } = Route.useParams()
  const { data: crawler, isLoading } = useCrawler(id)
  const updateCrawler = useUpdateCrawler(id)
  const { data: refs = [] } = useEntityRefs('crawler', id)
  const updateEntityRef = useUpdateEntityRef('crawler', id)
  const { data: cargo = [] } = useCargo('crawler', id)
  const createCargoItem = useCreateCargoItem('crawler', id)
  const deleteCargoItem = useDeleteCargoItem('crawler', id)

  const [newCargoName, setNewCargoName] = useState('')

  // Debounced crawler update
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleUpdate = useCallback(
    (field: string, value: unknown) => {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        updateCrawler.mutate({ [field]: value })
      }, DEBOUNCE_TIMINGS.autoSave)
    },
    [updateCrawler]
  )

  // Immediate update (for steppers)
  const handleImmediateUpdate = useCallback(
    (field: string, value: unknown) => {
      updateCrawler.mutate({ [field]: value })
    },
    [updateCrawler]
  )

  const handleConditionChange = useCallback(
    (refId: string, condition: ItemCondition) => {
      updateEntityRef.mutate({ id: refId, input: { condition } })
    },
    [updateEntityRef]
  )

  const handleAddCargo = () => {
    const name = newCargoName.trim()
    if (!name) return
    createCargoItem.mutate({ name, amount: 1 })
    setNewCargoName('')
  }

  const bays = refs.filter((r) => r.schema_name === 'crawler_bays')
  const crawlerAbilities = refs.filter((r) => r.schema_name === 'crawler_abilities')

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-crawler border-t-transparent" />
      </div>
    )
  }

  if (!crawler) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-su-grey">Crawler not found</p>
        <Link to="/" className="text-crawler underline">
          Back to roster
        </Link>
      </div>
    )
  }

  const currentSp = crawler.max_sp - crawler.current_damage

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col pb-12">
      {/* Back nav */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-su-grey-dark hover:text-crawler"
        >
          <ArrowLeft className="h-4 w-4" />
          Roster
        </Link>
      </div>

      {/* Crawler header */}
      <div className="border-b-2 border-crawler/30 bg-crawler/5 px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crawler/20 text-crawler">
            <Truck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <InlineEdit
              value={crawler.name}
              onSave={(v) => handleUpdate('name', v)}
              placeholder="Crawler name..."
              className="text-lg font-bold"
            />
            <div className="flex items-center gap-2">
              {crawler.crawler_ref && (
                <p className="text-xs text-su-grey-dark">
                  {getNameById('crawlers', crawler.crawler_ref)}
                </p>
              )}
              <span className="inline-flex items-center rounded-full bg-crawler/20 px-2 py-0.5 text-[10px] font-bold text-crawler">
                TL {crawler.tech_level}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SP tracking */}
      <div className="px-4 pt-4">
        <h3 className="mb-2 text-sm font-bold text-crawler">Structure Points</h3>
        <div className="flex items-center gap-3">
          <ResourceStepper
            label="Damage"
            current={crawler.current_damage}
            max={crawler.max_sp}
            onChange={(v) => handleImmediateUpdate('current_damage', v)}
            colorClass="text-crawler"
          />
          <span className="text-xs text-su-grey-dark">
            ({currentSp}/{crawler.max_sp} SP remaining)
          </span>
        </div>
        <div className="mt-2">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-su-grey-light/40">
            <div
              className="h-full rounded-full bg-crawler transition-all duration-200"
              style={{
                width: `${crawler.max_sp > 0 ? Math.max(0, (currentSp / crawler.max_sp) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Upkeep tracker */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-crawler">Upkeep</h3>
        <ResourceStepper
          label="Upkeep"
          current={crawler.upkeep}
          onChange={(v) => handleImmediateUpdate('upkeep', v)}
          colorClass="text-crawler"
          min={0}
        />
        <p className="mt-1 text-[10px] text-su-grey-dark">
          Step size: {UPKEEP_STEP} scrap per upkeep cycle
        </p>
      </div>

      {/* Upgrade tracker */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-crawler">Upgrades</h3>
        <ResourceStepper
          label="Level"
          current={crawler.upgrade_level}
          max={MAX_UPGRADE}
          onChange={(v) => handleImmediateUpdate('upgrade_level', v)}
          colorClass="text-crawler"
        />
      </div>

      {/* Scrap storage */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-crawler">Scrap Storage</h3>
        <div className="grid grid-cols-3 gap-2">
          {TECH_LEVELS.map((tl) => {
            const field = `scrap_tl${tl}` as keyof Crawler
            const amount = (crawler[field] as number) ?? 0
            const rate = SCRAP_CONVERSION_RATES[tl as TechLevel]
            return (
              <div
                key={tl}
                className="rounded-lg border border-crawler/30 bg-crawler/5 p-2 text-center"
              >
                <div className="mb-1 text-[10px] font-bold text-crawler">TL{tl}</div>
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleImmediateUpdate(`scrap_tl${tl}`, Math.max(0, amount - 1))}
                    disabled={amount <= 0}
                    className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] text-xs transition-colors hover:bg-su-grey-light/20 disabled:opacity-30"
                    aria-label={`Decrease TL${tl} scrap`}
                  >
                    -
                  </button>
                  <span className="min-w-[2ch] text-center text-lg font-bold tabular-nums">
                    {amount}
                  </span>
                  <button
                    onClick={() => handleImmediateUpdate(`scrap_tl${tl}`, amount + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] text-xs transition-colors hover:bg-su-grey-light/20"
                    aria-label={`Increase TL${tl} scrap`}
                  >
                    +
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-su-grey-dark">= {amount * rate} scrap</div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 text-right text-xs text-su-grey-dark">
          Total:{' '}
          <span className="font-bold text-crawler">
            {TECH_LEVELS.reduce((sum, tl) => {
              const field = `scrap_tl${tl}` as keyof Crawler
              const amount = (crawler[field] as number) ?? 0
              return sum + amount * SCRAP_CONVERSION_RATES[tl as TechLevel]
            }, 0)}{' '}
            scrap
          </span>
        </div>
      </div>

      {/* Crawler bays */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-crawler">Bays ({bays.length})</h3>
        {bays.length === 0 ? (
          <p className="text-xs italic text-su-grey">No bays installed</p>
        ) : (
          <div className="space-y-2">
            {bays.map((bay) => (
              <div
                key={bay.id}
                className="flex items-center justify-between rounded-lg border border-crawler/30 bg-crawler/5 px-3 py-2"
              >
                <span className="text-sm">{bay.schema_ref_id}</span>
                <ConditionControl
                  condition={bay.condition as ItemCondition}
                  onChange={(condition) => handleConditionChange(bay.id, condition)}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crawler abilities */}
      {crawlerAbilities.length > 0 && (
        <div className="px-4 pt-6">
          <h3 className="mb-2 text-sm font-bold text-crawler">
            Abilities ({crawlerAbilities.length})
          </h3>
          <div className="space-y-2">
            {crawlerAbilities.map((ability) => (
              <div
                key={ability.id}
                className="flex items-center justify-between rounded-lg border border-crawler/30 bg-crawler/5 px-3 py-2"
              >
                <span className="text-sm">{ability.schema_ref_id}</span>
                <ConditionControl
                  condition={ability.condition as ItemCondition}
                  onChange={(condition) => handleConditionChange(ability.id, condition)}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cargo */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-crawler">
          <Package className="mr-1 inline-block h-4 w-4" />
          Cargo ({cargo.length})
        </h3>
        {cargo.length > 0 && (
          <div className="mb-3 space-y-1">
            {cargo.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="flex-1 text-sm">{item.name || item.schema_ref_id || 'Item'}</span>
                <span className="text-xs text-su-grey-dark">x{item.amount}</span>
                <button
                  onClick={() => deleteCargoItem.mutate(item.id)}
                  className="rounded p-1 text-su-grey-dark transition-colors hover:bg-destroyed/10 hover:text-destroyed"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCargoName}
            onChange={(e) => setNewCargoName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCargo()}
            placeholder="Add cargo item..."
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm placeholder:text-su-grey focus:outline-none focus:ring-1 focus:ring-crawler"
          />
          <button
            onClick={handleAddCargo}
            disabled={!newCargoName.trim()}
            className="flex items-center gap-1 rounded-md bg-crawler px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Description + Notes */}
      <div className="space-y-3 px-4 pt-6 pb-4">
        <div>
          <label className="text-xs font-medium text-su-grey-dark">Description</label>
          <InlineEdit
            value={crawler.description}
            onSave={(v) => handleUpdate('description', v)}
            placeholder="Crawler description..."
            className="text-sm"
            multiline
          />
        </div>
        <div>
          <label className="text-xs font-medium text-su-grey-dark">Notes</label>
          <InlineEdit
            value={crawler.notes}
            onSave={(v) => handleUpdate('notes', v)}
            placeholder="Notes..."
            className="text-sm"
            multiline
          />
        </div>
      </div>
    </div>
  )
}
