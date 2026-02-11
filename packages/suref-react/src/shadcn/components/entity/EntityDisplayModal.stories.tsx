import type { Story } from '@ladle/react'
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
      <button
        className="bg-su-black text-su-white px-4 py-2 font-mono"
        onClick={() => setIsOpen(true)}
      >
        Open Entity Modal
      </button>
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
      <button
        className="bg-su-orange text-su-white px-4 py-2 font-mono"
        onClick={() => setIsOpen(true)}
      >
        Open Not Found Modal
      </button>
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
