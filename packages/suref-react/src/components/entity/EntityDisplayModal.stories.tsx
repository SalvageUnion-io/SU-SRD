import type { Story } from '@ladle/react'
import { Button } from '@chakra-ui/react'
import { EntityDisplayModal } from './EntityDisplayModal'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useState } from 'react'

export default {
  title: 'Entity/EntityDisplayModal',
}

const system = SalvageUnionReference.Systems.all()[0]

function ModalDemo() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button bg="su.black" color="su.white" onClick={() => setIsOpen(true)}>
        Open Entity Modal
      </Button>
      <EntityDisplayModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        schemaName="systems"
        entityId={system?.id ?? null}
      />
    </>
  )
}

export const Default: Story = () => <ModalDemo />

function NotFoundDemo() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button bg="su.orange" color="su.white" onClick={() => setIsOpen(true)}>
        Open Not Found Modal
      </Button>
      <EntityDisplayModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        schemaName="systems"
        entityId="nonexistent-id"
      />
    </>
  )
}

export const NotFound: Story = () => <NotFoundDemo />
