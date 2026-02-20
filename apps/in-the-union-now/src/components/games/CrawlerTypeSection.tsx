import { useMemo, useCallback, useState } from 'react'
import { SalvageUnionReference, getNpc } from 'salvageunion-reference'
import type { SURefEntity, SURefMetaAction } from 'salvageunion-reference'
import { Text, SectionSeparator, ReferenceEntityDisplay, NestedActionDisplay } from 'suref-react'
import { StatControl } from 'suref-react'
import { LabeledInput } from '../shared/LabeledInput'
import { useAutosave } from '../../hooks/useAutosave'
import {
  NPC_CHOICE_ORDER,
  NPC_EDITABLE_CHOICE_TYPES,
  NPC_ROLL_TABLE_FALLBACK,
} from '../../lib/npcChoiceConstants'
import type { BayNpcTextField } from '../../lib/npcChoiceConstants'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerTypeSectionProps = {
  crawler: CrawlerRow
  crawlerType: SURefEntity
  readOnly: boolean
  onSave: (input: Partial<CrawlerUpdate>) => void
}

export function CrawlerTypeSection({
  crawler,
  crawlerType,
  readOnly,
  onSave,
}: CrawlerTypeSectionProps) {
  const npcKey = crawler.crawler_ref
  const npc = getNpc(crawlerType as Parameters<typeof getNpc>[0])
  const hasNpc = !!npc

  const [localNpc, setLocalNpc] = useState<BayNpcData>(
    () => ((crawler.bay_npcs ?? {}) as Record<string, BayNpcData>)[npcKey] ?? {}
  )

  const { flush } = useAutosave({
    value: localNpc,
    onSave: (val) =>
      onSave({
        bay_npcs: {
          ...((crawler.bay_npcs ?? {}) as Record<string, BayNpcData>),
          [npcKey]: val,
        },
      }),
    delay: 1000,
    enabled: !readOnly && hasNpc,
  })

  const handleFieldChange = useCallback((field: BayNpcTextField, value: string) => {
    setLocalNpc((prev) => ({ ...prev, [field]: value || undefined }))
  }, [])

  const handleHpChange = useCallback((hp: number) => {
    setLocalNpc((prev) => ({ ...prev, hp }))
  }, [])

  const editableChoices = (() => {
    if (!npc?.choices) return []
    const choices = npc.choices.filter(
      (c) => NPC_EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform') && c.name !== 'Name'
    )
    return [...choices].sort((a, b) => {
      const aIdx = NPC_CHOICE_ORDER.indexOf(a.name)
      const bIdx = NPC_CHOICE_ORDER.indexOf(b.name)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })
  })()

  const maxHp = npc?.hitPoints ?? 0
  const currentHp = localNpc.hp ?? maxHp
  const hpSlot =
    maxHp > 0 ? (
      readOnly ? (
        <Text as="span" variant="pseudoheader" className="text-sm">
          HP {currentHp}/{maxHp}
        </Text>
      ) : (
        <StatControl label="HP" value={currentHp} max={maxHp} canEdit onChange={handleHpChange} />
      )
    ) : undefined

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
              value={localNpc[fieldKey] ?? ''}
              onChange={(value) => handleFieldChange(fieldKey, value)}
              onBlur={flush}
              readOnly={readOnly}
              readOnlyValue={localNpc[fieldKey] || '-'}
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

  // Build ability cards as rightContent
  const abilityContent = useMemo(() => {
    const ct = crawlerType as { actions?: string[] }
    const actions = ct.actions ?? []
    if (actions.length === 0) return undefined
    return (
      <div className="flex flex-col gap-3">
        {actions.map((actionName) => {
          const action = SalvageUnionReference.Actions.find((a) => a.name === actionName)
          if (!action) {
            return (
              <Text key={actionName} variant="default" className="text-sm text-su-white/60">
                {actionName}
              </Text>
            )
          }
          return (
            <NestedActionDisplay
              key={action.id}
              data={action as SURefMetaAction}
              compact
              headerBg="bg-su-pink"
              sectionHeader
            />
          )
        })}
      </div>
    )
  }, [crawlerType])

  const npcConfig = hasNpc
    ? {
        children: npcFieldsContent,
        hpSlot,
        name: localNpc.name ?? '',
        onNameChange: (name: string) => handleFieldChange('name', name),
        onNameBlur: flush,
        readOnly,
        showNpcSeparator: true,
      }
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler Type" />
      <ReferenceEntityDisplay
        data={crawlerType}
        compact
        npcConfig={npcConfig}
        rightContent={abilityContent}
        npcPosition="right"
        hide={{ actions: true, footer: true }}
        headerColor="bg-su-pink"
      />
    </div>
  )
}
