import type { Story } from '@ladle/react'
import { Text } from './Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Text',
}

/** Every Text variant on one page — body, pseudoheader (three sizes), inverse. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5">
    <div className="flex flex-col gap-2">
      <code className="font-mono text-nano text-ink-2">default (body)</code>
      <Text>Default body text — the Fira Code monospace face.</Text>
    </div>
    <div className="flex flex-col gap-2">
      <code className="font-mono text-nano text-ink-2">variant="pseudoheader" (lg / sm / xs)</code>
      <Text variant="pseudoheader">Pseudoheader Label</Text>
      <Text variant="pseudoheader" className="text-sm">
        Smaller Pseudoheader
      </Text>
      <Text variant="pseudoheader" className="text-xs">
        Extra Small Pseudoheader
      </Text>
    </div>
    <div className="flex flex-col gap-2 bg-ink p-3">
      <code className="font-mono text-nano text-paper/70">variant="pseudoheaderInverse"</code>
      <Text variant="pseudoheaderInverse">Inverse Pseudoheader</Text>
      <Text variant="pseudoheaderInverse" className="text-sm">
        Smaller Inverse
      </Text>
    </div>
  </div>
)
