import { Colophon } from 'component-lib'

type ColophonIslandProps = {
  aboutMarkdown: string
  llmMarkdown: string
  specialThanksMarkdown: string
}

/**
 * ColophonIsland — hydrates the shared about-page colophon (author bio, special
 * thanks, LLM statement, Ko-fi support button).
 *
 * An island rather than a static render because the Ko-fi widget needs client
 * JS: the shared KofiButton loads Ko-fi's script and swaps in `getHTML()` from
 * an effect, and this island re-hydrates across srd's ClientRouter view
 * transitions. The prose still ships in the built HTML — Astro renders the
 * component at build time and only defers hydration.
 *
 * (This replaces the former KofiButtonIsland, which hydrated the button alone
 * back when the support section stood on its own.)
 */
/**
 * Deliberately NOT wrapped in `IslandErrorBoundary`: this renders static
 * prose with no SRD data and no async work, so there is nothing here that can
 * throw at render. The boundary is for islands that resolve reference data.
 */
export function ColophonIsland({
  aboutMarkdown,
  llmMarkdown,
  specialThanksMarkdown,
}: ColophonIslandProps) {
  return (
    <Colophon
      aboutMarkdown={aboutMarkdown}
      llmMarkdown={llmMarkdown}
      specialThanksMarkdown={specialThanksMarkdown}
      kofiCode="C3Z82382ZC"
    />
  )
}
