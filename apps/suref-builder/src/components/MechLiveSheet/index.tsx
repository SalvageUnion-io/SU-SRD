import { useNavigate } from '@tanstack/react-router'
import { Box, Flex, Grid, Tabs, VStack, HStack } from '@chakra-ui/react'
import { useIsMutating } from '@tanstack/react-query'
import type { SURefChassis } from 'salvageunion-reference'
import { Text } from 'suref-react'
import { PilotSmallDisplay } from '../Dashboard/PilotSmallDisplay'
import { AddStatButton } from '../shared/AddStatButton'
import { SheetSelect } from '../shared/SheetSelect'
import { MechResourceSteppers } from './MechResourceSteppers'
import { ChassisAbilities } from './ChassisAbilities'
import { SystemsList } from './SystemsList'
import { ModulesList } from './ModulesList'
import { CargoList } from './CargoList'
import { Notes } from '../shared/Notes'
import { Card } from 'suref-react'
import { LiveSheetLayout } from '../shared/LiveSheetLayout'
import { DeleteEntity } from '../shared/DeleteEntity'
import { LiveSheetControlBar } from '../shared/LiveSheetControlBar'
import { useUpdateMech, useHydratedMech, useDeleteMech } from '../../hooks/mech'
import { useCreatePilotForMech } from '../../hooks/usePilotAssignment'
import { useImageUpload } from '../../hooks/useImageUpload'
import { useEntityRelationships } from '../../hooks/useEntityRelationships'
import { useIsEditable } from '../../hooks/useIsEditable'
import { LiveSheetStateGuard } from '../shared/LiveSheetStateGuard'
import { MainMechDisplay } from './MainMechDisplay'
import { LiveSheetAssetDisplay } from '../shared/LiveSheetAssetDisplay'
import { SalvageUnionReference } from 'salvageunion-reference'

interface MechLiveSheetProps {
  id: string
  flat?: boolean
}

export default function MechLiveSheet({ id, flat = false }: MechLiveSheetProps) {
  const navigate = useNavigate()

  const { mech, isLocal, loading, error, selectedChassis, totalSalvageValue } = useHydratedMech(id)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const updateMech = useUpdateMech()
  const deleteMech = useDeleteMech()

  const mutatingCount = useIsMutating()
  const hasPendingChanges = mutatingCount > 0

  const isEditable = useIsEditable(mech, isLocal)

  const { handleUpload, handleRemove, isUploading, isRemoving } = useImageUpload({
    entityType: 'mechs',
    entityId: id,
    getCurrentImageUrl: () => mech?.image_url ?? null,
    queryKey: ['mechs', id],
  })

  const { createPilotForMech, isPending: isCreatingPilot } = useCreatePilotForMech(id)

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

  const handleCreatePilot = async () => {
    const pilotId = await createPilotForMech()
    if (pilotId) {
      navigate({ to: `/dashboard/pilots/${pilotId}` })
    }
  }

  const commonContent = (
    <>
      {!isLocal && (
        <LiveSheetControlBar
          bg="su.green"
          hasPendingChanges={hasPendingChanges}
          active={mech?.active ?? false}
          onActiveChange={(active) => updateMech.mutate({ id, updates: { active } })}
          isPrivate={mech?.private ?? true}
          onPrivateChange={(isPrivate) =>
            updateMech.mutate({ id, updates: { private: isPrivate } })
          }
          disabled={!isEditable}
        />
      )}
      <Flex gap={2}>
        <LiveSheetAssetDisplay
          bg={!selectedChassis ? 'su.grey' : 'su.green'}
          url={chassisRef?.asset_url}
          userImageUrl={mech?.image_url ?? undefined}
          alt={chassisRef?.name}
          onUpload={!isLocal && isEditable ? handleUpload : undefined}
          onRemove={!isLocal && isEditable ? handleRemove : undefined}
          isUploading={isUploading}
          isRemoving={isRemoving}
        />
        <MainMechDisplay id={id} isEditable={isEditable} />
        <MechResourceSteppers id={id} disabled={!isEditable} incomplete={!selectedChassis} />
      </Flex>
    </>
  )

  const pilotContent = mech?.pilot_id ? (
    <>
      {!isLocal && isEditable && availablePilots.length > 0 && (
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
                const advancedClass = SalvageUnionReference.get('classes', p.advanced_class_id)
                if (advancedClass) parts.push(`/ ${advancedClass.name}`)
              }
              return { id: p.id, name: parts.join(' - ') }
            })}
            onChange={(pilotId) => {
              if (pilotId) {
                updateMech.mutate({ id, updates: { pilot_id: pilotId } })
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
        {!isLocal && isEditable && (
          <HStack gap={4} justify="center">
            <AddStatButton
              label="Create"
              bottomLabel="Pilot"
              onClick={handleCreatePilot}
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
                      updateMech.mutate({ id, updates: { pilot_id: pilotId } })
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
  )

  return (
    <LiveSheetStateGuard entityType="Mech" entity={mech} loading={loading} error={error}>
      {flat ? (
        <>
          {commonContent}
          <VStack gap={6} alignItems="stretch" mt={6}>
            {/* Chassis Abilities Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Chassis Abilities
              </Text>
              <ChassisAbilities
                totalSalvageValue={totalSalvageValue}
                chassis={chassisRef}
                disabled={!selectedChassis}
              />
            </Box>

            {/* Systems & Modules Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Systems & Modules
              </Text>
              <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
                <SystemsList id={id} disabled={!selectedChassis} readOnly={!isEditable} />
                <ModulesList id={id} disabled={!selectedChassis} readOnly={!isEditable} />
              </Grid>
            </Box>

            {/* Storage Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Storage
              </Text>
              <CargoList id={id} disabled={!selectedChassis} readOnly={!isEditable} />
            </Box>

            {/* Notes Section */}
            <Box>
              <Text variant="pseudoheader" fontSize="lg" mb={4}>
                Notes
              </Text>
              <Notes
                notes={mech?.notes ?? ''}
                onChange={(value) => updateMech.mutate({ id, updates: { notes: value } })}
                disabled={!isEditable}
                incomplete={!selectedChassis}
                backgroundColor="bg.builder.mech"
                placeholder="Add notes about your mech..."
              />
            </Box>

            {/* Pilot Section */}
            {!isLocal && (
              <Box>
                <Text variant="pseudoheader" fontSize="lg" mb={4}>
                  Pilot
                </Text>
                <VStack gap={6} align="stretch">
                  {pilotContent}
                </VStack>
              </Box>
            )}
          </VStack>

          {!isLocal && (
            <DeleteEntity
              entityName="Mech"
              onConfirmDelete={() =>
                deleteMech.mutate(id, {
                  onSuccess: () => {
                    navigate({ to: '/dashboard/mechs' })
                  },
                })
              }
              disabled={!isEditable || !id || updateMech.isPending}
            />
          )}
        </>
      ) : (
        <LiveSheetLayout>
          {commonContent}

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
                <SystemsList id={id} disabled={!selectedChassis} readOnly={!isEditable} />

                <ModulesList id={id} disabled={!selectedChassis} readOnly={!isEditable} />
              </Grid>
            </Tabs.Content>

            <Tabs.Content value="storage">
              <Box mt={6}>
                <CargoList id={id} disabled={!selectedChassis} readOnly={!isEditable} />
              </Box>
            </Tabs.Content>

            <Tabs.Content value="notes">
              <Box mt={6}>
                <Notes
                  notes={mech?.notes ?? ''}
                  onChange={(value) => updateMech.mutate({ id, updates: { notes: value } })}
                  disabled={!isEditable}
                  incomplete={!selectedChassis}
                  backgroundColor="bg.builder.mech"
                  placeholder="Add notes about your mech..."
                />
              </Box>
            </Tabs.Content>

            {!isLocal && (
              <Tabs.Content value="pilot">
                <VStack gap={6} align="stretch" mt={6}>
                  {pilotContent}
                </VStack>
              </Tabs.Content>
            )}
          </Tabs.Root>

          {!isLocal && (
            <DeleteEntity
              entityName="Mech"
              onConfirmDelete={() =>
                deleteMech.mutate(id, {
                  onSuccess: () => {
                    navigate({ to: '/dashboard/mechs' })
                  },
                })
              }
              disabled={!isEditable || !id || updateMech.isPending}
            />
          )}
        </LiveSheetLayout>
      )}
    </LiveSheetStateGuard>
  )
}
