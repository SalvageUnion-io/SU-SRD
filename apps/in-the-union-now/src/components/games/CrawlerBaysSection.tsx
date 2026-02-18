import { useState, useCallback } from 'react'
import { SalvageUnionReference, getNpc } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { SectionSeparator, EntityDisplay, Text, DetailIcon } from 'suref-react'
import type { EntityControl } from 'suref-react'
import { ArrowLeftRight, Flame } from 'lucide-react'
import { useAutosave } from '../../hooks/useAutosave'
import { LabeledInput } from '../shared/LabeledInput'
import { rollOnTable } from '../../lib/pilotUtils'
import { StatControl } from '../shared/StatControl'
import { BayDetailOverlay } from './BayDetailOverlay'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../types/common'

/** String-only keys from BayNpcData (excludes `damaged` boolean) */
type BayNpcTextField = 'name' | 'description' | 'motto' | 'keepsake' | 'personality'

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
  /** EntityControl[] for armament bay weapon slot buttons */
  armamentControls?: EntityControl[]
  /** Callback to open the scrap conversion dialog (shown inside Trading Bay) */
  onOpenScrapConversion?: () => void
  /** Render function for Storage Bay content — receives bay damage state */
  storageContent?: (bayDamaged: boolean) => React.ReactNode
}

export function CrawlerBaysSection({
  crawler,
  readOnly,
  onSave,
  armamentControls,
  onOpenScrapConversion,
  storageContent,
}: CrawlerBaysSectionProps) {
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

  const handleFieldChange = useCallback((bayId: string, field: BayNpcTextField, value: string) => {
    setLocalBayNpcs((prev) => ({
      ...prev,
      [bayId]: {
        ...prev[bayId],
        [field]: value || undefined,
      },
    }))
  }, [])

  const handleRoll = useCallback(
    (bayId: string, fieldKey: BayNpcTextField, tableName: string) => {
      const { text } = rollOnTable(tableName)
      if (text) {
        handleFieldChange(bayId, fieldKey, text)
      }
    },
    [handleFieldChange]
  )

  const handleHpChange = useCallback((bayId: string, hp: number) => {
    setLocalBayNpcs((prev) => ({
      ...prev,
      [bayId]: {
        ...prev[bayId],
        hp,
      },
    }))
  }, [])

  const handleToggleDamaged = useCallback((bayId: string) => {
    setLocalBayNpcs((prev) => ({
      ...prev,
      [bayId]: {
        ...prev[bayId],
        damaged: !prev[bayId]?.damaged,
      },
    }))
  }, [])

  const renderBay = (bay: (typeof allBays)[number]) => {
    const npcData = localBayNpcs[bay.id] ?? {}
    const isDamaged = !!npcData.damaged
    const bayEntity = bay as unknown as SURefEntity
    const editableChoices = [...(bay.npc?.choices ?? [])]
      .filter((c) => EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform') && c.name !== 'Name')
      .sort((a, b) => {
        const aIdx = CHOICE_ORDER.indexOf(a.name)
        const bIdx = CHOICE_ORDER.indexOf(b.name)
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
      })

    const npc = getNpc(bay as Parameters<typeof getNpc>[0])
    const maxHp = npc?.hitPoints ?? 0
    const currentHp = npcData.hp ?? maxHp
    const npcIsDamaged = isDamaged || currentHp === 0

    const isArmamentBay = bay.name === 'Armament Bay'
    const isTradingBay = bay.name === 'Trading Bay'
    const isStorageBay = bay.name === 'Storage Bay'

    // Build controls: damage toggle + bay-specific controls + detail button
    const baySpecificControls: EntityControl[] = []

    if (isArmamentBay && armamentControls) {
      if (isDamaged) {
        // When bay is damaged, show greyed-out no-op controls without hoverContent
        baySpecificControls.push(
          ...armamentControls.map((c) => ({
            ...c,
            key: `${c.key}-disabled`,
            onClick: () => {},
            hoverContent: undefined,
            className: 'opacity-30 cursor-not-allowed',
          }))
        )
      } else {
        baySpecificControls.push(...armamentControls)
      }
    }

    if (isTradingBay && !readOnly && onOpenScrapConversion) {
      baySpecificControls.push({
        key: 'trade-scrap',
        icon: ArrowLeftRight,
        onClick: isDamaged ? () => {} : onOpenScrapConversion,
        ariaLabel: 'Trade Scrap',
        variant: 'ghost',
        className: isDamaged ? 'opacity-30 cursor-not-allowed' : undefined,
      })
    }

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
      ...baySpecificControls,
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
            const rollTable = choice.rollTable ?? CHOICE_ROLL_TABLE_FALLBACK[choice.name]

            return (
              <LabeledInput
                key={choice.id}
                label={choice.name}
                value={npcData[fieldKey] ?? ''}
                onChange={(value) => handleFieldChange(bay.id, fieldKey, value)}
                onBlur={flush}
                readOnly={readOnly}
                readOnlyValue={npcData[fieldKey] || '-'}
                variant={choice.name === 'Description' ? 'textarea' : rollTable ? 'roll' : 'input'}
                rollTableName={rollTable}
                onRoll={rollTable ? () => handleRoll(bay.id, fieldKey, rollTable) : undefined}
                placeholder={
                  choice.name === 'Description'
                    ? 'Enter description...'
                    : rollTable
                      ? `Roll or type ${choice.name.toLowerCase()}...`
                      : choice.name
                }
              />
            )
          })}
        </div>
      ) : undefined

    const hpSlot =
      maxHp > 0 ? (
        readOnly ? (
          <Text as="span" variant="pseudoheader" className="text-sm">
            HP {currentHp}/{maxHp}
          </Text>
        ) : (
          <StatControl
            label="HP"
            value={currentHp}
            max={maxHp}
            canEdit
            onChange={(v) => handleHpChange(bay.id, v)}
          />
        )
      ) : undefined

    return (
      <div key={bay.id} className="mb-4 break-inside-avoid">
        <EntityDisplay
          data={bayEntity}
          compact
          hide={{
            content: true,
            damagedEffect: true,
            rollTable: true,
            footer: true,
            choices: isArmamentBay,
          }}
          damaged={isDamaged}
          controls={controls}
          npcConfig={{
            children: npcFieldsContent,
            hpSlot: hpSlot,
            damaged: npcIsDamaged,
            name: npcData.name ?? '',
            onNameChange: (name) => handleFieldChange(bay.id, 'name', name),
            onNameBlur: flush,
            readOnly: readOnly,
          }}
          rightContent={isStorageBay && storageContent ? storageContent(isDamaged) : undefined}
          damageOverlayText={isDamaged ? bay.damagedEffect : undefined}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler Bays" fontSize="text-sm" />

      {storageBay && <div>{renderBay(storageBay)}</div>}

      <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
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
