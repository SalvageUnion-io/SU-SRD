/// <reference types="astro/client" />

declare module 'virtual:base-stylesheet' {
  /** The base stylesheet both apps link, and the faces a page preloads (`baseStylesheetModule`). */
  const base: { href: string; fonts: string[]; scriptFont?: string }
  export default base
}

declare namespace astroHTML.JSX {
  /** Our island directives (`astro/build/islandDirectives.ts`). */
  interface AstroClientDirectives {
    'client:interaction'?: import('../src/runtime/directives/interaction').InteractionOptions
    'client:signedIn'?: boolean
  }
}
