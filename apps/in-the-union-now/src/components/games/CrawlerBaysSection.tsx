import { useState, useCallback } from 'react'
import { SalvageUnionReference, getNpc } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Text } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { useAutosave } from '../../hooks/useAutosave'
import { LabeledInput } from '../shared/LabeledInput'
import {
  NPC_CHOICE_ORDER,
  NPC_EDITABLE_CHOICE_TYPES,
  NPC_ROLL_TABLE_FALLBACK,
} from '../../lib/npcChoiceConstants'
import type { BayNpcTextField } from '../../lib/npcChoiceConstants'
import { StatControl } from 'suref-react'
import { BayDetailOverlay } from './BayDetailOverlay'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerBaysSectionProps = {
  crawler: CrawlerRow
  readOnly: boolean
  onSave: (input: Partial<CrawlerUpdate>) => void
  /** ReferenceEntityControl[] for armament bay weapon slot buttons */
  armamentControls?: ReferenceEntityControl[]
  /** Callback to open the scrap conversion dialog (shown inside Trading Bay) */
  onOpenScrapConversion?: () => void
}

export function CrawlerBaysSection({
  crawler,
  readOnly,
  onSave,
  armamentControls,
  onOpenScrapConversion,
}: CrawlerBaysSectionProps) {
  const allBays = SalvageUnionReference.CrawlerBays.all()

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
      .filter((c) => NPC_EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform') && c.name !== 'Name')
      .sort((a, b) => {
        const aIdx = NPC_CHOICE_ORDER.indexOf(a.name)
        const bIdx = NPC_CHOICE_ORDER.indexOf(b.name)
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
      })

    const npc = getNpc(bay as Parameters<typeof getNpc>[0])
    const maxHp = npc?.hitPoints ?? 0
    const currentHp = npcData.hp ?? maxHp
    const npcIsDamaged = isDamaged || currentHp === 0

    const isArmamentBay = bay.name === 'Armament Bay'
    const isTradingBay = bay.name === 'Trading Bay'

    // Build controls: damage toggle + bay-specific controls + detail button
    const baySpecificControls: ReferenceEntityControl[] = []

    if (isArmamentBay && armamentControls) {
      if (isDamaged) {
        // When bay is damaged, show disabled controls without hoverContent
        baySpecificControls.push(
          ...armamentControls.map((c) => ({
            ...c,
            key: `${c.key}-disabled`,
            onClick: () => {},
            hoverContent: undefined,
            disabled: true,
          }))
        )
      } else {
        baySpecificControls.push(...armamentControls)
      }
    }

    if (isTradingBay && !readOnly && onOpenScrapConversion) {
      baySpecificControls.push({
        key: 'trade-scrap',
        label: 'Trade',
        onClick: onOpenScrapConversion,
        ariaLabel: 'Trade Scrap',
        disabled: isDamaged,
      })
    }

    const controls: ReferenceEntityControl[] = [
      ...(!readOnly
        ? [
            {
              key: 'toggle-damaged',
              label: isDamaged ? 'Damaged' : 'Damage',
              onClick: () => handleToggleDamaged(bay.id),
              ariaLabel: isDamaged ? 'Restore to intact' : 'Mark as damaged',
              ...(isDamaged ? { variant: 'danger' as const } : {}),
            },
          ]
        : []),
      ...baySpecificControls,
      {
        key: 'show-content',
        label: 'Details',
        onClick: () => setBayOverlay({ entity: bayEntity, mode: 'content' }),
        ariaLabel: 'View details',
      },
    ]

    const npcFieldsContent =
      editableChoices.length > 0 ? (
        <div className="flex flex-col gap-2">
          {editableChoices.map((choice) => {
            const fieldKey = choice.name.toLowerCase() as BayNpcTextField
            const rollTable = choice.rollTable ?? NPC_ROLL_TABLE_FALLBACK[choice.name]

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
      <div key={bay.id}>
        <ReferenceEntityDisplay
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
          damageOverlayText={isDamaged ? bay.damagedEffect : undefined}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allBays.map((bay) => renderBay(bay))}
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
