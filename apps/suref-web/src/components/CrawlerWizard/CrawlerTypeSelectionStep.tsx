import { useMemo, useState, useCallback, useEffect } from 'react'
import { Box, VStack, Button, Tabs, Flex } from '@chakra-ui/react'
import { extractActions } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { NPCCard } from '../shared/NPCCard'
import { NestedChassisAbility } from '../entity/NestedChassisAbility'
import { EntityChoiceDisplay } from '../shared/EntityChoiceDisplay'
import { EntityDisplay } from '../entity/EntityDisplay'
import { getParagraphString } from '../../lib/contentBlockHelpers'
import type { Tables } from '../../types/database-generated.types'
import type { UseCrawlerWizardStateReturn } from './useCrawlerWizardState'
import { getWorkshopManualCrawlers } from './utils'
import type { CrawlerNPCData } from './utils'

interface CrawlerTypeSelectionStepProps {
  wizardState: UseCrawlerWizardStateReturn
  onComplete: () => void
}

export function CrawlerTypeSelectionStep({
  wizardState,
  onComplete,
}: CrawlerTypeSelectionStepProps) {
  const { state, setSelectedCrawlerTypeId, setCrawlerNPC, setCrawlerNPCChoice } = wizardState
  const crawlerTypes = useMemo(() => getWorkshopManualCrawlers(), [])

  const [selectedTab, setSelectedTab] = useState<string>(() => {
    if (state.selectedCrawlerTypeId) return state.selectedCrawlerTypeId
    // Pre-select first crawler type
    return crawlerTypes.length > 0 && crawlerTypes[0] ? crawlerTypes[0].id : ''
  })

  const selectedCrawlerType = useMemo(() => {
    return crawlerTypes.find((c) => c.id === selectedTab) || null
  }, [crawlerTypes, selectedTab])

  const isCrawlerTypeSelected = useMemo(() => {
    return selectedCrawlerType?.id === state.selectedCrawlerTypeId
  }, [selectedCrawlerType?.id, state.selectedCrawlerTypeId])

  const handleCrawlerTypeSelect = useCallback(() => {
    if (selectedCrawlerType) {
      setSelectedCrawlerTypeId(selectedCrawlerType.id)
    }
  }, [selectedCrawlerType, setSelectedCrawlerTypeId])

  const handleNext = useCallback(() => {
    if (state.selectedCrawlerTypeId) {
      onComplete()
    }
  }, [state.selectedCrawlerTypeId, onComplete])

  const handleTabChange = useCallback((crawlerTypeId: string) => {
    setSelectedTab(crawlerTypeId)
  }, [])

  const crawlerNPC = useMemo(() => {
    if (!selectedCrawlerType?.npc) return null
    return (
      state.crawlerNPC || {
        name: '',
        notes: '',
        hitPoints: selectedCrawlerType.npc.hitPoints || null,
        damage: 0,
      }
    )
  }, [selectedCrawlerType, state.crawlerNPC])

  const handleNPCUpdate = useCallback(
    (updates: Partial<{ npc: CrawlerNPCData }>) => {
      if (!updates.npc || !crawlerNPC) return
      // Exclude damage from updates - HP is not editable in wizard
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { damage: _damage, ...npcWithoutDamage } = updates.npc
      setCrawlerNPC({ ...crawlerNPC, ...npcWithoutDamage })
    },
    [crawlerNPC, setCrawlerNPC]
  )

  const handleNPCChoiceUpdate = useCallback(
    (choiceId: string, value: string) => {
      setCrawlerNPCChoice(choiceId, value)
    },
    [setCrawlerNPCChoice]
  )

  // Initialize crawler NPC when crawler type is selected
  useEffect(() => {
    if (selectedCrawlerType?.npc && !state.crawlerNPC) {
      setCrawlerNPC({
        name: '',
        notes: '',
        hitPoints: selectedCrawlerType.npc.hitPoints || null,
        damage: 0,
      })
    }
  }, [selectedCrawlerType, state.crawlerNPC, setCrawlerNPC])

  // Convert choices map to array format for NPCCard
  const npcChoicesArray = useMemo((): Tables<'player_choices'>[] => {
    if (!selectedCrawlerType?.npc?.choices) return []
    return selectedCrawlerType.npc.choices.map((choice) => ({
      id: `temp-${choice.id}`,
      choice_ref_id: choice.id,
      value: state.crawlerNPCChoices[choice.id] || '',
      entity_id: null,
      player_choice_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  }, [selectedCrawlerType, state.crawlerNPCChoices])

  // Extract abilities from selected crawler type
  const abilities = useMemo(() => {
    if (!selectedCrawlerType) return []
    const resolvedActions = extractActions(selectedCrawlerType)
    return resolvedActions || []
  }, [selectedCrawlerType])

  // Handle ability choice updates (for wizard, we'll store in crawlerNPCChoices for now)
  const handleAbilityChoiceUpdate = useCallback(
    (choiceId: string, value: string | undefined) => {
      // For wizard, we can store ability choices in crawlerNPCChoices
      // They'll be properly associated when the crawler is created
      // Handle both selection (value provided) and deselection (value undefined)
      setCrawlerNPCChoice(choiceId, value)
    },
    [setCrawlerNPCChoice]
  )

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={2} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Choose your Crawler Type
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          Select a crawler type from the Workshop Manual. Each type has different abilities and
          characteristics.
        </Text>
      </VStack>

      {crawlerTypes.length > 0 && (
        <Tabs.Root value={selectedTab} onValueChange={(e) => handleTabChange(e.value)}>
          <Box>
            <Tabs.List
              borderBottom="3px solid"
              borderColor="border.default"
              justifyContent="center"
              flexWrap="wrap"
              gap={2}
              pb={4}
              mb={4}
            >
              {crawlerTypes.map((crawlerType) => (
                <Tabs.Trigger
                  key={crawlerType.id}
                  value={crawlerType.id}
                  fontSize="lg"
                  fontWeight="bold"
                  color="fg.default"
                  _selected={{
                    bg: 'su.orange',
                    color: 'su.white',
                    borderBottomColor: 'su.orange',
                  }}
                >
                  {crawlerType.name}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {selectedCrawlerType && (
              <Flex gap={6} w="full" align="stretch" minH={0}>
                {/* Crawler Type EntityDisplay on the left */}
                <Box flex="1" minH={0} display="flex" flexDirection="column">
                  <Box
                    flex="1"
                    minH={0}
                    display="flex"
                    flexDirection="column"
                    css={{
                      '& > div': {
                        minHeight: '100% !important',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      },
                    }}
                  >
                    <EntityDisplay
                      data={selectedCrawlerType}
                      hideActions
                      hideChoices
                      imageWidth="40%"
                      headerColor={isCrawlerTypeSelected ? 'su.brick' : undefined}
                      buttonConfig={{
                        bg: isCrawlerTypeSelected ? 'su.brick' : 'su.orange',
                        color: 'su.white',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        _hover: { bg: isCrawlerTypeSelected ? 'su.black' : 'su.black' },
                        onClick: handleCrawlerTypeSelect,
                        children: isCrawlerTypeSelected ? 'Selected' : 'Select This Crawler Type',
                      }}
                    >
                      {/* Ability choices rendered as children - appears above button, below content */}
                      {abilities.length > 0 && (
                        <VStack gap={3} alignItems="stretch" w="full" mt={4}>
                          {abilities.map((ability, idx) => (
                            <CrawlerAbility
                              key={ability.id || idx}
                              ability={ability}
                              onUpdateChoice={handleAbilityChoiceUpdate}
                              choices={state.crawlerNPCChoices}
                            />
                          ))}
                        </VStack>
                      )}
                    </EntityDisplay>
                  </Box>
                </Box>

                {/* NPC Box on the right */}
                {selectedCrawlerType.npc && crawlerNPC && (
                  <Box flex="1" maxW="50%" minH={0} display="flex" flexDirection="column">
                    <Card
                      bg="bg.builder.crawler"
                      title="NPC"
                      disabled={false}
                      w="full"
                      h="full"
                      flex="1"
                      justifyContent="flex-start"
                    >
                      <NPCCard
                        npc={crawlerNPC}
                        choices={npcChoicesArray}
                        referenceBay={selectedCrawlerType}
                        description={getParagraphString(selectedCrawlerType.npc.content) || ''}
                        maxHP={selectedCrawlerType.npc.hitPoints || 0}
                        onUpdateBay={handleNPCUpdate}
                        onUpdateChoice={handleNPCChoiceUpdate}
                        position={selectedCrawlerType.npc.position || 'NPC'}
                        tilted={false}
                        disabled={false}
                      />
                    </Card>
                  </Box>
                )}
              </Flex>
            )}
          </Box>
        </Tabs.Root>
      )}

      <Button
        w="full"
        bg={state.selectedCrawlerTypeId ? 'su.orange' : 'gray.400'}
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={state.selectedCrawlerTypeId ? { bg: 'su.black' } : {}}
        disabled={!state.selectedCrawlerTypeId}
        _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
        onClick={handleNext}
      >
        CONFIGURE BAYS
      </Button>
    </VStack>
  )
}

// Helper component to render a crawler ability with choices
function CrawlerAbility({
  ability,
  onUpdateChoice,
  choices,
}: {
  ability: SURefMetaAction
  onUpdateChoice: (choiceId: string, value: string | undefined) => void
  choices: Record<string, string>
}) {
  const wrappedChoice = ability.choices ?? []

  return (
    <VStack gap={3} alignItems="stretch" w="full">
      <NestedChassisAbility data={ability} compact={false} hideContent={false} hideChoices={true} />
      {wrappedChoice.map((choice, idx) => (
        <EntityChoiceDisplay
          mode="wizard"
          onUpdateChoice={onUpdateChoice}
          key={choice.id || idx}
          choice={choice}
          selectedValue={choices[choice.id]}
        />
      ))}
    </VStack>
  )
}
