import type { Story } from '@ladle/react'
import { Caption } from '../stories/_harness'
import { MarkdownSection } from './MarkdownSection'

import aboutMd from '../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../LLM_STATEMENT.md?raw'

export default { title: 'Containers/Markdown Section' }

/**
 * Both repo-root prose documents through the one renderer — a heading and its
 * paragraphs, with no inline markdown interpreted. The catalog therefore shows
 * the wording that actually ships, and a badly-shaped edit to either file is
 * visible here first.
 */
export const Default: Story = () => (
  <div className="flex max-w-2xl flex-col gap-6">
    <Caption>ABOUT_JRVS.md</Caption>
    <MarkdownSection markdown={aboutMd} />
    <Caption>LLM_STATEMENT.md</Caption>
    <MarkdownSection markdown={statementMd} />
  </div>
)
