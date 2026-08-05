import { renderToStaticMarkup } from 'react-dom/server'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { EntityCardStatic } from '../components/EntityCardStatic'

/**
 * Markup that only does something once React is attached.
 *
 * `<a href>` is deliberately absent: an anchor works in a document that never
 * hydrates, and anchors are how the SRD's card reaches nested entities in link
 * mode. Everything here, by contrast, is inert without a listener — a rendered
 * `<button>` with no handler is a defect under the ruleset's "rust means
 * action" rule, not a cosmetic wart.
 */
const NEEDS_A_LISTENER =
  /<button\b|<input\b|<select\b|<textarea\b|role="button"|aria-expanded=|aria-haspopup=/

/**
 * Does this entity's card contain anything that needs JS to work?
 *
 * Answered by *rendering the card and reading the result*, not by inspecting
 * the entity's data. The card decides what controls to emit deep inside its own
 * recursion (roll tables, disclosures, nested-entity click targets), so any
 * data-shape heuristic would drift the moment that logic changed — and drift
 * here is silent, shipping a dead button rather than failing a build.
 *
 * Cost is one extra static render per entity page at build time, which is
 * cheap: the full 1,039-page build runs in a few seconds.
 *
 * Fails SAFE. If the probe render throws, the answer is "yes, hydrate" — the
 * island path is the status quo and always correct, just heavier. The static
 * path is the optimization, and an optimization must never be the fallback.
 */
export function cardNeedsHydration(item: SURefEntity, pattern?: SURefObjectPattern): boolean {
  try {
    const markup = renderToStaticMarkup(
      <EntityCardStatic item={item} pattern={pattern} titleAs="h1" />
    )
    return NEEDS_A_LISTENER.test(markup)
  } catch {
    return true
  }
}
