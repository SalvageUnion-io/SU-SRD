import { useCallback, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type {
  SURefObjectNpc,
  SURefObjectContentBlock,
  SURefObjectChoice,
} from 'salvageunion-reference'
import { DisplayCard, Text, StatDisplay, ValueDisplay, BlockContentRendererView } from 'suref-react'
import { LabeledInput } from '../shared/LabeledInput'
import { rollOnTable } from '../../lib/pilotUtils'
import {
  NPC_CHOICE_ORDER,
  NPC_EDITABLE_CHOICE_TYPES,
  NPC_OPTIONAL_CHOICES,
  NPC_ROLL_TABLE_FALLBACK,
} from '../../lib/npcChoiceConstants'

type NpcEntry = {
  parentName: string
  npc: SURefObjectNpc
  /** Whether this is a crawler-type NPC (vs a bay NPC) */
  isCrawlerType: boolean
}

type CrawlerNpcStepContentProps = {
  stepId: string
  choiceValues: Record<string, string>
  onChoiceValueChange: (stepId: string, choiceId: string, value: string) => void
  selectedCrawlerTypeId?: string
}

/** Gather all NPCs from crawler bays + the selected crawler type.
 *  Bay NPCs first, crawler type NPC last. */
function collectNpcEntries(selectedCrawlerTypeId?: string): NpcEntry[] {
  const entries: NpcEntry[] = []

  // All bay NPCs first
  const bays = SalvageUnionReference.CrawlerBays.all()
  for (const bay of bays) {
    if (bay.npc) {
      entries.push({ parentName: bay.name, npc: bay.npc, isCrawlerType: false })
    }
  }

  // Crawler type NPC last
  if (selectedCrawlerTypeId) {
    const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.id === selectedCrawlerTypeId)
    if (crawlerType?.npc) {
      entries.push({ parentName: crawlerType.name, npc: crawlerType.npc, isCrawlerType: true })
    }
  }

  return entries
}

/** Get required editable choice IDs (excludes optional choices like Description) */
// eslint-disable-next-line react-refresh/only-export-components
export function getAllNpcChoiceIds(selectedCrawlerTypeId?: string): string[] {
  const entries = collectNpcEntries(selectedCrawlerTypeId)
  const ids: string[] = []
  for (const entry of entries) {
    if (entry.npc.choices) {
      for (const choice of entry.npc.choices) {
        if (
          NPC_EDITABLE_CHOICE_TYPES.has(choice.choiceType ?? 'freeform') &&
          !NPC_OPTIONAL_CHOICES.has(choice.name)
        ) {
          ids.push(choice.id)
        }
      }
    }
  }
  return ids
}

/** Sort choices by the preferred display order */
function sortChoices<T extends { name: string }>(choices: T[]): T[] {
  return [...choices].sort((a, b) => {
    const aIdx = NPC_CHOICE_ORDER.indexOf(a.name)
    const bIdx = NPC_CHOICE_ORDER.indexOf(b.name)
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
  })
}

/** Get editable choices (freeform + permanent) from an NPC */
function getEditableChoices(npc: SURefObjectNpc): SURefObjectChoice[] {
  return npc.choices?.filter((c) => NPC_EDITABLE_CHOICE_TYPES.has(c.choiceType ?? 'freeform')) ?? []
}

type NpcCardProps = {
  entry: NpcEntry
  choiceValues: Record<string, string>
  stepId: string
  onChoiceValueChange: (stepId: string, choiceId: string, value: string) => void
  onRoll: (choiceId: string, tableName: string) => void
}

function NpcCard({ entry, choiceValues, stepId, onChoiceValueChange, onRoll }: NpcCardProps) {
  const editableChoices = sortChoices(getEditableChoices(entry.npc))
  const npcContent = entry.npc.content as SURefObjectContentBlock[] | undefined

  if (editableChoices.length === 0 && !npcContent?.length) return null

  const label = entry.isCrawlerType ? `"${entry.parentName}" Type Crawler` : entry.parentName

  return (
    <DisplayCard
      headerBg="bg-su-rust"
      mode="compact"
      headerContent={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <Text
              variant="pseudoheader"
              as="span"
              className="py-[3px] text-[16px] tracking-[-0.02em] text-su-white uppercase"
            >
              {entry.npc.position}
            </Text>
            <ValueDisplay label={label} compact />
          </div>
          {entry.npc.hitPoints > 0 && (
            <StatDisplay label="HP" value={entry.npc.hitPoints} compact />
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {npcContent && npcContent.length > 0 && (
          <BlockContentRendererView content={npcContent} fontSize="text-xs" compact />
        )}
        {editableChoices.map((choice) => {
          const rollTable = choice.rollTable ?? NPC_ROLL_TABLE_FALLBACK[choice.name]
          return (
            <LabeledInput
              key={choice.id}
              label={choice.name}
              value={choiceValues[choice.id] ?? ''}
              onChange={(value) => onChoiceValueChange(stepId, choice.id, value)}
              optionalText={NPC_OPTIONAL_CHOICES.has(choice.name) ? '(Optional)' : undefined}
              variant={choice.name === 'Description' ? 'textarea' : rollTable ? 'roll' : 'input'}
              rollTableName={rollTable}
              onRoll={rollTable ? () => onRoll(choice.id, rollTable) : undefined}
              placeholder={
                choice.name === 'Description'
                  ? 'Enter description...'
                  : rollTable
                    ? `Roll or type ${choice.name.toLowerCase()}...`
                    : `Enter ${choice.name.toLowerCase()}...`
              }
            />
          )
        })}
      </div>
    </DisplayCard>
  )
}

export function CrawlerNpcStepContent({
  stepId,
  choiceValues,
  onChoiceValueChange,
  selectedCrawlerTypeId,
}: CrawlerNpcStepContentProps) {
  const npcEntries = useMemo(
    () => collectNpcEntries(selectedCrawlerTypeId),
    [selectedCrawlerTypeId]
  )

  const handleRoll = useCallback(
    (choiceId: string, tableName: string) => {
      const { text } = rollOnTable(tableName)
      if (text) {
        onChoiceValueChange(stepId, choiceId, text)
      }
    },
    [stepId, onChoiceValueChange]
  )

  const crawlerTypeEntry = npcEntries.find((e) => e.isCrawlerType)
  const bayEntries = npcEntries.filter((e) => !e.isCrawlerType)

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="columns-1 gap-3 md:columns-2">
        {bayEntries.map((entry) => (
          <div
            key={`${entry.parentName}-${entry.npc.position}`}
            className="mb-3 break-inside-avoid"
          >
            <NpcCard
              entry={entry}
              choiceValues={choiceValues}
              stepId={stepId}
              onChoiceValueChange={onChoiceValueChange}
              onRoll={handleRoll}
            />
          </div>
        ))}
      </div>
      {crawlerTypeEntry && (
        <NpcCard
          entry={crawlerTypeEntry}
          choiceValues={choiceValues}
          stepId={stepId}
          onChoiceValueChange={onChoiceValueChange}
          onRoll={handleRoll}
        />
      )}
    </div>
  )
}
