import { useMemo, useCallback, useState } from 'react'
import { Box, VStack } from '@chakra-ui/react'
import type { SURefCrawlerBay } from 'salvageunion-reference'

import type { HydratedBay } from '../../types/hydrated'
import type { BayNPCData } from '../CrawlerWizard/utils'
import { Card } from './Card'
import { NPCCard } from './NPCCard'
import { BayInfo } from './BayInfo'
import { StatDisplay } from '../StatDisplay'
import { DamagedEffectDisplay } from './DamagedEffectDisplay'
import { getTiltRotation } from '../../utils/tiltUtils'
import { useUpdateEntity, useManageEntityChoices } from '../../hooks/suentity'
import { getParagraphString } from '../../lib/contentBlockHelpers'

type EntityModeProps = {
  mode: 'entity'
  bay: HydratedBay
  disabled?: boolean
  readOnly?: boolean
}

type WizardModeProps = {
  mode: 'wizard'
  bay: SURefCrawlerBay
  bayNPC?: BayNPCData
  bayNPCChoices: Record<string, Record<string, string>>
  onNPCUpdate: (bayId: string, updates: Partial<BayNPCData>) => void
  onBayChoiceUpdate: (bayId: string, choiceId: string, value: string | undefined) => void
  selectedWeaponValue?: string
  setBayNPCChoice: (bayId: string, choiceId: string, value: string) => void
}

type BayCardProps = EntityModeProps | WizardModeProps

/**
 * Unified component for displaying bay cards that works in both
 * entity mode (with database-backed entity) and wizard mode (with wizard state).
 */
export function BayCard(props: BayCardProps) {
  const { mode, bay } = props

  const bayRef = mode === 'entity' ? (bay.ref as SURefCrawlerBay) : bay

  // Get metadata based on mode
  const metadata = useMemo(() => {
    if (mode === 'entity') {
      return (
        bay.metadata || {
          damaged: false,
          npc: { name: '', notes: '', hitPoints: null, damage: 0 },
        }
      )
    } else {
      const npc = props.bayNPC || {
        name: '',
        notes: '',
        hitPoints: bayRef.npc.hitPoints || null,
        damage: 0,
      }
      return {
        damaged: false,
        npc,
      }
    }
  }, [mode, bay, props, bayRef])

  // Only calculate rotation on client to avoid hydration mismatch
  const [titleRotation] = useState(() => getTiltRotation())
  const [bayInfoRotation] = useState(() => getTiltRotation())

  // Entity mode hooks
  const updateEntity = useUpdateEntity()
  const handleUpdateChoiceEntity = useManageEntityChoices(mode === 'entity' ? bay.id : undefined)

  // Entity mode: Handle damage toggle
  const handleToggleDamaged = useCallback(() => {
    if (mode !== 'entity') return

    const currentMetadata = bay.metadata || {
      damaged: false,
      npc: { name: '', notes: '', hitPoints: null, damage: 0 },
    }
    updateEntity.mutate({
      id: bay.id,
      updates: {
        metadata: {
          ...currentMetadata,
          damaged: !currentMetadata.damaged,
        },
      },
    })
  }, [mode, updateEntity, bay])

  // Entity mode: Handle NPC updates
  const handleUpdateNPCEntity = useCallback(
    (updates: Partial<{ npc: typeof metadata.npc }>) => {
      if (mode !== 'entity' || !updates.npc) return

      const currentMetadata = metadata || {
        damaged: false,
        npc: { name: '', notes: '', hitPoints: null, damage: 0 },
      }
      // Only update notes and damage - name is stored in player_choices
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name: _name, ...npcWithoutName } = updates.npc
      updateEntity.mutate({
        id: bay.id,
        updates: {
          metadata: {
            ...currentMetadata,
            npc: {
              ...currentMetadata.npc,
              ...npcWithoutName,
              name: currentMetadata.npc.name, // Preserve existing name (will be migrated to choices)
            },
          },
        },
      })
    },
    [mode, updateEntity, metadata, bay]
  )

  // Wizard mode: Get NPC choice definitions
  const npcChoiceDefinitions = useMemo(() => {
    if (mode === 'wizard') {
      if ('npc' in bayRef && bayRef.npc && 'choices' in bayRef.npc) {
        return bayRef.npc.choices || []
      }
      return []
    }
    return []
  }, [mode, bayRef])

  // Wizard mode: Build choices array from wizard state for NPCCard
  const wizardBayNPCChoices = mode === 'wizard' ? props.bayNPCChoices : undefined
  const choicesForNPCCard = useMemo(() => {
    if (mode !== 'wizard' || !wizardBayNPCChoices) return []

    const bayChoices = wizardBayNPCChoices[bayRef.id] || {}
    return npcChoiceDefinitions
      .filter((choice) => {
        // Include choices that have values in wizard state
        return bayChoices[choice.id] !== undefined && bayChoices[choice.id] !== ''
      })
      .map((choice) => ({
        id: `wizard-${bayRef.id}-${choice.id}`,
        entity_id: `wizard-${bayRef.id}`,
        choice_ref_id: choice.id,
        value: bayChoices[choice.id] || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        player_choice_id: null,
      })) as Array<{
      id: string
      entity_id: string | null
      choice_ref_id: string
      value: string
      created_at: string
      updated_at: string
      player_choice_id: string | null
    }>
  }, [mode, wizardBayNPCChoices, bayRef.id, npcChoiceDefinitions])

  // Wizard mode: Handle NPC choice updates
  const handleBayChoiceUpdateWizard = useCallback(
    (choiceId: string, value: string) => {
      if (mode !== 'wizard') return

      // Store choice value in wizard state
      if (choiceId && value !== undefined) {
        props.setBayNPCChoice(bayRef.id, choiceId, value)
        // Also update NPC name in bayNPCs for backward compatibility
        // (Name choice updates the NPC name)
        const choice = npcChoiceDefinitions.find((c) => c.id === choiceId)
        if (choice?.name === 'Name') {
          props.onNPCUpdate(bayRef.id, { name: value })
        }
      }
    },
    [mode, props, bayRef.id, npcChoiceDefinitions]
  )

  // Wizard mode: Handle NPC updates
  const handleBayNPCUpdateWizard = useCallback(
    (updates: Partial<{ npc: typeof metadata.npc }>) => {
      if (mode !== 'wizard' || !updates.npc) return

      // Exclude damage from updates - HP is not editable in wizard
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { damage: _damage, ...npcWithoutDamage } = updates.npc
      props.onNPCUpdate(bayRef.id, npcWithoutDamage)
    },
    [mode, props, bayRef.id, metadata]
  )

  // Determine which handlers to use
  const handleUpdateChoice =
    mode === 'entity' ? handleUpdateChoiceEntity : handleBayChoiceUpdateWizard
  const handleUpdateNPC = mode === 'entity' ? handleUpdateNPCEntity : handleBayNPCUpdateWizard
  const choices = mode === 'entity' ? bay.choices : choicesForNPCCard
  const disabled = mode === 'entity' ? (props.disabled ?? false) : false
  const readOnly = mode === 'entity' ? (props.readOnly ?? false) : false

  return (
    <Card
      bg={metadata.damaged ? 'su.grey' : 'su.crawlerPink'}
      justifyContent="flex-start"
      title={bayRef.name}
      titleRotation={metadata.damaged ? titleRotation : 0}
      disabled={disabled}
      rightContent={
        mode === 'entity' && !readOnly ? (
          <StatDisplay
            label={metadata.damaged ? 'Repair' : 'Damage'}
            value={metadata.damaged ? '+' : '-'}
            onClick={handleToggleDamaged}
            bg={metadata.damaged ? 'su.orange' : 'brand.srd'}
            valueColor="su.white"
            disabled={disabled}
          />
        ) : undefined
      }
    >
      <Box position="relative" w="full">
        {metadata.damaged && bayRef.damagedEffect && (
          <DamagedEffectDisplay damagedEffect={bayRef.damagedEffect} />
        )}

        <VStack gap={2} alignItems="stretch" w="full">
          <Box opacity={metadata.damaged ? 0.5 : 1} transition="opacity 0.3s ease">
            <NPCCard
              npc={metadata.npc}
              choices={choices}
              referenceBay={bayRef}
              description={getParagraphString(bayRef.npc.content) || ''}
              maxHP={bayRef.npc.hitPoints || 0}
              onUpdateChoice={readOnly ? undefined : handleUpdateChoice}
              onUpdateBay={readOnly ? undefined : handleUpdateNPC}
              position={bayRef.npc.position || 'NPC'}
              tilted={metadata.damaged}
              disabled={disabled}
            />
          </Box>

          <Box
            transform={metadata.damaged ? `rotate(${bayInfoRotation}deg)` : undefined}
            transition="transform 0.3s ease"
            opacity={metadata.damaged ? 0.5 : 1}
          >
            <BayInfo
              bayRef={bayRef}
              {...(mode === 'entity'
                ? { mode: 'entity', bayEntityId: bay.id }
                : {
                    mode: 'wizard',
                    onUpdateChoice: (choiceId, value) =>
                      props.onBayChoiceUpdate(bayRef.id, choiceId, value),
                    selectedWeaponValue: props.selectedWeaponValue,
                  })}
            />
          </Box>
        </VStack>
      </Box>
    </Card>
  )
}
