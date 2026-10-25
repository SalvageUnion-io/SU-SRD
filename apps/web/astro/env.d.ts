/// <reference types="astro/client" />

declare module 'virtual:base-stylesheet' {
  /** The base stylesheet both apps link, and the faces a page preloads (`baseStylesheetModule`). */
  const base: { href: string; fonts: string[]; scriptFont?: string }
  export default base
}
