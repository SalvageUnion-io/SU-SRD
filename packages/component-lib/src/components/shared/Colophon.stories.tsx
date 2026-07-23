import type { Story } from '@ladle/react'
import { Colophon } from './Colophon'

import aboutMd from '../../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../../LLM_STATEMENT.md?raw'

export default { title: 'Compositions/Colophon' }

/**
 * The real repo-root `ABOUT_JRVS.md` + `LLM_STATEMENT.md`, rendered through the
 * same block both about pages use — so the catalog shows the wording that
 * actually ships, and a badly-shaped edit to either file is visible here first.
 */
export const Default: Story = () => (
  <Colophon
    aboutMarkdown={aboutMd}
    llmMarkdown={statementMd}
    kofiCode="C3Z82382ZC"
    className="font-body text-ink"
  />
)
