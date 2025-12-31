import { useNavigate } from '@tanstack/react-router'
import { Box, Flex, Tabs } from '@chakra-ui/react'
import type { SURefClass } from '../../reference'
import { PilotInfoInputs } from './PilotInfoInputs'
import { PilotResourceSteppers } from './PilotResourceSteppers'
import { ClassAbilitiesList } from './ClassAbilitiesList'
import { GeneralAbilitiesList } from './GeneralAbilitiesList'
import { PilotInventory } from './PilotInventory'
import { PilotModulesSystems } from './PilotModulesSystems'
import { CrawlerTab } from './CrawlerTab'
import { MechsTab } from './MechsTab'
import { LiveSheetLayout } from '../shared/LiveSheetLayout'
import { LiveSheetControlBar } from '../shared/LiveSheetControlBar'
import { Notes } from '../shared/Notes'
import { DeleteEntity } from '../shared/DeleteEntity'
import { LiveSheetAssetDisplay } from '../shared/LiveSheetAssetDisplay'
import { useUpdatePilot, useHydratedPilot, useDeletePilot } from '../../hooks/pilot'
import { useImageUpload } from '../../hooks/useImageUpload'
import { useIsEditable } from '../../hooks/useIsEditable'
import { LiveSheetStateGuard } from '../shared/LiveSheetStateGuard'

interface PilotLiveSheetProps {
  id: string
}

export default function PilotLiveSheet({ id }: PilotLiveSheetProps) {
  const navigate = useNavigate()

  const { pilot, isLocal, selectedClass, selectedAdvancedClass, modules, systems, loading, error } =
    useHydratedPilot(id)

  const updatePilot = useUpdatePilot()
  const deletePilot = useDeletePilot()

  const isEditable = useIsEditable(pilot, isLocal)

  const selectedClassRef = selectedClass?.ref as SURefClass | undefined
  const selectedAdvancedClassRef = selectedAdvancedClass?.ref as SURefClass | undefined

  // Use hybrid class asset_url if hybrid class is selected and no custom photo is uploaded
  // Otherwise, use core class asset_url
  const defaultAssetUrl = selectedAdvancedClassRef?.asset_url ?? selectedClassRef?.asset_url
  const defaultAlt = selectedAdvancedClassRef?.name ?? selectedClassRef?.name

  const { handleUpload, isUploading } = useImageUpload({
    entityType: 'pilots',
    entityId: id,
    getCurrentImageUrl: () => pilot?.image_url ?? null,
    queryKey: ['pilots', id],
  })

  return (
    <LiveSheetStateGuard entityType="Pilot" entity={pilot} loading={loading} error={error}>
      <LiveSheetLayout>
        {!isLocal && (
          <LiveSheetControlBar
            bg="su.orange"
            hasPendingChanges={updatePilot.isPending}
            active={pilot?.active ?? false}
            onActiveChange={(active) => updatePilot.mutate({ id, updates: { active } })}
            isPrivate={pilot?.private ?? true}
            onPrivateChange={(isPrivate) =>
              updatePilot.mutate({ id, updates: { private: isPrivate } })
            }
            disabled={!isEditable}
          />
        )}
        <Flex gap={2} w="full">
          <LiveSheetAssetDisplay
            bg={selectedClass ? 'su.orange' : 'su.grey'}
            url={defaultAssetUrl}
            userImageUrl={(pilot as { image_url?: string })?.image_url}
            alt={defaultAlt}
            onUpload={!isLocal && isEditable ? handleUpload : undefined}
            isUploading={isUploading}
          />

          <PilotInfoInputs disabled={!isEditable} incomplete={!selectedClass} id={id} />

          <PilotResourceSteppers id={id} disabled={!isEditable} incomplete={!selectedClass} />
        </Flex>

        <Tabs.Root defaultValue="class-abilities">
          <Tabs.List borderColor="border.default">
            <Tabs.Trigger value="class-abilities" color="fg.default">
              Class Abilities
            </Tabs.Trigger>
            <Tabs.Trigger value="general-abilities" color="fg.default">
              General Abilities
            </Tabs.Trigger>
            <Tabs.Trigger value="inventory" color="fg.default">
              Inventory
            </Tabs.Trigger>
            {(modules.length > 0 || systems.length > 0) && (
              <Tabs.Trigger value="modules-systems" color="fg.default">
                Modules & Systems
              </Tabs.Trigger>
            )}
            <Tabs.Trigger value="notes" color="fg.default">
              Notes
            </Tabs.Trigger>
            <Box flex="1" />
            {!isLocal && (
              <Tabs.Trigger value="mechs" color="fg.default">
                Mechs
              </Tabs.Trigger>
            )}
            {!isLocal && (
              <Tabs.Trigger value="crawler" color="fg.default">
                Crawler
              </Tabs.Trigger>
            )}
          </Tabs.List>

          <Tabs.Content value="class-abilities">
            <Box mt={6}>
              <ClassAbilitiesList
                id={id}
                selectedClass={selectedClass?.ref as SURefClass | undefined}
                selectedAdvancedClass={selectedAdvancedClass?.ref as SURefClass | undefined}
                hideUnchosen={!isEditable}
              />
            </Box>
          </Tabs.Content>

          <Tabs.Content value="general-abilities">
            <Box mt={6}>
              <GeneralAbilitiesList />
            </Box>
          </Tabs.Content>

          <Tabs.Content value="inventory">
            <Box mt={6}>
              <PilotInventory id={id} disabled={!selectedClass} readOnly={!isEditable} />
            </Box>
          </Tabs.Content>

          {(modules.length > 0 || systems.length > 0) && (
            <Tabs.Content value="modules-systems">
              <Box mt={6}>
                <PilotModulesSystems id={id} disabled={!selectedClass} />
              </Box>
            </Tabs.Content>
          )}

          {!isLocal && (
            <Tabs.Content value="mechs">
              <Box mt={6}>
                <MechsTab pilotId={id} isLocal={isLocal} isEditable={isEditable} />
              </Box>
            </Tabs.Content>
          )}

          <Tabs.Content value="notes">
            <Box mt={6}>
              <Notes
                notes={pilot?.notes ?? ''}
                onChange={(value) => updatePilot.mutate({ id, updates: { notes: value } })}
                backgroundColor="bg.builder.pilot"
                placeholder="Add notes about your pilot..."
                disabled={!isEditable}
                incomplete={!selectedClass}
              />
            </Box>
          </Tabs.Content>

          {!isLocal && (
            <Tabs.Content value="crawler">
              <CrawlerTab pilot={pilot} pilotId={id} isLocal={isLocal} isEditable={isEditable} />
            </Tabs.Content>
          )}
        </Tabs.Root>

        {!isLocal && (
          <Box mt={6}>
            <DeleteEntity
              entityName="Pilot"
              onConfirmDelete={async () => {
                await deletePilot.mutateAsync(id)
                navigate({ to: '/dashboard/pilots' })
              }}
              disabled={!isEditable || !id || updatePilot.isPending}
            />
          </Box>
        )}
      </LiveSheetLayout>
    </LiveSheetStateGuard>
  )
}
