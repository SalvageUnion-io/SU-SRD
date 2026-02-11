import { useState } from 'react'
import type { Story } from '@ladle/react'
import { ActionCard } from './ActionCard'
import type { ItemCondition } from '../../../types/common'

export default { title: 'PilotSheet/ActionCard' }

export const BasicAction: Story = () => (
  <ActionCard name="Move" description="Move your mech up to its movement speed." />
)
BasicAction.meta = {
  description: 'A minimal action with just a name and description. Click to expand.',
}

export const FullAction: Story = () => {
  const [condition, setCondition] = useState<ItemCondition>('intact')
  return (
    <ActionCard
      name="Scrap Cannon"
      description="Fire a devastating blast of salvaged metal and debris at a target. This weapon is inaccurate at long range but devastating up close."
      actionType="turn"
      source="Mule Chassis"
      apCost={0}
      epCost={1}
      range="Close-Medium"
      damage="3d6"
      condition={condition}
      onConditionChange={setCondition}
      traits={['Inaccurate', 'Devastating']}
    />
  )
}
FullAction.meta = {
  description: 'A weapon action with all props populated. Click to expand and see full details.',
}

export const TurnActionWithCosts: Story = () => {
  const [condition, setCondition] = useState<ItemCondition>('intact')
  return (
    <ActionCard
      name="Repair System"
      description="Spend AP to restore SP to your mech. Restores 1d6 SP per AP spent."
      actionType="turn"
      source="Engineer Class"
      apCost={2}
      epCost={0}
      condition={condition}
      onConditionChange={setCondition}
    />
  )
}

export const ReactionAction: Story = () => (
  <ActionCard
    name="Brace for Impact"
    description="When you are hit by an attack, reduce the damage by 2."
    actionType="reaction"
    source="Pilot Ability"
  />
)

export const FreeAction: Story = () => (
  <ActionCard
    name="Survey the Field"
    description="Gain awareness of nearby threats and opportunities."
    actionType="free"
    source="Scout Class"
  />
)

export const DestroyedCondition: Story = () => {
  const [condition, setCondition] = useState<ItemCondition>('destroyed')
  return (
    <ActionCard
      name="Thermal Lance"
      description="A high-powered cutting beam designed for salvage operations, repurposed as a weapon."
      actionType="turn"
      source="Arm Module"
      epCost={2}
      range="Close"
      damage="2d6+2"
      condition={condition}
      onConditionChange={setCondition}
      traits={['Heat +1', 'Piercing']}
    />
  )
}
DestroyedCondition.meta = {
  description: 'A destroyed system renders at reduced opacity.',
}

export const DamagedCondition: Story = () => {
  const [condition, setCondition] = useState<ItemCondition>('damaged')
  return (
    <ActionCard
      name="Shield Module"
      description="Activate to grant temporary armor for one round."
      actionType="turn"
      source="Torso Module"
      epCost={1}
      condition={condition}
      onConditionChange={setCondition}
    />
  )
}

export const SystemWithTraits: Story = () => {
  const [condition, setCondition] = useState<ItemCondition>('intact')
  return (
    <ActionCard
      name="Missile Barrage"
      description="Launch a salvo of guided missiles at up to 3 targets within range."
      actionType="turn"
      source="Shoulder Mount"
      epCost={3}
      range="Medium-Long"
      damage="2d6 per missile"
      condition={condition}
      onConditionChange={setCondition}
      traits={['Guided', 'Area', 'Ammo 3', 'Heat +2']}
    />
  )
}
SystemWithTraits.meta = {
  description: 'A system with multiple traits displayed as chips.',
}

export const PilotAbility: Story = () => (
  <ActionCard
    name="Field Repairs"
    description="During a short rest, you may repair one damaged system on your mech or an ally's mech without spending scrap."
    actionType="short"
    source="Engineer Class Ability"
  />
)
PilotAbility.meta = {
  description: 'A pilot ability with no condition control (condition prop not passed).',
}

export const DowntimeAction: Story = () => (
  <ActionCard
    name="Scavenge for Parts"
    description="Spend downtime searching the surrounding area for useful salvage. Roll to determine what you find."
    actionType="downtime"
    source="Universal Action"
  />
)

export const MultipleCards: Story = () => {
  const [c1, setC1] = useState<ItemCondition>('intact')
  const [c2, setC2] = useState<ItemCondition>('damaged')
  const [c3, setC3] = useState<ItemCondition>('destroyed')

  return (
    <div className="flex flex-col gap-2">
      <ActionCard
        name="Scrap Cannon"
        actionType="turn"
        source="Arm Module"
        epCost={1}
        range="Close-Medium"
        damage="3d6"
        condition={c1}
        onConditionChange={setC1}
        traits={['Devastating']}
      />
      <ActionCard
        name="Shield Module"
        actionType="reaction"
        source="Torso Module"
        epCost={1}
        condition={c2}
        onConditionChange={setC2}
      />
      <ActionCard
        name="Thermal Lance"
        actionType="turn"
        source="Arm Module"
        epCost={2}
        range="Close"
        damage="2d6+2"
        condition={c3}
        onConditionChange={setC3}
        traits={['Heat +1', 'Piercing']}
      />
      <ActionCard
        name="Move"
        description="Move your mech up to its movement speed."
        actionType="free"
      />
    </div>
  )
}
MultipleCards.meta = {
  description: 'Several action cards stacked as they would appear in the actions tab.',
}
