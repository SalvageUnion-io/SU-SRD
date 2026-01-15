import { Grid, VStack, Text } from '@chakra-ui/react'
import { useMemo } from 'react'
import { getTechLevelNumber, type SURefSystem, type SURefModule } from 'salvageunion-reference'
import { useHydratedPilot } from '../../hooks/pilot'
import { Card } from '../shared/Card'

interface PilotModulesSystemsProps {
  id: string
  disabled?: boolean
}

export function PilotModulesSystems({ id, disabled = false }: PilotModulesSystemsProps) {
  const { modules, systems } = useHydratedPilot(id)

  const sortedModules = useMemo(() => {
    return modules
      .map((m) => m.ref as SURefModule)
      .sort((a, b) => {
        const aTechLevel = getTechLevelNumber(a) ?? 0
        const bTechLevel = getTechLevelNumber(b) ?? 0
        if (aTechLevel !== bTechLevel) {
          return aTechLevel - bTechLevel
        }
        return a.name.localeCompare(b.name)
      })
  }, [modules])

  const sortedSystems = useMemo(() => {
    return systems
      .map((s) => s.ref as SURefSystem)
      .sort((a, b) => {
        const aTechLevel = getTechLevelNumber(a) ?? 0
        const bTechLevel = getTechLevelNumber(b) ?? 0
        if (aTechLevel !== bTechLevel) {
          return aTechLevel - bTechLevel
        }
        return a.name.localeCompare(b.name)
      })
  }, [systems])

  return (
    <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
      <Card bg="bg.builder.pilot" title="Systems" disabled={disabled}>
        <VStack gap={2} w="full" alignItems="flex-start">
          {sortedSystems.length === 0 ? (
            <Text color="gray.500" fontStyle="italic">
              No systems
            </Text>
          ) : (
            sortedSystems.map((system) => (
              <Text key={system.id} fontSize="sm">
                {system.name}
              </Text>
            ))
          )}
        </VStack>
      </Card>

      <Card bg="bg.builder.pilot" title="Modules" disabled={disabled}>
        <VStack gap={2} w="full" alignItems="flex-start">
          {sortedModules.length === 0 ? (
            <Text color="gray.500" fontStyle="italic">
              No modules
            </Text>
          ) : (
            sortedModules.map((module) => (
              <Text key={module.id} fontSize="sm">
                {module.name}
              </Text>
            ))
          )}
        </VStack>
      </Card>
    </Grid>
  )
}
