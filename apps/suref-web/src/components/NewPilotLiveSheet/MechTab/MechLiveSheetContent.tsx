import { Box, Flex, Grid, Tabs, VStack, HStack } from '@chakra-ui/react'
import { useIsMutating } from '@tanstack/react-query'
import type { SURefChassis } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { PilotSmallDisplay } from '../../Dashboard/PilotSmallDisplay'
import { AddStatButton } from '../../shared/AddStatButton'
import { SheetSelect } from '../../shared/SheetSelect'
import { MechResourceSteppers } from '../../MechLiveSheet/MechResourceSteppers'
import { ChassisAbilities } from '../../MechLiveSheet/ChassisAbilities'
import { SystemsList } from '../../MechLiveSheet/SystemsList'
import { ModulesList } from '../../MechLiveSheet/ModulesList'
import { CargoList } from '../../MechLiveSheet/CargoList'
import { Notes } from '../../shared/Notes'
import { Card } from '../../shared/Card'
import { LiveSheetControlBar } from '../../shared/LiveSheetControlBar'
import { LiveSheetLoadingState } from '../../shared/LiveSheetLoadingState'
import { LiveSheetNotFoundState } from '../../shared/LiveSheetNotFoundState'
import { LiveSheetErrorState } from '../../shared/LiveSheetErrorState'
import { DeleteEntity } from '../../shared/DeleteEntity'
import { useUpdateMech, useHydratedMech, useDeleteMech } from '../../../hooks/mech'
import { useCreatePilotForMech } from '../../../hooks/usePilotAssignment'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { useImageUpload } from '../../../hooks/useImageUpload'
import { useEntityRelationships } from '../../../hooks/useEntityRelationships'
import { isOwner } from '../../../lib/permissions'
import { MainMechDisplay } from '../../MechLiveSheet/MainMechDisplay'
import { LiveSheetAssetDisplay } from '../../shared/LiveSheetAssetDisplay'
import { SalvageUnionReference } from 'salvageunion-reference'

interface MechLiveSheetContentProps {
  mechId: string
  isEditable: boolean
}

export default function MechLiveSheetContent({ mechId }: MechLiveSheetContentProps) {
  const { mech, isLocal, loading, error, selectedChassis, totalSalvageValue } =
    useHydratedMech(mechId)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const updateMech = useUpdateMech()
  const deleteMech = useDeleteMech()

  const mutatingCount = useIsMutating()
  const hasPendingChanges = mutatingCount > 0

  const { userId } = useCurrentUser()

  const isMechEditable = isLocal || (mech ? isOwner(mech.user_id, userId) : false)

  const { handleUpload, handleRemove, isUploading, isRemoving } = useImageUpload({
    entityType: 'mechs',
    entityId: mechId,
    getCurrentImageUrl: () => mech?.image_url ?? null,
    queryKey: ['mechs', mechId],
  })

  const { createPilotForMech, isPending: isCreatingPilot } = useCreatePilotForMech(mechId)

  const { items: allPilots } = useEntityRelationships<{
    id: string
    callsign: string
    class_id: string | null
    advanced_class_id: string | null
  }>({
    table: 'pilots',
    selectFields: 'id, callsign, class_id, advanced_class_id',
    orderBy: 'callsign',
  })

  const availablePilots = allPilots.filter((p) => p.id !== mech?.pilot_id)

  if (!mech && !loading) {
    return <LiveSheetNotFoundState entityType="Mech" />
  }

  if (loading) {
    return <LiveSheetLoadingState entityType="Mech" />
  }

  if (error) {
    return <LiveSheetErrorState entityType="Mech" error={error} />
  }

  return (
    <>
      {!isLocal && (
        <LiveSheetControlBar
          bg="su.green"
          hasPendingChanges={hasPendingChanges}
          active={mech?.active ?? false}
          onActiveChange={(active) => updateMech.mutate({ id: mechId, updates: { active } })}
          isPrivate={mech?.private ?? true}
          onPrivateChange={(isPrivate) =>
            updateMech.mutate({ id: mechId, updates: { private: isPrivate } })
          }
          disabled={!isMechEditable}
        />
      )}
      <Flex gap={2} mt={6}>
        <LiveSheetAssetDisplay
          bg={!selectedChassis ? 'su.grey' : 'su.green'}
          url={chassisRef?.asset_url}
          userImageUrl={mech?.image_url ?? undefined}
          alt={chassisRef?.name}
          onUpload={!isLocal && isMechEditable ? handleUpload : undefined}
          onRemove={!isLocal && isMechEditable ? handleRemove : undefined}
          isUploading={isUploading}
          isRemoving={isRemoving}
        />
        <MainMechDisplay id={mechId} isEditable={isMechEditable} />
        <MechResourceSteppers
          id={mechId}
          disabled={!isMechEditable}
          incomplete={!selectedChassis}
        />
      </Flex>

      <Tabs.Root defaultValue="abilities">
        <Tabs.List borderColor="border.default">
          <Tabs.Trigger value="abilities" color="fg.default">
            Chassis Abilities
          </Tabs.Trigger>
          <Tabs.Trigger value="systems-modules" color="fg.default">
            Systems & Modules
          </Tabs.Trigger>
          <Tabs.Trigger value="storage" color="fg.default">
            Storage
          </Tabs.Trigger>
          <Tabs.Trigger value="notes" color="fg.default">
            Notes
          </Tabs.Trigger>
          <Box flex="1" />
          {!isLocal && (
            <Tabs.Trigger value="pilot" color="fg.default">
              Pilot
            </Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value="abilities">
          <Box mt={6}>
            <ChassisAbilities
              totalSalvageValue={totalSalvageValue}
              chassis={chassisRef}
              disabled={!selectedChassis}
            />
          </Box>
        </Tabs.Content>

        <Tabs.Content value="systems-modules">
          <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6} mt={6}>
            <SystemsList id={mechId} disabled={!selectedChassis} readOnly={!isMechEditable} />

            <ModulesList id={mechId} disabled={!selectedChassis} readOnly={!isMechEditable} />
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="storage">
          <Box mt={6}>
            <CargoList id={mechId} disabled={!selectedChassis} readOnly={!isMechEditable} />
          </Box>
        </Tabs.Content>

        <Tabs.Content value="notes">
          <Box mt={6}>
            <Notes
              notes={mech?.notes ?? ''}
              onChange={(value) => updateMech.mutate({ id: mechId, updates: { notes: value } })}
              disabled={!isMechEditable}
              incomplete={!selectedChassis}
              backgroundColor="bg.builder.mech"
              placeholder="Add notes about your mech..."
            />
          </Box>
        </Tabs.Content>

        {!isLocal && (
          <Tabs.Content value="pilot">
            <VStack gap={6} align="stretch" mt={6}>
              {mech?.pilot_id ? (
                <>
                  {!isLocal && isMechEditable && availablePilots.length > 0 && (
                    <Box>
                      <SheetSelect
                        label="Change Pilot"
                        value={null}
                        options={availablePilots.map((p) => {
                          const parts = [p.callsign]
                          if (p.class_id) {
                            const coreClass = SalvageUnionReference.get('classes', p.class_id)
                            if (coreClass) parts.push(coreClass.name)
                          }
                          if (p.advanced_class_id) {
                            const advancedClass = SalvageUnionReference.get(
                              'classes',
                              p.advanced_class_id
                            )
                            if (advancedClass) parts.push(`/ ${advancedClass.name}`)
                          }
                          return { id: p.id, name: parts.join(' - ') }
                        })}
                        onChange={(pilotId) => {
                          if (pilotId) {
                            updateMech.mutate({ id: mechId, updates: { pilot_id: pilotId } })
                          }
                        }}
                        placeholder="Select a different pilot..."
                      />
                    </Box>
                  )}
                  <PilotSmallDisplay id={mech.pilot_id} />
                </>
              ) : (
                <Card bg="su.grey">
                  <VStack gap={4}>
                    <Text variant="pseudoheader" textAlign="center">
                      No pilot assigned to this mech
                    </Text>
                    {!isLocal && isMechEditable && (
                      <HStack gap={4} justify="center">
                        <AddStatButton
                          label="Create"
                          bottomLabel="Pilot"
                          onClick={createPilotForMech}
                          disabled={isCreatingPilot}
                          ariaLabel="Create new pilot for this mech"
                        />
                        {availablePilots.length > 0 && (
                          <Box w="300px">
                            <SheetSelect
                              label="Or Assign Existing"
                              value={null}
                              options={availablePilots.map((p) => {
                                const parts = [p.callsign]
                                if (p.class_id) {
                                  const coreClass = SalvageUnionReference.get('classes', p.class_id)
                                  if (coreClass) parts.push(coreClass.name)
                                }
                                if (p.advanced_class_id) {
                                  const advancedClass = SalvageUnionReference.get(
                                    'classes',
                                    p.advanced_class_id
                                  )
                                  if (advancedClass) parts.push(`/ ${advancedClass.name}`)
                                }
                                return { id: p.id, name: parts.join(' - ') }
                              })}
                              onChange={(pilotId) => {
                                if (pilotId) {
                                  updateMech.mutate({ id: mechId, updates: { pilot_id: pilotId } })
                                }
                              }}
                              placeholder="Select pilot..."
                            />
                          </Box>
                        )}
                      </HStack>
                    )}
                  </VStack>
                </Card>
              )}
            </VStack>
          </Tabs.Content>
        )}
      </Tabs.Root>

      {!isLocal && (
        <DeleteEntity
          entityName="Mech"
          onConfirmDelete={() =>
            deleteMech.mutate(mechId, {
              onSuccess: () => {
                // Don't navigate, just refresh the tab
                window.location.reload()
              },
            })
          }
          disabled={!isMechEditable || !mechId || updateMech.isPending}
        />
      )}
    </>
  )
}
