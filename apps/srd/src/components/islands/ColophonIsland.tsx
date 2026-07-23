import { Colophon } from 'component-lib'

type ColophonIslandProps = {
  aboutMarkdown: string
  llmMarkdown: string
}

/**
 * ColophonIsland — hydrates the shared about-page colophon (author bio, LLM
 * statement, Ko-fi support button).
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
export function ColophonIsland({ aboutMarkdown, llmMarkdown }: ColophonIslandProps) {
  return <Colophon aboutMarkdown={aboutMarkdown} llmMarkdown={llmMarkdown} kofiCode="C3Z82382ZC" />
}
