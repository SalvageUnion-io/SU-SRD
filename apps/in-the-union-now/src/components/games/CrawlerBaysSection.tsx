import { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { SalvageUnionReference, getNpc } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { SectionSeparator, EntityDisplay, Text, DetailIcon, getTiltRotation } from 'suref-react'
import type { EntityControl } from 'suref-react'
import { Flame } from 'lucide-react'
import { useAutosave } from '../../hooks/useAutosave'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { RollInput } from '../shared/RollInput'
import { rollOnTable } from '../../lib/pilotUtils'
import { CrawlerStatControl } from './CrawlerStatControl'
import { BayDetailOverlay } from './BayDetailOverlay'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../types/common'

/** String-only keys from BayNpcData (excludes `damaged` boolean) */
type BayNpcTextField = 'name' | 'background' | 'motto' | 'keepsake' | 'personality'

/** Choices we render as fields */
const EDITABLE_CHOICE_TYPES = new Set(['freeform', 'permanent'])

/** Display order for NPC choices */
const CHOICE_ORDER = ['Name', 'Description', 'Motto', 'Keepsake', 'A.I. Personality']

/** Fallback roll table names for choices that don't have rollTable in the data */
const CHOICE_ROLL_TABLE_FALLBACK: Record<string, string> = {
  Motto: 'Motto',
  Keepsake: 'Keepsake',
}

type CrawlerBaysSectionProps = {
  crawler: CrawlerRow
  readOnly: boolean
  onSave: (input: Partial<CrawlerUpdate>) => void
  /** Render function for Armament Bay content — receives bay damage state */
  armamentContent?: (bayDamaged: boolean) => ReactNode
  /** Callback to open the scrap conversion dialog (shown inside Trading Bay) */
  onOpenScrapConversion?: () => void
  /** Render function for Storage Bay content — receives bay damage state */
  storageContent?: (bayDamaged: boolean) => ReactNode
}

export function CrawlerBaysSection({ crawler, readOnly, onSave, armamentContent, onOpenScrapConversion, storageContent }: CrawlerBaysSectionProps) {
  const allBays = SalvageUnionReference.CrawlerBays.all()
  const regularBays = allBays.filter((b) => b.name !== 'Storage Bay')
  const storageBay = allBays.find((b) => b.name === 'Storage Bay')

  // Local state for immediate UI feedback; useAutosave debounces the save
  const [localBayNpcs, setLocalBayNpcs] = useState<Record<string, BayNpcData>>(
    () => (crawler.bay_npcs ?? {}) as Record<string, BayNpcData>
  )

  const [bayOverlay, setBayOverlay] = useState<{
    entity: SURefEntity
    mode: 'content' | 'damage'
  } | null>(null)

  const { flush } = useAutosave({
    value: localBayNpcs,
    onSave: (val) => onSave({ bay_npcs: val }),
    delay: 1000,
    enabled: !readOnly,
  })

  const handleFieldChange = useCallback(
    (bayId: string, field: BayNpcTextField, value: string) => {
      setLocalBayNpcs((prev) => ({
        ...prev,
        [bayId]: {
          ...prev[bayId],
          [field]: value || undefined,
        },
      }))
    },
    []
  )

  const handleRoll = useCallback(
    (bayId: string, fieldKey: BayNpcTextField, tableName: string) => {
      const { text } = rollOnTable(tableName)
      if (text) {
        handleFieldChange(bayId, fieldKey, text)
      }
    },
    [handleFieldChange]
  )

  const handleHpChange = useCallback(
    (bayId: string, hp: number) => {
      setLocalBayNpcs((prev) => ({
        ...prev,
        [bayId]: {
          ...prev[bayId],
          hp,
        },
      }))
    },
    []
  )

  const handleToggleDamaged = useCallback(
    (bayId: string) => {
      setLocalBayNpcs((prev) => ({
        ...prev,
        [bayId]: {
          ...prev[bayId],
          damaged: !prev[bayId]?.damaged,
        },
      }))
    },
    []
  )

  const renderBay = (bay: (typeof allBays)[number], skipAfterContent = false) => {
    const npcData = localBayNpcs[bay.id] ?? {}
    const isDamaged = !!npcData.damaged
    const bayEntity = bay as unknown as SURefEntity
    const editableChoices = [...(bay.npc?.choices ?? [])]
      .filter((c) => EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform'))
      .sort((a, b) => {
        const aIdx = CHOICE_ORDER.indexOf(a.name)
        const bIdx = CHOICE_ORDER.indexOf(b.name)
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
      })

    const npc = getNpc(bay as Parameters<typeof getNpc>[0])
    const maxHp = npc?.hitPoints ?? 0
    const currentHp = npcData.hp ?? maxHp
    const npcIsDamaged = isDamaged || currentHp === 0

    const controls: EntityControl[] = [
      ...(!readOnly
        ? [
            {
              key: 'toggle-damaged',
              icon: Flame,
              onClick: () => handleToggleDamaged(bay.id),
              ariaLabel: isDamaged ? 'Restore to intact' : 'Mark as damaged',
              variant: isDamaged ? ('danger' as const) : ('ghost' as const),
              className: isDamaged ? 'bg-red-700 opacity-100 text-white' : undefined,
            },
          ]
        : []),
      {
        key: 'show-content',
        icon: DetailIcon,
        onClick: () => setBayOverlay({ entity: bayEntity, mode: 'content' }),
        ariaLabel: 'View details',
        variant: 'ghost',
      },
    ]

    const npcFieldsContent =
      editableChoices.length > 0 ? (
        <div className="flex flex-col gap-2">
          {editableChoices.map((choice) => {
            const fieldKey = choice.name.toLowerCase() as BayNpcTextField
            const rollTable =
              choice.rollTable ?? CHOICE_ROLL_TABLE_FALLBACK[choice.name]

            return (
              <div key={choice.id} className="flex flex-col gap-0.5">
                <Tilted damaged={npcIsDamaged}>
                  <Text
                    variant="pseudoheader"
                    as="label"
                    className="ml-0.5 text-xs uppercase"
                  >
                    {choice.name}
                  </Text>
                </Tilted>
                <Tilted damaged={npcIsDamaged}>
                  {readOnly ? (
                    <Text variant="default" as="span" className="text-sm">
                      {npcData[fieldKey] || '-'}
                    </Text>
                  ) : choice.name === 'Description' ? (
                    <Textarea
                      value={npcData[fieldKey] ?? ''}
                      onChange={(e) => handleFieldChange(bay.id, fieldKey, e.target.value)}
                      onBlur={flush}
                      placeholder="Enter description..."
                      className="min-h-[60px] text-sm"
                      rows={2}
                    />
                  ) : rollTable ? (
                    <RollInput
                      value={npcData[fieldKey] ?? ''}
                      onChange={(value) => handleFieldChange(bay.id, fieldKey, value)}
                      onRoll={() => handleRoll(bay.id, fieldKey, rollTable)}
                      onBlur={flush}
                      placeholder={`Roll or type ${choice.name.toLowerCase()}...`}
                      rollTableName={rollTable}
                    />
                  ) : (
                    <Input
                      value={npcData[fieldKey] ?? ''}
                      onChange={(e) => handleFieldChange(bay.id, fieldKey, e.target.value)}
                      onBlur={flush}
                      placeholder={choice.name}
                      className="h-8 text-sm"
                    />
                  )}
                </Tilted>
              </div>
            )
          })}
        </div>
      ) : undefined

    const isArmamentBay = bay.name === 'Armament Bay'
    const isTradingBay = bay.name === 'Trading Bay'
    const isStorageBay = bay.name === 'Storage Bay'

    const hpSlot =
      maxHp > 0 ? (
        readOnly ? (
          <Text as="span" variant="pseudoheader" className="text-sm">
            HP {currentHp}/{maxHp}
          </Text>
        ) : (
          <CrawlerStatControl
            label="HP"
            value={currentHp}
            max={maxHp}
            canEdit
            onChange={(v) => handleHpChange(bay.id, v)}
          />
        )
      ) : undefined

    const tradingBayContent =
      isTradingBay && !readOnly && onOpenScrapConversion ? (
        <button
          type="button"
          onClick={onOpenScrapConversion}
          disabled={isDamaged}
          className="w-full cursor-pointer bg-su-black px-4 py-2 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            Trade Scrap
          </Text>
        </button>
      ) : undefined

    const afterContent = skipAfterContent
      ? undefined
      : isArmamentBay
        ? armamentContent?.(isDamaged)
        : isTradingBay
          ? tradingBayContent
          : isStorageBay
            ? storageContent?.(isDamaged)
            : undefined

    return (
      <div key={bay.id} className="mb-4 break-inside-avoid">
        <EntityDisplay
          data={bayEntity}
          compact
          hideContent
          hideDamagedEffect
          hideRollTable
          hideFooter
          hideChoices={isArmamentBay}
          damaged={isDamaged}
          controls={controls}
          npcChildren={npcFieldsContent}
          npcHpSlot={hpSlot}
          npcDamaged={npcIsDamaged}
          afterNpcContent={afterContent}
          damageOverlayText={isDamaged ? bay.damagedEffect : undefined}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler Bays" fontSize="text-sm" />

      {storageBay && <div>{renderBay(storageBay)}</div>}

      <div className="columns-1 gap-4 sm:columns-2">
        {regularBays.map((bay) => renderBay(bay))}
      </div>

      <BayDetailOverlay
        open={bayOverlay !== null}
        onOpenChange={(open) => {
          if (!open) setBayOverlay(null)
        }}
        entity={bayOverlay?.entity}
        mode={bayOverlay?.mode ?? 'content'}
      />
    </div>
  )
}

/** Wraps children in a random tilt rotation when damaged, stable until damage state changes */
function Tilted({ damaged, children }: { damaged: boolean; children: ReactNode }) {
  const rotation = useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])
  return <div style={rotation !== 0 ? { transform: `rotate(${rotation}deg)` } : undefined}>{children}</div>
}
