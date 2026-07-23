/**
 * Vite `?raw` markdown imports. Declared locally because this package has no
 * build step and so no `vite/client` types of its own — the only consumers are
 * the stories, which preview the real `ABOUT_JRVS.md` / `LLM_STATEMENT.md`
 * rather than a paraphrase of them.
 */
declare module '*.md?raw' {
  const content: string
  export default content
}
