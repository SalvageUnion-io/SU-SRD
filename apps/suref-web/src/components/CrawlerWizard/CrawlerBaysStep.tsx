import { useMemo, useCallback } from 'react'
import { VStack, Button, Grid } from '@chakra-ui/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BayCard } from '../shared/BayCard'
import type { UseCrawlerWizardStateReturn } from './useCrawlerWizardState'
import type { BayNPCData } from './utils'

interface CrawlerBaysStepProps {
  wizardState: UseCrawlerWizardStateReturn
  onComplete: () => void
}

const ARMAMENT_BAY_WEAPON_CHOICE_ID = '383de916-bbd6-4e34-9cfc-1b37e12178c8'

export function CrawlerBaysStep({ wizardState, onComplete }: CrawlerBaysStepProps) {
  const { state, setBayNPC, setBayNPCChoice, setArmamentBayWeaponId } = wizardState

  const allBays = useMemo(() => SalvageUnionReference.CrawlerBays.all(), [])

  // All bays including Armament Bay - all rendered in the grid
  const regularBays = useMemo(() => {
    return allBays
  }, [allBays])

  const handleNPCUpdate = useCallback(
    (bayId: string, updates: Partial<BayNPCData>) => {
      const currentNPC = state.bayNPCs[bayId] || {
        name: '',
        notes: '',
        hitPoints: null,
        damage: 0,
      }
      setBayNPC(bayId, { ...currentNPC, ...updates })
    },
    [state.bayNPCs, setBayNPC]
  )

  // Handle bay-level choice updates (for Armament Bay weapon, etc.)
  const handleBayChoiceUpdate = useCallback(
    (_bayId: string, choiceId: string, value: string | undefined) => {
      // Handle Armament Bay weapon choice
      if (choiceId === ARMAMENT_BAY_WEAPON_CHOICE_ID) {
        if (value) {
          // Extract entity ID from the ref value (format: "systems::entity-id")
          const parsed = SalvageUnionReference.parseRef(value)
          if (parsed) {
            setArmamentBayWeaponId(parsed.id)
          }
        } else {
          setArmamentBayWeaponId(null)
        }
      }
    },
    [setArmamentBayWeaponId]
  )

  // Get the selected weapon value for Armament Bay
  const getArmamentBayWeaponValue = useCallback(
    (bayId: string): string | undefined => {
      // Check if this bay has the armament bay weapon choice
      const bay = allBays.find((b) => b.id === bayId)
      const isArmamentBay = bay?.choices?.some(
        (choice) => choice.id === ARMAMENT_BAY_WEAPON_CHOICE_ID
      )
      if (isArmamentBay && state.armamentBayWeaponId) {
        return SalvageUnionReference.composeRef('systems', state.armamentBayWeaponId)
      }
      return undefined
    },
    [allBays, state.armamentBayWeaponId]
  )

  const handleNext = useCallback(() => {
    if (state.armamentBayWeaponId) {
      onComplete()
    }
  }, [state.armamentBayWeaponId, onComplete])

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={2} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Configure Crawler Bays
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          Fill out NPC information for each bay. The Armament Bay weapon system is required to
          proceed.
        </Text>
      </VStack>

      {regularBays.length > 0 && (
        <Grid gridTemplateColumns="repeat(3, 1fr)" gap={4}>
          {regularBays.map((bay) => (
            <BayCard
              key={bay.id}
              mode="wizard"
              bay={bay}
              bayNPC={state.bayNPCs[bay.id]}
              bayNPCChoices={state.bayNPCChoices}
              onNPCUpdate={handleNPCUpdate}
              onBayChoiceUpdate={handleBayChoiceUpdate}
              selectedWeaponValue={getArmamentBayWeaponValue(bay.id)}
              setBayNPCChoice={setBayNPCChoice}
            />
          ))}
        </Grid>
      )}

      <Button
        w="full"
        bg={state.armamentBayWeaponId ? 'su.orange' : 'gray.400'}
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={state.armamentBayWeaponId ? { bg: 'su.black' } : {}}
        disabled={!state.armamentBayWeaponId}
        _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
        onClick={handleNext}
      >
        {state.armamentBayWeaponId ? 'ENTER CRAWLER NAME' : 'Select Armament Bay Weapon System'}
      </Button>
    </VStack>
  )
}
