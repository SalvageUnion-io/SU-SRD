import { color, font } from 'component-lib/design/tokens'
import type { Story } from 'component-lib/stories/harness'
import aboutMd from '../../../../ABOUT_JRVS.md?raw'
import statementMd from '../../../../LLM_STATEMENT.md?raw'
import thanksMd from '../../../../SPECIAL_THANKS.md?raw'
import { Colophon } from './Colophon'

export default { title: 'Compositions/Colophon' }

/**
 * The real repo-root `ABOUT_JRVS.md` + `SPECIAL_THANKS.md` + `LLM_STATEMENT.md`,
 * rendered through the same block the About page uses — so the catalog shows
 * the wording that actually ships, and a badly-shaped edit to any of the three
 * files is visible here first.
 */
export const Default: Story = () => (
  // The body face and ink the About page sets around the block; both
  // inherit, so a wrapper carries them exactly as a className on the block did.
  <div style={{ color: color.ink, fontFamily: font.body }}>
    <Colophon
      aboutMarkdown={aboutMd}
      llmMarkdown={statementMd}
      specialThanksMarkdown={thanksMd}
      kofiCode="C3Z82382ZC"
    />
  </div>
)
