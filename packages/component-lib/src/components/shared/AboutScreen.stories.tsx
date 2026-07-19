import type { Story } from '@ladle/react'
import { AboutScreen } from './AboutScreen'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/About Screen',
}

/**
 * The app's About page. `version` is a prop rather than an import, so the
 * screen is app-agnostic — each app passes its own.
 */
export const Default: Story = () => <AboutScreen version="1.4.2" />
