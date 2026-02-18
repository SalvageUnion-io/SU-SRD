import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  DisplayCard,
  CardHeader,
  Text,
  ValueDisplay,
  SectionSeparator,
  StatDisplay,
  navigateControl,
} from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { ArrowUp, Eye, EyeOff, Trash2 } from 'lucide-react'
import { StatControl } from '../shared/StatControl'
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

  // --- LISTING MODE (game only, no crawler) ---
  const handleNavigateToGame = useCallback(() => {
    navigate({ to: '/games/$gameId', params: { gameId: game.id } })
  }, [navigate, game.id])

  const handleNavigateToCrawler = useCallback(() => {
    navigate({ to: '/games/$gameId/crawler', params: { gameId: game.id } })
  }, [navigate, game.id])

  if (listing) {
    // Crawler detail listing (game + crawler present)
    if (crawler) {
      const defaultControls = [navigateControl(handleNavigateToCrawler)]
      const controls = controlsProp ?? defaultControls

      const headerContent = (
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
      )

      return (
        <DisplayCard
          headerBg="bg-su-pink"
          headerContent={headerContent}
          mode="listing"
          controls={controls}
        />
      )
    }

    // Game listing (no crawler detail)
    const defaultControls = [navigateControl(handleNavigateToGame)]
    const controls = controlsProp ?? defaultControls

    const headerContent = (
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

    return (
      <DisplayCard
        headerBg="bg-su-pink"
        headerContent={headerContent}
        mode="listing"
        controls={controls}
      />
    )
  }

  // --- SHEET MODE ---
  if (!crawler || !editConfig) return null

  const crawlerType = crawlerTypeProp ?? SalvageUnionReference.get('crawlers', crawler.crawler_ref)
  const { isMed } = editConfig

  return (
    <>
      <DisplayCard
        stickyHeader
        headerBg="bg-su-pink"
        bodyPadding="p-0"
        headerContent={
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <StatDisplay label="TL" value={crawler.tech_level} inverse />
              <div className="flex min-w-0 flex-col justify-center gap-0.5">
                <div className="flex items-center gap-2">
                  <Text variant="pseudoheader" as="span" className="text-[1.75rem]">
                    {crawler.name || 'Unnamed Crawler'}
                  </Text>
                  {crawler.tag && (
                    <Text variant="pseudoheader" as="span" className="text-lg opacity-70">
                      #{crawler.tag}
                    </Text>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {crawlerType && <ValueDisplay label="Type" value={crawlerType.name} />}
                  {populationStr && <ValueDisplay label="Population" value={populationStr} />}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <StatControl
                label="Upgrade"
                bottomLabel="Pool"
                value={crawler.upgrade_pool}
                max={tlStats?.upgrade_cost ?? undefined}
                canEdit={isMed}
                onChange={(v) => editConfig.onImmediateUpdate({ upgrade_pool: v })}
              />
              {isMed &&
                tlStats?.upgrade_cost !== null &&
                tlStats?.upgrade_cost !== undefined &&
                crawler.upgrade_pool >= tlStats.upgrade_cost && (
                  <button
                    type="button"
                    onClick={editConfig.onUpgradeTL}
                    disabled={editConfig.upgradePending}
                    className="flex cursor-pointer flex-col items-center gap-0.5 rounded border border-su-green/60 bg-su-green/20 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-su-green transition-colors hover:bg-su-green/30 disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Upgrade to Tech Level ${crawler.tech_level + 1}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    <span>TL Up</span>
                  </button>
                )}
              <StatDisplay
                label="Upkeep"
                value={tlStats?.upkeep ?? 0}
                bottomLabel={`TL${crawler.tech_level}`}
              />
              <StatControl
                label="SP"
                value={crawler.current_sp}
                max={crawler.max_sp}
                canEdit={isMed}
                onChange={(v) => editConfig.onImmediateUpdate({ current_sp: v })}
              />
            </div>
          </div>
        }
        footerContent={
          isMed ? (
            <SheetFooter
              saveStatusText={editConfig.saveStatusText}
              leftContent={
                <button
                  type="button"
                  onClick={() => editConfig.onImmediateUpdate({ visible: !crawler.visible })}
                  className={`flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-su-white ${crawler.visible ? 'text-su-white' : 'text-su-white/70'}`}
                  title={crawler.visible ? 'Crawler is visible to others' : 'Crawler is hidden'}
                >
                  {crawler.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span>{crawler.visible ? 'Visible' : 'Hidden'}</span>
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
        }
      >
        <div className="space-y-6 p-4">
          <CrawlerPilotsSection crawlerId={crawler.id} />

          {crawlerType && (
            <CrawlerTypeSection
              crawler={crawler}
              crawlerType={crawlerType}
              readOnly={!isMed}
              onSave={editConfig.onImmediateUpdate}
            />
          )}

          <CrawlerBaysSection
            crawler={crawler}
            readOnly={!isMed}
            onSave={editConfig.onImmediateUpdate}
            onOpenScrapConversion={() => editConfig.setShowTranslateDialog(true)}
            armamentControls={editConfig.weaponSlotControls}
            storageContent={(bayDamaged) => (
              <>
                <CrawlerScrapStats
                  crawler={crawler}
                  readOnly={!isMed || bayDamaged}
                  onUpdate={editConfig.onImmediateUpdate}
                />
                <SectionSeparator label="Storage" compact={compact} />
                <CrawlerStorageSection
                  crawlerId={crawler.id}
                  userId={userId ?? ''}
                  readOnly={!isMed || bayDamaged}
                />
              </>
            )}
          />
        </div>
      </DisplayCard>

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
  )
}
