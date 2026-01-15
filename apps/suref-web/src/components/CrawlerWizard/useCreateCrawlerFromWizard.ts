import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateCrawler } from '../../hooks/crawler'
import { useCreateEntity, useUpdateEntity } from '../../hooks/suentity'
import { useUpsertPlayerChoice } from '../../hooks/suentity/usePlayerChoices'
import { getUser } from '../../lib/api'
import { fetchEntitiesForParent } from '../../lib/api/normalizedEntities'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Json } from '../../types/database-generated.types'
import type { WizardState } from './utils'

const ARMAMENT_BAY_WEAPON_CHOICE_ID = '383de916-bbd6-4e34-9cfc-1b37e12178c8'

export function useCreateCrawlerFromWizard() {
  const navigate = useNavigate()
  const createCrawler = useCreateCrawler()
  const createEntity = useCreateEntity()
  const updateEntity = useUpdateEntity()
  const upsertPlayerChoice = useUpsertPlayerChoice()

  return useCallback(
    async (state: WizardState) => {
      try {
        const user = await getUser()
        if (!user) throw new Error('Not authenticated')

        if (!state.selectedCrawlerTypeId) {
          throw new Error('Crawler type must be selected')
        }

        if (!state.armamentBayWeaponId) {
          throw new Error('Armament Bay weapon must be selected')
        }

        // Create crawler with name and NPC data
        const newCrawler = await createCrawler.mutateAsync({
          user_id: user.id,
          name: state.name.trim(),
          current_damage: 0,
          active: false,
          private: true,
          npc: state.crawlerNPC
            ? ({
                name: '', // Name is stored in player_choices
                notes: state.crawlerNPC.notes,
                hitPoints: state.crawlerNPC.hitPoints,
                damage: state.crawlerNPC.damage,
              } as Json)
            : null,
        })

        // Create crawler type entity (singleton)
        const crawlerTypeEntity = await createEntity.mutateAsync({
          crawler_id: newCrawler.id,
          schema_name: 'crawlers',
          schema_ref_id: state.selectedCrawlerTypeId,
        })

        // Create player choices for crawler NPC
        if (state.crawlerNPC && crawlerTypeEntity) {
          const crawlerTypeRef = SalvageUnionReference.get('crawlers', state.selectedCrawlerTypeId)
          if (crawlerTypeRef?.npc?.choices) {
            for (const choice of crawlerTypeRef.npc.choices) {
              const choiceValue = state.crawlerNPCChoices[choice.id]
              if (choiceValue?.trim()) {
                await upsertPlayerChoice.mutateAsync({
                  data: {
                    entity_id: crawlerTypeEntity.id,
                    choice_ref_id: choice.id,
                    value: choiceValue.trim(),
                  },
                  isMultiSelect: false,
                })
              }
            }
          }
        }

        // Wait a bit for bays to be created (they're created automatically by useCreateCrawler)
        // Then fetch all bay entities
        await new Promise((resolve) => setTimeout(resolve, 500))
        const bayEntities = await fetchEntitiesForParent('crawler', newCrawler.id)

        // Update bay NPC metadata and create player choices from wizard state
        for (const bayEntity of bayEntities) {
          const bayNPC = state.bayNPCs[bayEntity.schema_ref_id]
          const bayChoices = state.bayNPCChoices[bayEntity.schema_ref_id] || {}

          if (bayNPC) {
            // Update bay metadata with NPC info (excluding name, which goes in choices)
            await updateEntity.mutateAsync({
              id: bayEntity.id,
              updates: {
                metadata: {
                  damaged: false,
                  npc: {
                    name: '', // Name is stored in player_choices
                    notes: bayNPC.notes,
                    hitPoints: bayNPC.hitPoints,
                    damage: bayNPC.damage,
                  },
                },
              },
            })

            // Create player choices from wizard state
            const bayRef = SalvageUnionReference.get('crawler-bays', bayEntity.schema_ref_id)
            if (bayRef && 'npc' in bayRef && bayRef.npc.choices) {
              for (const choice of bayRef.npc.choices) {
                const choiceValue = bayChoices[choice.id]
                if (choiceValue !== undefined && choiceValue.trim()) {
                  await upsertPlayerChoice.mutateAsync({
                    data: {
                      entity_id: bayEntity.id,
                      choice_ref_id: choice.id,
                      value: choiceValue.trim(),
                    },
                    isMultiSelect: false,
                  })
                }
              }
            }
          }
        }

        // Create player choice for Armament Bay weapon
        const armamentBayEntity = bayEntities.find((bay) => {
          const bayRef = SalvageUnionReference.get('crawler-bays', bay.schema_ref_id)
          return bayRef && 'name' in bayRef && bayRef.name === 'Armament Bay'
        })

        if (armamentBayEntity) {
          const weaponRef = SalvageUnionReference.composeRef('systems', state.armamentBayWeaponId)
          await upsertPlayerChoice.mutateAsync({
            data: {
              entity_id: armamentBayEntity.id,
              choice_ref_id: ARMAMENT_BAY_WEAPON_CHOICE_ID,
              value: weaponRef,
            },
            isMultiSelect: false,
          })
        }

        // Navigate to crawler live sheet
        navigate({ to: `/dashboard/crawlers/${newCrawler.id}` })
      } catch (error) {
        console.error('Failed to create crawler from wizard:', error)
        throw error
      }
    },
    [createCrawler, createEntity, updateEntity, upsertPlayerChoice, navigate]
  )
}
