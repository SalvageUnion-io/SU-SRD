import type { Story } from '@ladle/react'
import aboutMd from '../../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../../LLM_STATEMENT.md?raw'
import thanksMd from '../../../../../SPECIAL_THANKS.md?raw'
import { Colophon } from './Colophon'

export default { title: 'Compositions/Colophon' }

/**
 * The real repo-root `ABOUT_JRVS.md` + `SPECIAL_THANKS.md` + `LLM_STATEMENT.md`,
 * rendered through the same block both about pages use — so the catalog shows
 * the wording that actually ships, and a badly-shaped edit to any of the three
 * files is visible here first.
 */
export const Default: Story = () => (
  <Colophon
    aboutMarkdown={aboutMd}
    llmMarkdown={statementMd}
    specialThanksMarkdown={thanksMd}
    kofiCode="C3Z82382ZC"
    className="font-body text-ink"
  />
)
