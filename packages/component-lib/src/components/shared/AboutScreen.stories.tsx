import type { Story } from '@ladle/react'
import { AboutScreen } from './AboutScreen'

export default {
  title: 'Compositions/About Screen',
}

/**
 * The app's About page. `version` is a prop rather than an import, so the
 * screen is app-agnostic — each app passes its own.
 */
export const Default: Story = () => <AboutScreen version="1.4.2" />
