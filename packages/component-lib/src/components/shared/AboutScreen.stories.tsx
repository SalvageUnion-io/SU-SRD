import type { Story } from '@ladle/react'
import { AboutScreen } from './AboutScreen'

import statementMd from '../../../../../LLM_STATEMENT.md?raw'

export default {
  title: 'Compositions/About Screen',
}

/**
 * The app's About page. `version` and `llmStatement` are props rather than
 * imports, so the screen is app-agnostic — each app passes its own version and
 * inlines the repo-root `LLM_STATEMENT.md` the way its build allows.
 */
export const Default: Story = () => <AboutScreen version="1.4.2" llmStatement={statementMd} />
