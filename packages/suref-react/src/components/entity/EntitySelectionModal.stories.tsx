import type { Story } from '@ladle/react'
import { EntitySelectionModal } from './EntitySelectionModal'
import { useState } from 'react'

export default {
  title: 'Entity/EntitySelectionModal',
}

function SelectionDemo() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button
        className="bg-su-black text-su-white px-4 py-2 font-mono"
        onClick={() => setIsOpen(true)}
      >
        Select a System
      </button>
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
      <button
        className="bg-su-orange text-su-white px-4 py-2 font-mono"
        onClick={() => setIsOpen(true)}
      >
        Select System or Module
      </button>
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
