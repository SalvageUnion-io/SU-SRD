import type { Story } from '@ladle/react'
import { Button } from '@chakra-ui/react'
import { EntitySelectionModal } from './EntitySelectionModal'
import { useState } from 'react'

export default {
  title: 'Entity/EntitySelectionModal',
}

function SelectionDemo() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button bg="su.black" color="su.white" onClick={() => setIsOpen(true)}>
        Select a System
      </Button>
      <EntitySelectionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        schemaNames={['systems']}
        onSelect={(entityId, schemaName) => {
          alert(`Selected: ${schemaName}/${entityId}`)
          setIsOpen(false)
        }}
        title="Select System"
      />
    </>
  )
}

export const SingleSchema: Story = () => <SelectionDemo />

function MultiSchemaDemo() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button bg="su.orange" color="su.white" onClick={() => setIsOpen(true)}>
        Select System or Module
      </Button>
      <EntitySelectionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        schemaNames={['systems', 'modules']}
        onSelect={(entityId, schemaName) => {
          alert(`Selected: ${schemaName}/${entityId}`)
          setIsOpen(false)
        }}
        title="Select Equipment"
        selectButtonTextPrefix="Equip"
      />
    </>
  )
}

export const MultipleSchemas: Story = () => <MultiSchemaDemo />
