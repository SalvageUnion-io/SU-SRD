import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  DisplayCard,
  CardHeader,
  Text,
  ValueDisplay,
  SectionSeparator,
  StatDisplay,
  navigateControl,
} from 'suref-react'
import type { ReferenceEntityControl, StatItem, DisplayCardTab } from 'suref-react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { ReferenceEntityDisplay } from 'suref-react'
import { SheetFooter } from '../shared/SheetFooter'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { CrawlerScrapStats } from './CrawlerStatsSection'
import { CrawlerBaysSection } from './CrawlerBaysSection'
import { CrawlerStorageSection } from './CrawlerStorageSection'
import { ScrapTranslationDialog } from './ScrapTranslationDialog'
import { WeaponSelectionDialog } from './WeaponSelectionDialog'
import { CrawlerTypeSection } from './CrawlerTypeSection'
import { CrawlerPilotsSection } from './CrawlerPilotsSection'
import { DowntimeGuideView } from './downtime/DowntimeGuideView'
import { GameLogTimeline } from './GameLogTimeline'
import type { CrawlerEditConfig, WeaponSlot } from '../../hooks/useCrawlerSheet'
import type { CampaignRow, CrawlerRow, DowntimeRecordRow, EntityRefRow } from '../../types/common'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference, findCrawlerTechLevel } from 'salvageunion-reference'

type PlayerCrawlerDisplayProps = {
  game: CampaignRow
  crawler?: CrawlerRow | null
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
  /** Render in read-only mode: hides all edit controls, footer, and mutation triggers */
  readOnly?: boolean
  // Sheet data (only needed when !listing)
  crawlerType?: SURefEntity | null
  tlStats?: { max_sp: number; upkeep: number; upgrade_cost: number | null }
  populationStr?: string
  weaponRefs?: EntityRefRow[]
  userId?: string
  activeDowntime?: DowntimeRecordRow | null
  editConfig?: CrawlerEditConfig
}

export function PlayerCrawlerDisplay({
  game,
  crawler,
  listing = true,
  compact = true,
  controls: controlsProp,
  readOnly = false,
  crawlerType: crawlerTypeProp,
  tlStats,
  populationStr,
  weaponRefs,
  userId,
  activeDowntime,
  editConfig: editConfigProp,
}: PlayerCrawlerDisplayProps) {
  const editConfig = readOnly ? undefined : editConfigProp
  const navigate = useNavigate()

  const handleNavigateToGame = useCallback(() => {
    navigate({ to: '/games/$gameId', params: { gameId: game.id } })
  }, [navigate, game.id])

  const handleNavigateToCrawler = useCallback(() => {
    navigate({ to: '/games/$gameId/crawler', params: { gameId: game.id } })
  }, [navigate, game.id])

  // --- Transient UI state (owned by display component, not the hook) ---
  const [showDelete, setShowDelete] = useState(false)
  const [showTranslateDialog, setShowTranslateDialog] = useState(false)
  const [editingWeaponSlot, setEditingWeaponSlot] = useState<WeaponSlot | null>(null)

  // Build weapon slot controls from raw data provided by hook
  const weaponSlotControls = useMemo((): ReferenceEntityControl[] => {
    if (!editConfig?.isMed) return []
    const controls: ReferenceEntityControl[] = (editConfig.weaponSystems ?? []).map(
      ({ ref, entity }) => ({
        key: `weapon-${ref.sort_order}`,
        label: entity?.name ?? 'Unknown',
        onClick: () => setEditingWeaponSlot({ index: ref.sort_order, oldRefId: ref.id }),
        ariaLabel: entity?.name ?? 'Unknown weapon',
        hoverContent: entity ? <ReferenceEntityDisplay data={entity} compact /> : undefined,
      })
    )
    const filledCount = editConfig.weaponSystems?.length ?? 0
    const slotCount = editConfig.weaponSlotCount ?? 0
    for (let i = filledCount; i < slotCount; i++) {
      controls.push({
        key: `weapon-empty-${i}`,
        label: 'Add',
        onClick: () => setEditingWeaponSlot({ index: i, oldRefId: null }),
        ariaLabel: 'Add weapon system',
        variant: 'primary' as const,
      })
    }
    return controls
  }, [editConfig?.isMed, editConfig?.weaponSystems, editConfig?.weaponSlotCount])

  // --- Crawler header stats ---
  const crawlerStats: StatItem[] | undefined = useMemo(() => {
    if (!crawler) return undefined
    if (listing) {
      return [
        {
          key: 'sp',
          label: 'SP',
          value: crawler.current_sp,
          outOfMax: crawler.max_sp,
        },
      ]
    }
    return [
      {
        key: 'sp',
        label: 'SP',
        value: crawler.current_sp,
        outOfMax: crawler.max_sp,
        ...(editConfig
          ? {
              onChange: (v: number) => editConfig.onImmediateUpdate({ current_sp: v }),
              canEdit: editConfig.isMed,
            }
          : {}),
      },
    ]
  }, [listing, crawler, editConfig, tlStats])

  // --- Tabs (only used in non-listing mode) ---
  const CRAWLER_TAB_COLOR = 'rgb(201, 111, 146)'
  const isReadOnlySheet = readOnly || !editConfig
  const tabs = useMemo((): DisplayCardTab[] | undefined => {
    if (listing || !crawler) return undefined
    return [
      {
        key: 'downtime',
        label: 'Downtime',
        activeColor: 'rgb(206, 88, 152)',
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            {activeDowntime && crawler ? (
              <DowntimeGuideView
                mode="mediator"
                crawlerId={crawler.id}
                crawler={crawler}
                activeDowntime={activeDowntime}
                compact
              />
            ) : editConfig ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-su-black bg-su-pink px-4 py-2 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-su-pink/80"
                  onClick={editConfig.onToggleDowntime}
                >
                  Start Downtime
                </button>
              </div>
            ) : (
              <Text variant="default" as="p" className="py-6 text-center text-su-white/50">
                Not currently in downtime.
              </Text>
            )}
          </div>
        ),
      },
      {
        key: 'pilots',
        label: 'Pilots',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <CrawlerPilotsSection crawlerId={crawler.id} />
          </div>
        ),
      },
      {
        key: 'bays',
        label: 'Bays',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <CrawlerBaysSection
              crawler={crawler}
              readOnly={isReadOnlySheet || !editConfig?.isMed}
              onSave={editConfig?.onImmediateUpdate ?? (() => {})}
              onOpenScrapConversion={() => setShowTranslateDialog(true)}
              armamentControls={isReadOnlySheet ? [] : weaponSlotControls}
            />
          </div>
        ),
      },
      {
        key: 'storage',
        label: 'Storage',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className={`flex gap-0 ${compact ? 'p-3' : 'p-4'}`}>
            {/* Left: Scrap controls — shrink-to-fit */}
            <div className="shrink-0">
              <CrawlerScrapStats
                crawler={crawler}
                readOnly={isReadOnlySheet || !editConfig?.isMed}
                onUpdate={editConfig?.onImmediateUpdate ?? (() => {})}
                compactGrid
                compact={compact}
                onOpenScrapConversion={() => setShowTranslateDialog(true)}
              />
            </div>
            {/* Vertical separator */}
            <div className="mx-4 w-px self-stretch bg-su-grey-light" aria-hidden="true" />
            {/* Right: Storage — fills remaining space */}
            <div className="flex min-w-0 flex-1 flex-col">
              <SectionSeparator label="Storage" compact={compact} />
              <CrawlerStorageSection
                crawlerId={crawler.id}
                userId={userId ?? ''}
                readOnly={isReadOnlySheet || !editConfig?.isMed}
              />
            </div>
          </div>
        ),
      },
      {
        key: 'log',
        label: 'Log',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className={compact ? 'p-3' : 'p-4'}>
            <GameLogTimeline gameId={game.id} crawler={crawler} compact={compact} />
          </div>
        ),
      },
    ]
  }, [
    listing,
    crawler,
    activeDowntime,
    editConfig,
    isReadOnlySheet,
    compact,
    userId,
    weaponSlotControls,
    game.id,
  ])

  const resolvedPopulationStr = useMemo(() => {
    if (populationStr) return populationStr
    if (!crawler) return undefined
    const tl = findCrawlerTechLevel(crawler.tech_level)
    if (!tl) return undefined
    return tl.populationMax > 0
      ? `${tl.populationMin.toLocaleString()} \u2013 ${tl.populationMax.toLocaleString()}`
      : `${tl.populationMin.toLocaleString()}+`
  }, [populationStr, crawler])

  // Sheet guard: non-listing needs at least a crawler
  if (!listing && !crawler) return null

  const crawlerType =
    crawlerTypeProp ??
    (crawler ? SalvageUnionReference.get('crawlers', crawler.crawler_ref) : undefined)

  // --- Controls ---
  const defaultControls =
    listing && crawler
      ? [navigateControl(handleNavigateToCrawler)]
      : listing
        ? [navigateControl(handleNavigateToGame)]
        : undefined

  const controls = controlsProp ?? defaultControls

  // --- Header content ---
  const headerContent = listing ? (
    crawler ? (
      <CardHeader
        title={
          <Text
            variant="pseudoheader"
            as="span"
            className={compact ? 'py-[3px] text-base' : 'text-[1.75rem]'}
            style={compact ? { lineHeight: 1 } : undefined}
          >
            {crawler.name || 'Unnamed Crawler'}{' '}
            {crawler.tag && <span className="text-sm opacity-70">#{crawler.tag}</span>}
          </Text>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-1">
            {crawlerType && (
              <ValueDisplay label="Type" value={crawlerType.name} compact={compact} />
            )}
            {resolvedPopulationStr && (
              <ValueDisplay label="Population" value={resolvedPopulationStr} compact={compact} />
            )}
          </div>
        }
        leftContent={
          <StatDisplay
            inverse
            label={compact ? 'TL' : 'Tech'}
            bottomLabel={compact ? '' : 'Level'}
            value={crawler.tech_level}
            compact={compact}
          />
        }
        compact={compact}
      />
    ) : (
      <CardHeader
        title={game.name}
        subtitle={
          <div className="flex flex-wrap items-center gap-1">
            {game.archived && (
              <span
                className={`rounded bg-su-orange/60 px-1.5 py-0.5 font-mono uppercase text-su-white ${compact ? 'text-[10px]' : 'text-sm'}`}
              >
                Archived
              </span>
            )}
            {game.crawler_id && <ValueDisplay label="Crawler" value="Active" compact={compact} />}
            {!game.crawler_id && (
              <Text
                variant="default"
                as="span"
                className={`text-su-white/50 ${compact ? 'text-xs' : 'text-base'}`}
              >
                No crawler yet
              </Text>
            )}
          </div>
        }
        compact={compact}
      />
    )
  ) : (
    // Sheet header (crawler is guaranteed non-null here)
    <div className="flex min-w-0 items-start gap-2">
      <StatDisplay label="TL" value={crawler!.tech_level} inverse compact={compact} />
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2">
          <Text
            variant="pseudoheader"
            as="span"
            className={compact ? 'py-[3px] text-base' : 'text-[1.75rem]'}
            style={compact ? { lineHeight: 1 } : undefined}
          >
            {crawler!.name || 'Unnamed Crawler'}
          </Text>
          {crawler!.tag && (
            <Text
              variant="pseudoheader"
              as="span"
              className={compact ? 'text-sm opacity-70' : 'text-lg opacity-70'}
              style={compact ? { lineHeight: 1 } : undefined}
            >
              #{crawler!.tag}
            </Text>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {crawlerType && <ValueDisplay label="Type" value={crawlerType.name} compact={compact} />}
          {resolvedPopulationStr && (
            <ValueDisplay label="Population" value={resolvedPopulationStr} compact={compact} />
          )}
        </div>
      </div>
    </div>
  )

  // --- Footer (DisplayCard hides in listing mode) ---
  const footerContent =
    !listing && editConfig?.isMed ? (
      <SheetFooter
        saveStatusText={editConfig.saveStatusText}
        leftContent={
          <button
            type="button"
            onClick={() => editConfig.onImmediateUpdate({ visible: !crawler!.visible })}
            className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${crawler!.visible ? 'text-su-white' : 'text-su-white/70'}`}
            title={crawler!.visible ? 'Crawler is visible to others' : 'Crawler is hidden'}
          >
            {crawler!.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span>{crawler!.visible ? 'Visible' : 'Hidden'}</span>
          </button>
        }
        rightContent={
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className={actionButtonClasses('rust')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        }
      />
    ) : undefined

  const stripeStyle = activeDowntime
    ? {
        backgroundImage:
          'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(206,88,152,0.35) 10px, rgba(206,88,152,0.35) 20px)',
      }
    : undefined

  return (
    <>
      <DisplayCard
        stickyHeader={!listing}
        headerBg="bg-su-pink"
        bodyPadding="p-4"
        compact={compact}
        listing={listing}
        headerContent={headerContent}
        stats={crawlerStats}
        controls={controls}
        footerContent={footerContent}
        tabs={tabs}
        defaultTabActiveColor={!listing ? CRAWLER_TAB_COLOR : undefined}
        headerStyle={stripeStyle ? { style: stripeStyle } : undefined}
        footerStyle={stripeStyle ? { style: stripeStyle } : undefined}
      >
        {!listing && crawler && crawlerType && (
          <CrawlerTypeSection
            crawler={crawler}
            crawlerType={crawlerType}
            readOnly={isReadOnlySheet || !editConfig?.isMed}
            onSave={editConfig?.onImmediateUpdate ?? (() => {})}
          />
        )}
      </DisplayCard>

      {/* Dialogs (portaled, always outside DisplayCard) */}
      {!listing && editConfig && crawler && (
        <>
          <ScrapTranslationDialog
            open={showTranslateDialog}
            onOpenChange={setShowTranslateDialog}
            crawler={crawler}
            onTranslate={(...args) => {
              editConfig.onTranslate(...args)
              setShowTranslateDialog(false)
            }}
            isPending={editConfig.translatePending}
          />
          <WeaponSelectionDialog
            open={editingWeaponSlot !== null}
            onOpenChange={(open) => {
              if (!open) setEditingWeaponSlot(null)
            }}
            onSelect={(newRefId) => {
              if (editingWeaponSlot) {
                editConfig.onWeaponChange(newRefId, editingWeaponSlot)
                setEditingWeaponSlot(null)
              }
            }}
            techLevel={crawler.tech_level}
            currentWeaponId={
              editingWeaponSlot?.oldRefId
                ? (weaponRefs ?? []).find((r) => r.id === editingWeaponSlot?.oldRefId)
                    ?.schema_ref_id
                : undefined
            }
          />
          <DeleteConfirmDialog
            open={showDelete}
            onOpenChange={setShowDelete}
            entityType="Crawler"
            entityName={crawler.name || 'this crawler'}
            onConfirm={editConfig.onDelete}
            isDeleting={editConfig.isDeleting}
          />
        </>
      )}
    </>
  )
}
