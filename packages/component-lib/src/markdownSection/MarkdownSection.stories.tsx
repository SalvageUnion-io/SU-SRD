import type { Story } from '@ladle/react'
import aboutMd from '../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../LLM_STATEMENT.md?raw'
import thanksMd from '../../../../SPECIAL_THANKS.md?raw'
import { Caption } from '../stories/_harness'
import { MarkdownSection } from './MarkdownSection'

export default { title: 'Containers/Markdown Section' }

/**
 * All three repo-root prose documents through the one renderer — a heading and
 * its blocks, with `[label](href)` links the only inline markdown interpreted.
 * The catalog therefore shows the wording that actually ships, and a
 * badly-shaped edit to any of the files is visible here first.
 *
 * `SPECIAL_THANKS.md` is the one that exercises the `- ` list path: a block
 * whose every line is an item renders as a real `<ul>`, and a missing blank
 * line before it shows up here as literal dashes in a paragraph.
 */
export const Default: Story = () => (
  <div className="flex max-w-2xl flex-col gap-6">
    <Caption>ABOUT_JRVS.md</Caption>
    <MarkdownSection markdown={aboutMd} />
    <Caption>SPECIAL_THANKS.md</Caption>
    <MarkdownSection markdown={thanksMd} />
    <Caption>LLM_STATEMENT.md</Caption>
    <MarkdownSection markdown={statementMd} />
  </div>
)
