import { useCallback } from 'react'
import { VStack, Button } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { SheetInput } from '../shared/SheetInput'
import type { UseCrawlerWizardStateReturn } from './useCrawlerWizardState'

interface CrawlerNameStepProps {
  wizardState: UseCrawlerWizardStateReturn
  onCreateCrawler: () => void
}

export function CrawlerNameStep({ wizardState, onCreateCrawler }: CrawlerNameStepProps) {
  const { state, setName } = wizardState

  const isComplete = !!state.name.trim()

  const handleCreate = useCallback(() => {
    if (isComplete) {
      onCreateCrawler()
    }
  }, [isComplete, onCreateCrawler])

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={4} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Name Your Crawler
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          Give your crawler a name. This will be displayed on the crawler sheet.
        </Text>

        <VStack gap={0} align="stretch" w="full">
          <SheetInput
            label="Crawler Name"
            value={state.name}
            onChange={setName}
            placeholder="Enter crawler name..."
          />
        </VStack>
      </VStack>

      <Button
        w="full"
        bg={isComplete ? 'su.orange' : 'gray.400'}
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={isComplete ? { bg: 'su.black' } : {}}
        disabled={!isComplete}
        _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
        onClick={handleCreate}
      >
        CREATE CRAWLER
      </Button>
    </VStack>
  )
}
