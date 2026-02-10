import { lazy, Suspense } from 'react'
import { useParams, useSearch } from '@tanstack/react-router'
import { Flex, Text, Box } from '@chakra-ui/react'
import PilotLiveSheet from '../PilotLiveSheet'

const NewPilotLiveSheet = lazy(() =>
  import('../NewPilotLiveSheet').then((m) => ({ default: m.default }))
)

export function PilotEdit() {
  const params = useParams({ from: '/dashboard/pilots/$id' })
  const search = useSearch({ from: '/dashboard/pilots/$id' })
  const id = params.id
  const useNewSheet = search?.new === true || search?.new === 'true'

  if (!id) {
    return (
      <Flex align="center" justify="center" minH="100vh">
        <Text fontSize="xl" color="red.600">
          Error: No pilot ID provided
        </Text>
      </Flex>
    )
  }

  if (useNewSheet) {
    return (
      <Suspense
        fallback={
          <Box p={8}>
            <Text>Loading New Pilot Live Sheet...</Text>
          </Box>
        }
      >
        <NewPilotLiveSheet id={id} />
      </Suspense>
    )
  }

  return <PilotLiveSheet id={id} />
}
