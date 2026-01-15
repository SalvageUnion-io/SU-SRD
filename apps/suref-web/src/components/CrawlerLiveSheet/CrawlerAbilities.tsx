import type { SURefCrawler, SURefMetaAction } from 'salvageunion-reference'
import { extractActions } from 'salvageunion-reference'

import { Card } from '../shared/Card'
import { VStack } from '@chakra-ui/react'
import { SheetEntityChoiceDisplay } from './SheetEntityChoiceDisplay'
import { useHydratedCrawler } from '../../hooks/crawler'
import { useManageEntityChoices } from '../../hooks/suentity'
import { NestedChassisAbility } from '../entity/NestedChassisAbility'

export function CrawlerAbilities({
  id,
  disabled = false,
  readOnly = false,
}: {
  id: string
  disabled?: boolean
  readOnly?: boolean
}) {
  const { selectedCrawlerType } = useHydratedCrawler(id)
  const crawlerTypeRef = selectedCrawlerType?.ref as SURefCrawler | undefined

  return (
    <Card
      bg="bg.builder.crawler"
      title="Abilities"
      justifyContent={'flex-start'}
      disabled={disabled}
      w="full"
      maxW="50%"
      flex="1"
    >
      {(() => {
        const resolvedActions = crawlerTypeRef ? extractActions(crawlerTypeRef) : undefined
        const actions = resolvedActions || [
          {
            id: 'no-crawler-type',
            name: '',
            content: [{ type: 'paragraph', value: 'No crawler type selected.' }],
          } as SURefMetaAction,
        ]
        return actions.map((ability, idx) => (
          <CrawlerAbility
            readOnly={readOnly}
            key={ability.id || idx}
            ability={ability}
            crawlerTypeEntityId={selectedCrawlerType?.id}
          />
        ))
      })()}
    </Card>
  )
}

function CrawlerAbility({
  ability,
  readOnly = false,
  crawlerTypeEntityId,
}: {
  ability: SURefMetaAction
  readOnly?: boolean
  crawlerTypeEntityId: string | undefined
}) {
  const handleUpdateChoice = useManageEntityChoices(crawlerTypeEntityId)
  const wrappedChoice = ability.choices ?? []

  return (
    <VStack gap={3} alignItems="stretch" w="full">
      <NestedChassisAbility data={ability} compact={false} hideContent={false} hideChoices={true} />
      {wrappedChoice.map((choice, idx) => (
        <SheetEntityChoiceDisplay
          onUpdateChoice={readOnly ? undefined : handleUpdateChoice}
          key={choice.id || idx}
          choice={choice}
          entityId={crawlerTypeEntityId}
        />
      ))}
    </VStack>
  )
}
