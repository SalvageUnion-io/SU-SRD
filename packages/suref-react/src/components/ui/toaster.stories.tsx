import type { Story } from '@ladle/react'
import { Flex, Button } from '@chakra-ui/react'
import { toaster } from './toaster'
import { Toaster } from './ToasterComponent'

export default {
  title: 'UI/Toaster',
}

export const AllTypes: Story = () => (
  <>
    <Toaster />
    <Flex gap={3} flexWrap="wrap">
      <Button
        bg="su.green"
        color="su.white"
        onClick={() =>
          toaster.create({
            title: 'Success',
            description: 'Operation completed successfully.',
            type: 'success',
          })
        }
      >
        Success Toast
      </Button>
      <Button
        bg="su.orange"
        color="su.white"
        onClick={() =>
          toaster.create({
            title: 'Error',
            description: 'Something went wrong.',
            type: 'error',
          })
        }
      >
        Error Toast
      </Button>
      <Button
        bg="su.blue"
        color="su.white"
        onClick={() =>
          toaster.create({
            title: 'Info',
            description: 'Here is some information.',
            type: 'info',
          })
        }
      >
        Info Toast
      </Button>
      <Button
        bg="su.black"
        color="su.white"
        onClick={() =>
          toaster.create({
            title: 'Warning',
            description: 'Please be careful.',
            type: 'warning',
          })
        }
      >
        Warning Toast
      </Button>
    </Flex>
  </>
)
