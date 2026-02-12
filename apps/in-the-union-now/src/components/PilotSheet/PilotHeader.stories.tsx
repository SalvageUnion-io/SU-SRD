import type { Story } from '@ladle/react'
import { PilotHeader } from './PilotHeader'
import type { Pilot } from '../../types/common'

export default { title: 'PilotSheet/PilotHeader' }

const basePilot: Pilot = {
  id: 'mock-pilot-1',
  user_id: 'mock-user',
  callsign: 'Rust',
  class_ref: 'engineer',
  advanced_class_ref: null,
  max_hp: 10,
  current_hp: 8,
  max_ap: 5,
  current_ap: 3,
  current_tp: 1,
  appearance: 'Grizzled veteran with cybernetic arm',
  background: 'Former factory worker',
  keepsake: 'Rusty wrench from first job',
  motto: 'If it moves, I can fix it',
  background_used: false,
  keepsake_used: false,
  motto_used: false,
  notes: '',
  image_url: null,
  crawler_id: null,
  active: true,
  private: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export const Default: Story = () => (
  <PilotHeader
    pilot={basePilot}
    onUpdate={(field, value) => console.log('Update:', field, value)}
  />
)

export const LowHP: Story = () => (
  <PilotHeader
    pilot={{
      ...basePilot,
      current_hp: 2,
      current_ap: 1,
      current_tp: 0,
    }}
    onUpdate={(field, value) => console.log('Update:', field, value)}
  />
)
LowHP.meta = {
  description: 'A pilot in rough shape with low HP, AP, and no TP.',
}

export const FullResources: Story = () => (
  <PilotHeader
    pilot={{
      ...basePilot,
      current_hp: 10,
      current_ap: 5,
      current_tp: 3,
    }}
    onUpdate={(field, value) => console.log('Update:', field, value)}
  />
)

export const NoClass: Story = () => (
  <PilotHeader
    pilot={{
      ...basePilot,
      class_ref: null,
      callsign: 'New Recruit',
    }}
    onUpdate={(field, value) => console.log('Update:', field, value)}
  />
)
NoClass.meta = {
  description: 'A pilot with no class selected yet. The class line below the callsign is hidden.',
}

export const AdvancedClass: Story = () => (
  <PilotHeader
    pilot={{
      ...basePilot,
      callsign: 'Ironjaw',
      class_ref: 'hauler',
      advanced_class_ref: 'siege_specialist',
    }}
    onUpdate={(field, value) => console.log('Update:', field, value)}
  />
)

export const EmptyCallsign: Story = () => (
  <PilotHeader
    pilot={{
      ...basePilot,
      callsign: '',
    }}
    onUpdate={(field, value) => console.log('Update:', field, value)}
  />
)
EmptyCallsign.meta = {
  description: 'Pilot with no callsign shows the placeholder text from InlineEdit.',
}

export const MobileWidth: Story = () => (
  <div className="w-80">
    <PilotHeader
      pilot={basePilot}
      onUpdate={(field, value) => console.log('Update:', field, value)}
    />
  </div>
)
MobileWidth.meta = {
  description:
    'Constrained to 320px width to simulate mobile layout. Resource steppers should wrap.',
}
