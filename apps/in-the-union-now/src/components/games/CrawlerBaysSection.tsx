import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { SectionSeparator, Text } from 'suref-react'
import { Input } from '../ui/input'
import type { BayNpcData, CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerBaysSectionProps = {
  crawler: CrawlerRow
  readOnly: boolean
  onUpdate: (input: Partial<CrawlerUpdate>) => void
}

export function CrawlerBaysSection({ crawler, readOnly, onUpdate }: CrawlerBaysSectionProps) {
  const allBays = SalvageUnionReference.CrawlerBays.all()
  const bayNpcs = (crawler.bay_npcs ?? {}) as Record<string, BayNpcData>

  const handleNpcFieldChange = useCallback(
    (bayId: string, field: keyof BayNpcData, value: string) => {
      const currentBayData = bayNpcs[bayId] ?? {}
      const updated = {
        ...bayNpcs,
        [bayId]: {
          ...currentBayData,
          [field]: value || undefined,
        },
      }
      onUpdate({ bay_npcs: updated })
    },
    [bayNpcs, onUpdate]
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler Bays" fontSize="text-sm" />

      <div className="flex flex-col gap-4">
        {allBays.map((bay) => {
          const npcData = bayNpcs[bay.id] ?? {}
          const npcChoices = bay.npc?.choices?.filter((c) => c.choiceType === 'freeform') ?? []

          return (
            <div key={bay.id} className="rounded-md border border-su-grey-light/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Text variant="pseudoheader" as="span" className="text-sm uppercase">
                  {bay.name}
                </Text>
                {bay.npc?.position && (
                  <span className="rounded bg-su-pink/20 px-1.5 py-0.5 text-xs text-su-pink">
                    {bay.npc.position}
                  </span>
                )}
              </div>

              {npcChoices.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {npcChoices.map((choice) => {
                    const fieldKey = choice.name.toLowerCase() as keyof BayNpcData
                    return (
                      <div key={choice.id} className="flex flex-col gap-1">
                        <label className="text-xs text-su-white/50">{choice.name}</label>
                        {readOnly ? (
                          <Text variant="default" as="span" className="text-sm">
                            {npcData[fieldKey] || '-'}
                          </Text>
                        ) : (
                          <Input
                            value={npcData[fieldKey] ?? ''}
                            onChange={(e) => handleNpcFieldChange(bay.id, fieldKey, e.target.value)}
                            placeholder={choice.name}
                            className="h-8 text-sm"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
