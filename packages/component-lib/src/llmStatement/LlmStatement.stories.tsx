import type { Story } from '@ladle/react'
import { Caption } from '../stories/_harness'
import { LlmStatement } from './LlmStatement'

import statementMd from '../../../../LLM_STATEMENT.md?raw'

export default { title: 'Compositions/LLM Statement' }

/**
 * The real repo-root `LLM_STATEMENT.md`, rendered through the same component
 * both about pages use — so the catalog shows the wording that actually ships,
 * and a badly-shaped edit to the file is visible here first.
 */
export const Default: Story = () => (
  <div className="flex max-w-2xl flex-col gap-3">
    <Caption>ITUN /about — rust head, ink body</Caption>
    <LlmStatement
      markdown={statementMd}
      className="font-body text-ink"
      headingClassName="tracking-caps-tight text-rust"
    />
    <Caption>srd /about — centred, default ink head</Caption>
    <LlmStatement markdown={statementMd} className="text-center" />
  </div>
)
