import { useState, useCallback, useRef, useEffect } from 'react'
import { SalvageUnionReference, getNpc } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Text, ValueDisplay } from 'suref-react'
import type { ReferenceEntityControl, StatItem } from 'suref-react'
import { useAutosave } from '../../hooks/useAutosave'
import { LabeledInput } from '../shared/LabeledInput'
import {
  NPC_CHOICE_ORDER,
  NPC_EDITABLE_CHOICE_TYPES,
  NPC_ROLL_TABLE_FALLBACK,
} from '../../lib/npcChoiceConstants'
import type { BayNpcTextField } from '../../lib/npcChoiceConstants'
import { BayDetailOverlay } from './BayDetailOverlay'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../types/common'

/** Inline NPC name input styled as a pseudoheader title */
function BayNpcNameInput({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const [inputWidth, setInputWidth] = useState(0)
  const placeholder = 'Name...'

  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.scrollWidth)
    }
  }, [value])

  return (
    <span className="relative inline-flex items-baseline">
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-pre font-mono text-base font-bold uppercase leading-none"
      >
        {value || placeholder}
      </span>
      <Text
        variant="pseudoheader"
        as="span"
        className="inline-flex items-center box-decoration-clone bg-su-black px-1 py-[3px] text-base text-su-white"
        style={{ lineHeight: 1 }}
      >
        <input
          type="text"
          size={1}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="border-none bg-transparent p-0 font-mono text-base font-bold uppercase leading-none tracking-tight text-su-white outline-none placeholder:normal-case placeholder:text-su-white/50"
          style={{ width: inputWidth || undefined, lineHeight: 1 }}
        />
      </Text>
    </span>
  )
}

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

    // NPC name → title slot (interactive)
    const npcName = npcData.name ?? ''
    const titleSlot = readOnly ? (
      <Text
        variant="pseudoheader"
        as="span"
        className="py-[3px] text-base uppercase tracking-[-0.02em]"
        style={{ lineHeight: 1 }}
      >
        {npcName || '\u2014'}
      </Text>
    ) : (
      <BayNpcNameInput
        value={npcName}
        onChange={(name) => handleFieldChange(bay.id, 'name', name)}
        onBlur={flush}
      />
    )

    // NPC position → subtitle
    const subtitleExtra = npc?.position ? (
      <ValueDisplay label="The" value={npc.position} compact inverse />
    ) : undefined

    // HP → header stats
    const bayStats: StatItem[] | undefined =
      maxHp > 0
        ? [
            {
              key: 'hp',
              label: 'HP',
              value: currentHp,
              outOfMax: maxHp,
              ...(!readOnly
                ? { onChange: (v: number) => handleHpChange(bay.id, v), canEdit: true }
                : {}),
            },
          ]
        : undefined

    return (
      <div key={bay.id}>
        <ReferenceEntityDisplay
          data={bayEntity}
          compact
          label={bay.name}
          titleSlot={titleSlot}
          subtitleExtra={subtitleExtra}
          stats={bayStats}
          headerBgColor={isDamaged ? undefined : 'color-mix(in srgb, rgb(206, 88, 152) 35%, white)'}
          hide={{
            content: true,
            damagedEffect: true,
            rollTable: true,
            footer: true,
            choices: isArmamentBay,
            stats: true,
          }}
          damaged={isDamaged}
          controls={controls}
          npcConfig={{
            children: npcFieldsContent,
            damaged: npcIsDamaged,
            readOnly: readOnly,
            showNpcSeparator: false,
            hideNpcHeader: true,
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
