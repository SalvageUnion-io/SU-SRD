/**
 * Vite `?raw` stylesheet imports — the Foundations pages read `theme.css`'s
 * source so their specimens are generated from the token set itself (see
 * `src/stories/_foundations.tsx`). Declared locally for the reason
 * `raw-markdown.d.ts` gives.
 */
declare module '*.css?raw' {
  const content: string
  export default content
}
