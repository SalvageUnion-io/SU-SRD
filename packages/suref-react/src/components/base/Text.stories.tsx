import type { Story } from '@ladle/react'
import { Text } from './Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Text',
}

export const DefaultText: Story = () => (
  <Text>This is default body text using the Fira Code monospace font.</Text>
)

export const Pseudoheader: Story = () => (
  <div className="flex flex-col gap-2">
    <Text variant="pseudoheader">Pseudoheader Label</Text>
    <Text variant="pseudoheader" className="text-sm">
      Smaller Pseudoheader
    </Text>
    <Text variant="pseudoheader" className="text-xs">
      Extra Small Pseudoheader
    </Text>
  </div>
)

export const PseudoheaderInverse: Story = () => (
  <div className="flex flex-col gap-2 bg-su-black p-4">
    <Text variant="pseudoheaderInverse">Inverse Pseudoheader</Text>
    <Text variant="pseudoheaderInverse" className="text-sm">
      Smaller Inverse
    </Text>
  </div>
)

export const AllVariants: Story = () => (
  <div className="flex flex-col gap-3">
    <Text>Default text paragraph</Text>
    <Text variant="pseudoheader">Pseudoheader</Text>
    <Text variant="pseudoheaderInverse">Pseudoheader Inverse</Text>
  </div>
)
