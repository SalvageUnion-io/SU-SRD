import type { Story } from '@ladle/react'
import aboutMd from '../../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../../LLM_STATEMENT.md?raw'
import { AboutScreen } from './AboutScreen'

export default {
  title: 'Compositions/About Screen',
}

/**
 * The app's About page. `version`, `aboutJrvs` and `llmStatement` are props
 * rather than imports, so the screen is app-agnostic — each app passes its own
 * version and inlines the repo-root documents the way its build allows.
 */
export const Default: Story = () => (
  <AboutScreen version="1.4.2" aboutJrvs={aboutMd} llmStatement={statementMd} />
)
