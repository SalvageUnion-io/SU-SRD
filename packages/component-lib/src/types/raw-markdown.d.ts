/**
 * Vite `?raw` markdown imports. Declared locally because this package has no
 * build step and so no `vite/client` types of its own — the only consumer is
 * the `LlmStatement` story, which previews the real `LLM_STATEMENT.md` rather
 * than a paraphrase of it.
 */
declare module '*.md?raw' {
  const content: string
  export default content
}
