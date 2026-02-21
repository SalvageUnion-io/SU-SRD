import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  DisplayCard,
  CardHeader,
  Text,
  ValueDisplay,
  SectionSeparator,
  StatDisplay,
  StatControl,
  navigateControl,
} from 'suref-react'
import type { ReferenceEntityControl, StatItem, DisplayCardTab } from 'suref-react'
import { ArrowUp, Eye, EyeOff, Trash2 } from 'lucide-react'
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
import type { CrawlerEditConfig } from '../../hooks/useCrawlerSheet'
import type { CampaignRow, CrawlerRow, EntityRefRow } from '../../types/common'
import type { SURefEntity } from 'salvageunion-reference'

type PlayerCrawlerDisplayProps = {
  game: CampaignRow
  crawler?: CrawlerRow | null
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
  // Sheet data (only needed when !listing)
  crawlerType?: SURefEntity | null
  tlStats?: { max_sp: number; upkeep: number; upgrade_cost: number | null }
  populationStr?: string
  weaponRefs?: EntityRefRow[]
  userId?: string
  editConfig?: CrawlerEditConfig
}

export function PlayerCrawlerDisplay({
  game,
  crawler,
  listing = true,
  compact = true,
  controls: controlsProp,
  crawlerType: crawlerTypeProp,
  tlStats,
  populationStr,
  weaponRefs,
  userId,
  editConfig,
}: PlayerCrawlerDisplayProps) {
  const navigate = useNavigate()

  const handleNavigateToGame = useCallback(() => {
    navigate({ to: '/games/$gameId', params: { gameId: game.id } })
  }, [navigate, game.id])

  const handleNavigateToCrawler = useCallback(() => {
    navigate({ to: '/games/$gameId/crawler', params: { gameId: game.id } })
  }, [navigate, game.id])

  // --- Mode mapping ---
  const mode = listing ? 'listing' : compact ? 'compact' : ('full' as const)

  // --- Crawler header stats (Upkeep + SP, only for sheet mode) ---
  const crawlerStats: StatItem[] | undefined =
    !listing && crawler && editConfig
      ? [
          {
            key: 'upkeep',
            label: 'Upkeep',
            value: tlStats?.upkeep ?? 0,
            bottomLabel: `TL${crawler.tech_level}`,
          },
          {
            key: 'sp',
            label: 'SP',
            value: crawler.current_sp,
            outOfMax: crawler.max_sp,
            onChange: (v: number) => editConfig.onImmediateUpdate({ current_sp: v }),
            canEdit: editConfig.isMed,
          },
        ]
      : undefined

  // --- Tabs (only used in non-listing mode) ---
  const CRAWLER_TAB_COLOR = 'rgb(201, 111, 146)'
  const tabs = useMemo((): DisplayCardTab[] | undefined => {
    if (listing || !crawler || !editConfig) return undefined
    return [
      {
        key: 'pilots',
        label: 'Pilots',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className="p-4">
            <CrawlerPilotsSection crawlerId={crawler.id} />
          </div>
        ),
      },
      {
        key: 'bays',
        label: 'Bays',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className="p-4">
            <CrawlerBaysSection
              crawler={crawler}
              readOnly={!editConfig.isMed}
              onSave={editConfig.onImmediateUpdate}
              onOpenScrapConversion={() => editConfig.setShowTranslateDialog(true)}
              armamentControls={editConfig.weaponSlotControls}
            />
          </div>
        ),
      },
      {
        key: 'storage',
        label: 'Storage',
        activeColor: CRAWLER_TAB_COLOR,
        content: (
          <div className="flex gap-0 p-4">
            {/* Left: Scrap controls — shrink-to-fit */}
            <div className="shrink-0">
              <CrawlerScrapStats
                crawler={crawler}
                readOnly={!editConfig.isMed}
                onUpdate={editConfig.onImmediateUpdate}
                compactGrid
                onOpenScrapConversion={() => editConfig.setShowTranslateDialog(true)}
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
                readOnly={!editConfig.isMed}
              />
            </div>
          </div>
        ),
      },
    ]
  }, [listing, crawler, editConfig, compact, userId])

  // Sheet guard: impossible state protection
  if (!listing && (!crawler || !editConfig)) return null

  const crawlerType = crawlerTypeProp

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
          <>
            {crawler.name || 'Unnamed Crawler'}{' '}
            {crawler.tag && <span className="text-sm opacity-70">#{crawler.tag}</span>}
          </>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-1">
            <ValueDisplay
              label="SP"
              value={`${crawler.current_sp}/${crawler.max_sp}`}
              compact={compact}
            />
            <ValueDisplay label="TL" value={crawler.tech_level} compact={compact} />
            <ValueDisplay label="Upkeep" value={crawler.upkeep} compact={compact} />
          </div>
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
      <StatDisplay label="TL" value={crawler!.tech_level} inverse />
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2">
          <Text variant="pseudoheader" as="span" className="text-[1.75rem]">
            {crawler!.name || 'Unnamed Crawler'}
          </Text>
          {crawler!.tag && (
            <Text variant="pseudoheader" as="span" className="text-lg opacity-70">
              #{crawler!.tag}
            </Text>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {crawlerType && <ValueDisplay label="Type" value={crawlerType.name} />}
          {populationStr && <ValueDisplay label="Population" value={populationStr} />}
        </div>
      </div>
      {/* Upgrade Pool + TL Up button: tightly coupled, kept inline */}
      <div className="ml-auto flex shrink-0 items-start gap-2">
        <StatControl
          label="Upgrade"
          bottomLabel="Pool"
          value={crawler!.upgrade_pool}
          max={tlStats?.upgrade_cost ?? undefined}
          canEdit={editConfig!.isMed}
          onChange={(v) => editConfig!.onImmediateUpdate({ upgrade_pool: v })}
        />
        {editConfig!.isMed &&
          tlStats?.upgrade_cost !== null &&
          tlStats?.upgrade_cost !== undefined &&
          crawler!.upgrade_pool >= tlStats.upgrade_cost && (
            <button
              type="button"
              onClick={editConfig!.onUpgradeTL}
              disabled={editConfig!.upgradePending}
              className="flex cursor-pointer flex-col items-center gap-0.5 rounded border border-su-green/60 bg-su-green/20 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-su-green transition-colors hover:bg-su-green/30 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Upgrade to Tech Level ${crawler!.tech_level + 1}`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>TL Up</span>
            </button>
          )}
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
            onClick={() => editConfig.setShowDelete(true)}
            className={actionButtonClasses('rust')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        }
      />
    ) : undefined

  return (
    <>
      <DisplayCard
        stickyHeader={!listing}
        headerBg="bg-su-pink"
        bodyPadding="p-4"
        mode={mode}
        headerContent={headerContent}
        stats={crawlerStats}
        controls={controls}
        footerContent={footerContent}
        tabs={tabs}
        defaultTabLabel="Info"
        defaultTabActiveColor={!listing ? CRAWLER_TAB_COLOR : undefined}
      >
        {!listing && crawler && editConfig && crawlerType && (
          <CrawlerTypeSection
            crawler={crawler}
            crawlerType={crawlerType}
            readOnly={!editConfig.isMed}
            onSave={editConfig.onImmediateUpdate}
          />
        )}
      </DisplayCard>

      {/* Dialogs (portaled, always outside DisplayCard) */}
      {!listing && editConfig && crawler && (
        <>
          <ScrapTranslationDialog
            open={editConfig.showTranslateDialog}
            onOpenChange={editConfig.setShowTranslateDialog}
            crawler={crawler}
            onTranslate={editConfig.onTranslate}
            isPending={editConfig.translatePending}
          />
          <WeaponSelectionDialog
            open={editConfig.editingWeaponSlot !== null}
            onOpenChange={(open) => {
              if (!open) editConfig.setEditingWeaponSlot(null)
            }}
            onSelect={editConfig.onWeaponChange}
            techLevel={crawler.tech_level}
            currentWeaponId={
              editConfig.editingWeaponSlot?.oldRefId
                ? (weaponRefs ?? []).find((r) => r.id === editConfig.editingWeaponSlot?.oldRefId)
                    ?.schema_ref_id
                : undefined
            }
          />
          <DeleteConfirmDialog
            open={editConfig.showDelete}
            onOpenChange={editConfig.setShowDelete}
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
