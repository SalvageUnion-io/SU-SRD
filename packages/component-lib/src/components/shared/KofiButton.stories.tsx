import type { Story } from '@ladle/react'
import { KofiButton } from './KofiButton'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Kofi Button',
}

/**
 * The official Ko-fi support widget button (the real SU page code). Progressive
 * enhancement: an accessible fallback link renders immediately and is replaced
 * by the widget once Ko-fi's script loads — if the script is blocked in Ladle,
 * the fallback link remains. (External-integration chrome — pending approval.)
 */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <KofiButton code="C3Z82382ZC" />
  </div>
)
