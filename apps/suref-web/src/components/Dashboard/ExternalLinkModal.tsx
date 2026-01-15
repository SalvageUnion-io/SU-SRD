import { useState } from 'react'
import { Box, Flex, Input, Text, VStack } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import Modal from '../Modal'

interface ExternalLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (name: string, url: string) => void
}

export function ExternalLinkModal({ isOpen, onClose, onAdd }: ExternalLinkModalProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const isValid = name.trim() !== '' && url.trim() !== ''

  const handleSubmit = () => {
    if (isValid) {
      onAdd(name.trim(), url.trim())
      setName('')
      setUrl('')
      onClose()
    }
  }

  const handleClose = () => {
    setName('')
    setUrl('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add External Link">
      <VStack gap={4} alignItems="stretch">
        <Box>
          <Text as="label" display="block" fontSize="sm" fontWeight="bold" color="su.white" mb={2}>
            Title
          </Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter link title..."
            bg="su.white"
            color="su.black"
            borderWidth="2px"
            borderColor="su.black"
          />
        </Box>

        <Box>
          <Text as="label" display="block" fontSize="sm" fontWeight="bold" color="su.white" mb={2}>
            URL
          </Text>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            bg="su.white"
            color="su.black"
            borderWidth="2px"
            borderColor="su.black"
          />
        </Box>

        <Flex gap={2} justifyContent="flex-end" pt={2}>
          <Button
            onClick={handleClose}
            bg="brand.srd"
            color="su.white"
            px={4}
            py={2}
            fontWeight="bold"
            _hover={{ opacity: 0.9 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            bg="su.orange"
            color="su.white"
            px={4}
            py={2}
            fontWeight="bold"
            _hover={{ opacity: 0.9 }}
            _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            Add Link
          </Button>
        </Flex>
      </VStack>
    </Modal>
  )
}
