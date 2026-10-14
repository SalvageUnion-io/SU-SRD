import { KofiButton, MarkdownSection, Slab } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { column, proseColumn } from '../lib/docPageStyles'

type ColophonProps = {
  /** Raw contents of the repo-root `ABOUT_JRVS.md` (left column, top). */
  aboutMarkdown: string
  /** Raw contents of the repo-root `LLM_STATEMENT.md` (right column). */
  llmMarkdown: string
  /** Raw contents of the repo-root `SPECIAL_THANKS.md` (left column, between
   * the bio and the support block). Same contract as `aboutMarkdown`. */
  specialThanksMarkdown: string
  /** Ko-fi page code — the `<code>` in `ko-fi.com/<code>`. */
  kofiCode: string
}

// Two columns from `md` up: the column template is `.srd-colophon`, the rest is
// static.
const ROOT = { display: 'grid', gap: space[32] } satisfies CSSProperties

const COLUMN = column(space[32])

const SUPPORT_SLAB = { marginBottom: 0, width: '100%' } satisfies CSSProperties

const SUPPORT = { ...proseColumn(space[12]), alignItems: 'flex-start' } satisfies CSSProperties

/**
 * Colophon — who made this, how, and how to support it, on the About page
 * both tools share.
 *
 * Two columns that stack on narrow screens: the author bio, the special thanks
 * and the support section on the left, the LLM statement on the right. The
 * Ko-fi button rides in the support slab's `actions` slot, so it sits on the
 * heading line opposite the label rather than below it. None of the prose lives
 * here — all three are repo-root markdown documents passed in raw (see
 * `MarkdownSection`).
 *
 * The Ko-fi button needs client JS to swap in the widget, so the page hydrates
 * this block rather than render it statically, via `ColophonIsland`.
 */
export function Colophon({
  aboutMarkdown,
  llmMarkdown,
  specialThanksMarkdown,
  kofiCode,
}: ColophonProps) {
  return (
    <div className="srd-colophon" style={ROOT}>
      <div style={COLUMN}>
        <MarkdownSection markdown={aboutMarkdown} />

        <MarkdownSection markdown={specialThanksMarkdown} />

        <section style={SUPPORT}>
          <Slab
            as="h2"
            variant="solid"
            label="Support the Project"
            // The section's gap spaces it, so it drops its own bottom margin.
            style={SUPPORT_SLAB}
            actions={<KofiButton code={kofiCode} />}
          />
        </section>
      </div>

      <MarkdownSection markdown={llmMarkdown} />
    </div>
  )
}
