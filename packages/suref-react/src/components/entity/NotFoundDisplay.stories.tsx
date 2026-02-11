import type { Story } from '@ladle/react'
import { NotFoundDisplay } from './NotFoundDisplay'

export default {
  title: 'Entity/NotFoundDisplay',
}

export const WithTypeAndId: Story = () => (
  <div className="w-[500px]">
    <NotFoundDisplay entityType="System" entityId="laser-cannon-mk5" />
  </div>
)

export const WithIdOnly: Story = () => (
  <div className="w-[500px]">
    <NotFoundDisplay entityId="unknown-entity-123" />
  </div>
)

export const Generic: Story = () => (
  <div className="w-[500px]">
    <NotFoundDisplay />
  </div>
)

export const WithCloseButton: Story = () => (
  <div className="w-[500px]">
    <NotFoundDisplay
      entityType="Module"
      entityId="missing-module"
      onClose={() => alert('Closed!')}
    />
  </div>
)
