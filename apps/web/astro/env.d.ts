/// <reference types="astro/client" />

declare module 'virtual:base-stylesheet' {
  /** The base stylesheet both apps link (`baseStylesheetModule`). */
  const base: { href: string }
  export default base
}

declare namespace astroHTML.JSX {
  /** Our island directives (`astro/build/islandDirectives.ts`). */
  interface AstroClientDirectives {
    'client:interaction'?: import('../src/runtime/directives/interaction').InteractionOptions
    'client:signedIn'?: boolean
  }
}
