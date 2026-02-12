import type { Story } from '@ladle/react'
import { MechStrip } from './MechStrip'
import type { Mech } from '../../types/common'

export default { title: 'PilotSheet/MechStrip' }

const baseMech: Mech = {
  id: 'mock-mech-1',
  user_id: 'mock-user',
  pilot_id: 'mock-pilot-1',
  name: 'The Crusher',
  chassis_ref: 'mule',
  pattern_name: 'Standard Mule',
  current_sp: 5,
  max_sp: 8,
  current_ep: 4,
  max_ep: 6,
  current_heat: 2,
  heat_capacity: 4,
  appearance: 'Battle-scarred with custom paint',
  quirk: 'Squeaky left leg servo',
  notes: '',
  image_url: null,
  active: true,
  private: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const secondMech: Mech = {
  ...baseMech,
  id: 'mock-mech-2',
  name: 'Stinger',
  chassis_ref: 'hornet',
  pattern_name: 'Light Hornet',
  current_sp: 3,
  max_sp: 5,
  current_ep: 3,
  max_ep: 4,
  current_heat: 1,
  heat_capacity: 3,
}

const thirdMech: Mech = {
  ...baseMech,
  id: 'mock-mech-3',
  name: 'Bulwark',
  chassis_ref: 'tortoise',
  pattern_name: 'Heavy Tortoise',
  current_sp: 10,
  max_sp: 12,
  current_ep: 5,
  max_ep: 8,
  current_heat: 0,
  heat_capacity: 6,
}

export const Default: Story = () => (
  <MechStrip
    mech={baseMech}
    allMechs={[baseMech]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)

export const HighHeat: Story = () => (
  <MechStrip
    mech={{
      ...baseMech,
      current_heat: 4,
      heat_capacity: 4,
    }}
    allMechs={[baseMech]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)
HighHeat.meta = {
  description: 'Mech at maximum heat capacity. The HeatBar shows AT CAP severity.',
}

export const CriticalHeat: Story = () => (
  <MechStrip
    mech={{
      ...baseMech,
      current_heat: 3,
      heat_capacity: 4,
    }}
    allMechs={[baseMech]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)
CriticalHeat.meta = {
  description: 'Mech at 75% heat. The HeatBar shows CRITICAL severity.',
}

export const MultipleMechs: Story = () => (
  <MechStrip
    mech={baseMech}
    allMechs={[baseMech, secondMech, thirdMech]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)
MultipleMechs.meta = {
  description: 'When the pilot has multiple mechs, a dropdown switcher appears on the right.',
}

export const UnnamedMech: Story = () => (
  <MechStrip
    mech={{
      ...baseMech,
      name: '',
    }}
    allMechs={[{ ...baseMech, name: '' }]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)
UnnamedMech.meta = {
  description: 'A mech with no name displays "Unnamed Mech".',
}

export const NoChassis: Story = () => (
  <MechStrip
    mech={{
      ...baseMech,
      chassis_ref: null,
      name: 'Custom Build',
    }}
    allMechs={[{ ...baseMech, chassis_ref: null, name: 'Custom Build' }]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)
NoChassis.meta = {
  description: 'A mech with no chassis ref hides the parenthetical chassis label.',
}

export const LowResources: Story = () => (
  <MechStrip
    mech={{
      ...baseMech,
      current_sp: 1,
      current_ep: 0,
      current_heat: 3,
    }}
    allMechs={[baseMech]}
    onUpdate={(field, value) => console.log('Update:', field, value)}
    onSwitchMech={(id) => console.log('Switch to mech:', id)}
  />
)
LowResources.meta = {
  description: 'A mech in bad shape with very low SP, no EP, and high heat.',
}

export const MobileWidth: Story = () => (
  <div className="w-80">
    <MechStrip
      mech={baseMech}
      allMechs={[baseMech, secondMech]}
      onUpdate={(field, value) => console.log('Update:', field, value)}
      onSwitchMech={(id) => console.log('Switch to mech:', id)}
    />
  </div>
)
MobileWidth.meta = {
  description: 'Constrained to 320px width to simulate mobile layout.',
}
