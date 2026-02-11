import type { Story } from '@ladle/react'
import { Heading } from './Heading'

export default {
  title: 'Base/Heading',
}

export const AllLevels: Story = () => (
  <div className="flex flex-col gap-4">
    <Heading level={1}>Heading Level 1</Heading>
    <Heading level={2}>Heading Level 2</Heading>
    <Heading level={3}>Heading Level 3</Heading>
    <Heading level={4}>Heading Level 4</Heading>
    <Heading level={5}>Heading Level 5</Heading>
    <Heading level={6}>Heading Level 6</Heading>
  </div>
)

export const H1: Story = () => <Heading level={1}>Salvage Union</Heading>

export const H2: Story = () => <Heading level={2}>Systems & Modules</Heading>

export const Default: Story = () => <Heading>Default (h2)</Heading>
