import type { Story } from 'component-lib/stories/harness'
import aboutMd from '../../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../../LLM_STATEMENT.md?raw'
import thanksMd from '../../../../../SPECIAL_THANKS.md?raw'
import { AboutScreen } from './AboutScreen'

export default {
  title: 'Compositions/About Screen',
}

/**
 * The app's About page. `build`, `aboutJrvs`, `llmStatement` and
 * `specialThanks` are props rather than imports, so the screen is app-agnostic —
 * each app passes its own build and inlines the repo-root documents the way
 * its build allows.
 */
export const Default: Story = () => (
  <AboutScreen
    build="bc9f08c"
    aboutJrvs={aboutMd}
    llmStatement={statementMd}
    specialThanks={thanksMd}
  />
)
