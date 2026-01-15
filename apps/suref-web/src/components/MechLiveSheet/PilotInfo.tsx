import { Flex, Text, VStack } from '@chakra-ui/react'
import { Card } from '../shared/Card'
import { SheetSelect } from '../shared/SheetSelect'
import { LinkButton } from '../shared/LinkButton'
import { useEntityRelationships } from '../../hooks/useEntityRelationships'
import { useHydratedPilot } from '../../hooks/pilot'
import { DiscordSignInButton } from '../DiscordSignInButton'

interface PilotInfoProps {
  mechId?: string
  pilotId?: string | null
  onPilotChange: (pilotId: string | null) => void
  disabled?: boolean
}

export function PilotInfo({ mechId, pilotId, onPilotChange, disabled = false }: PilotInfoProps) {
  const { pilot, selectedClass, selectedAdvancedClass } = useHydratedPilot(pilotId ?? '')

  const { items: allPilots, loading: loadingPilots } = useEntityRelationships<{
    id: string
    callsign: string
    mech_id: string | null
  }>({
    table: 'pilots',
    selectFields: 'id, callsign, mech_id',
    orderBy: 'callsign',
  })

  const pilots = allPilots.filter((p) => !p.mech_id || p.id === pilotId)

  if (!mechId) {
    return (
      <Card
        rightContent={<DiscordSignInButton disabled={disabled} />}
        flex="1"
        title="Pilot"
        disabled={true}
        bg="su.orange"
      />
    )
  }

  if (!pilotId) {
    return (
      <Card flex="1" title="Pilot" disabled={disabled} bg="su.orange">
        <Flex justify="center" align="center" h="full" py={2}>
          <SheetSelect
            label="Pilot"
            value={pilotId ?? null}
            loading={loadingPilots}
            options={pilots.map((p) => ({ id: p.id, name: p.callsign }))}
            disabled={disabled}
            onChange={onPilotChange}
            placeholder="No Pilot"
          />
        </Flex>
      </Card>
    )
  }

  if (!pilot) {
    return (
      <Card flex="1" title="Pilot" disabled={disabled} bg="su.orange">
        <Flex justify="center" align="center" h="full" py={4}>
          <Text fontSize="sm" color="red.500" fontFamily="mono">
            Pilot not found
          </Text>
        </Flex>
      </Card>
    )
  }

  const className = selectedAdvancedClass?.ref.name ?? selectedClass?.ref.name ?? 'No Class'

  return (
    <Card flex="1" title={pilot.callsign} disabled={disabled} bg="su.orange">
      <VStack gap={3} align="stretch" py={2} px={3}>
        <Text fontSize="lg" fontWeight="bold" fontFamily="mono" textAlign="center">
          {pilot.callsign} the {className}
        </Text>
        <Flex justify="center">
          <LinkButton to={`/dashboard/pilots/${pilot.id}`} label="→ Pilot Page" />
        </Flex>
      </VStack>
    </Card>
  )
}
