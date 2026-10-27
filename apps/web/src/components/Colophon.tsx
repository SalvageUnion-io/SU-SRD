import type { CSSProperties, ReactNode } from 'react'
import { space } from '../design/tokens'
import { componentsCopy } from '../messages/components'
import { MarkdownSection, SlabSection, Stack } from './index'

type ColophonProps = {
  /** Raw contents of the repo-root `ABOUT_JRVS.md` (left column, top). */
  aboutMarkdown: string
  /** Raw contents of the repo-root `LLM_STATEMENT.md` (right column). */
  llmMarkdown: string
  /** Raw contents of the repo-root `SPECIAL_THANKS.md` (left column, below the
   * support block). Same contract as `aboutMarkdown`. */
  specialThanksMarkdown: string
  /** The Ko-fi button, in the support slab's `actions` slot: an island on the page. */
  support: ReactNode
}

// Two columns from `md` up: the column template is `.su-colophon`, the rest is
// static.
const ROOT = { display: 'grid', gap: space[32] } satisfies CSSProperties

/**
 * Colophon — who made this, how, and how to support it, on the About page
 * both tools share.
 *
 * Two columns that stack on narrow screens: the author bio, the support
 * section and the special thanks on the left, the LLM statement on the right. The
 * Ko-fi button rides in the support slab's `actions` slot, so it sits on the
 * heading line opposite the label rather than below it. None of the prose lives
 * here — all three are repo-root markdown documents passed in raw (see
 * `MarkdownSection`).
 *
 * It renders statically; only the Ko-fi button (`support`, the page's
 * `KofiIsland`) needs client JS.
 */
export function Colophon({
  aboutMarkdown,
  llmMarkdown,
  specialThanksMarkdown,
  support,
}: ColophonProps) {
  return (
    <div className="su-colophon" style={ROOT}>
      <Stack gap={32}>
        <MarkdownSection markdown={aboutMarkdown} />

        <SlabSection as="h2" title={componentsCopy('supportTheProject')} actions={support} page />

        <MarkdownSection markdown={specialThanksMarkdown} />
      </Stack>

      <MarkdownSection markdown={llmMarkdown} />
    </div>
  )
}
