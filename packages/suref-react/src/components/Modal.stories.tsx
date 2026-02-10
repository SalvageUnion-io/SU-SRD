import type { Story } from '@ladle/react'
import { Button, Box } from '@chakra-ui/react'
import Modal from './Modal'
import { useState } from 'react'
import { Text } from './base/Text'

export default {
  title: 'Shared/Modal',
}

function ModalDemo({ title, backgroundColor }: { title: string; backgroundColor?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button bg="su.black" color="su.white" onClick={() => setIsOpen(true)}>
        Open Modal
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        backgroundColor={backgroundColor}
      >
        <Text>This is the modal content. It can contain any React nodes.</Text>
        <Box mt={4}>
          <Text fontSize="sm">Scroll down for more content if needed.</Text>
        </Box>
      </Modal>
    </>
  )
}

export const Default: Story = () => <ModalDemo title="Select System" />

export const CustomBackground: Story = () => (
  <ModalDemo title="Crawler Bay" backgroundColor="su.pink" />
)
