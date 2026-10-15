/**
 * Escape a JSON string for safe embedding inside a `<script>` element.
 *
 * A `</script>` sequence anywhere in the payload closes the HOST element, not
 * the string — the HTML tokenizer never sees JSON, only text. `<` is a
 * legal JSON escape for `<`, so this is lossless: the browser's JSON parser
 * reads it back as `<`.
 *
 * This lives in `src/lib` rather than beside its first caller in `ssg/` because
 * BOTH sides need it and the layering only goes one way: `ssg/**` may import
 * app code, but nothing under `src/` may import `ssg/` at runtime
 * (ssg/DESIGN.md, hard rule 2). Two callers:
 *   - `ssg/document.tsx`, for the per-page island-props payload
 *   - `src/layouts/BaseLayout.tsx`, for JSON-LD
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
