import { useNavigate } from '@tanstack/react-router'
import { Box, Tabs } from '@chakra-ui/react'
import { LiveSheetLayout } from '../shared/LiveSheetLayout'
import { LiveSheetControlBar } from '../shared/LiveSheetControlBar'
import { Notes } from '../shared/Notes'
import { DeleteEntity } from '../shared/DeleteEntity'
import { LiveSheetLoadingState } from '../shared/LiveSheetLoadingState'
import { LiveSheetNotFoundState } from '../shared/LiveSheetNotFoundState'
import { LiveSheetErrorState } from '../shared/LiveSheetErrorState'
import { useUpdatePilot, useHydratedPilot, useDeletePilot } from '../../hooks/pilot'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useIsMutating } from '@tanstack/react-query'
import { isOwner } from '../../lib/permissions'
import { PilotSection } from './TopMatter/PilotSection'
import { ActiveMechSection } from './TopMatter/ActiveMechSection'
import { CrawlerSection } from './TopMatter/CrawlerSection'
import { ActionsList } from './ActionsTab/ActionsList'
import { CrawlerTab } from './CrawlerTab'
import { MechTab } from './MechTab'
import { InactiveMechsTab } from './InactiveMechsTab'

interface NewPilotLiveSheetProps {
  id: string
}

export default function NewPilotLiveSheet({ id }: NewPilotLiveSheetProps) {
  const navigate = useNavigate()

  const { pilot, isLocal, selectedClass, loading, error } = useHydratedPilot(id)

  const updatePilot = useUpdatePilot()
  const deletePilot = useDeletePilot()

  const { userId } = useCurrentUser()

  const isEditable = isLocal || (pilot ? isOwner(pilot.user_id, userId) : false)

  const mutatingCount = useIsMutating()
  const hasPendingChanges = mutatingCount > 0

  if (!pilot && !loading) {
    return <LiveSheetNotFoundState entityType="Pilot" />
  }

  if (loading) {
    return <LiveSheetLoadingState entityType="Pilot" />
  }

  if (error) {
    return <LiveSheetErrorState entityType="Pilot" error={error} />
  }

  return (
    <LiveSheetLayout>
      {!isLocal && (
        <LiveSheetControlBar
          bg="su.orange"
          hasPendingChanges={hasPendingChanges}
          active={pilot?.active ?? false}
          onActiveChange={(active) => updatePilot.mutate({ id, updates: { active } })}
          isPrivate={pilot?.private ?? true}
          onPrivateChange={(isPrivate) =>
            updatePilot.mutate({ id, updates: { private: isPrivate } })
          }
          disabled={!isEditable}
        />
      )}

      <PilotSection id={id} isEditable={isEditable} isLocal={isLocal} />
      <ActiveMechSection pilotId={id} isEditable={isEditable} isLocal={isLocal} />
      <CrawlerSection pilotId={id} isEditable={isEditable} isLocal={isLocal} />

      <Tabs.Root defaultValue="actions">
        <Tabs.List borderColor="border.default">
          <Tabs.Trigger value="actions" color="fg.default">
            Actions
          </Tabs.Trigger>
          <Tabs.Trigger value="mech" color="fg.default">
            Mech
          </Tabs.Trigger>
          <Tabs.Trigger value="crawler" color="fg.default">
            Crawler
          </Tabs.Trigger>
          <Tabs.Trigger value="inactive-mechs" color="fg.default">
            Inactive Mechs
          </Tabs.Trigger>
          <Tabs.Trigger value="notes" color="fg.default">
            Notes
          </Tabs.Trigger>
          <Box flex="1" />
          {!isLocal && (
            <Tabs.Trigger value="delete" color="fg.default">
              Delete
            </Tabs.Trigger>
          )}
        </Tabs.List>

        <Tabs.Content value="actions">
          <Box mt={6}>
            <ActionsList pilotId={id} />
          </Box>
        </Tabs.Content>

        {!isLocal && (
          <Tabs.Content value="mech">
            <MechTab pilotId={id} isLocal={isLocal} isEditable={isEditable} />
          </Tabs.Content>
        )}

        {!isLocal && (
          <Tabs.Content value="crawler">
            <CrawlerTab pilot={pilot} pilotId={id} isLocal={isLocal} isEditable={isEditable} />
          </Tabs.Content>
        )}

        {!isLocal && (
          <Tabs.Content value="inactive-mechs">
            <Box mt={6}>
              <InactiveMechsTab pilotId={id} isEditable={isEditable} />
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
          <Tabs.Content value="delete">
            <Box mt={6}>
              <DeleteEntity
                entityName="Pilot"
                onConfirmDelete={() => {
                  deletePilot.mutate(id, {
                    onSuccess: () => navigate({ to: '/dashboard/pilots' }),
                  })
                }}
                disabled={!isEditable || !id || updatePilot.isPending}
              />
            </Box>
          </Tabs.Content>
        )}
      </Tabs.Root>
    </LiveSheetLayout>
  )
}
