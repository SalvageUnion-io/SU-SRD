/**
 * Escape a JSON string for safe embedding inside a `<script>` element.
 *
 * A `</script>` sequence anywhere in the payload closes the HOST element, not
 * the string — the HTML tokenizer never sees JSON, only text. `<` is a
 * legal JSON escape for `<`, so this is lossless: the browser's JSON parser
 * reads it back as `<`.
 *
 * This lives in `src/lib` rather than beside its first caller in `astro/` because
 * BOTH sides need it and the layering only goes one way: `astro/` may import
 * app code, but nothing under `src/` imports `astro/build/`
 * (astro/DESIGN.md, hard rule 2). Its callers:
 *   - `astro/lib/document.tsx`, for the per-page island-props payload
 *   - `src/reference/layouts/BaseLayout.tsx`, for JSON-LD
 *   - `src/lib/documentHead.ts`, for the Discord Component Embed, which the
 *     reference pages and the Worker's shell swap both write (`metaTags`)
 *
 * The JSON-LD case is the reason this was extracted. Those blocks interpolate
 * entity-derived prose — `itemName`, the generated meta description, a source
 * book's title — so a description containing `</script` would terminate the
 * block inside `<head>`. No entity in the current dataset does (all 2,064
 * emitted blocks were checked, none contains even a bare `<`), which is
 * precisely why it is worth escaping now: the failure is latent, silent, and
 * would arrive with a data import rather than a code change.
 */
export function escapeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c')
}
