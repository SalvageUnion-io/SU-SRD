/**
 * islandDirectives — the two island directives Astro does not ship, as an
 * integration: `client:interaction` (hydrate on the reader's first reach) and
 * `client:signedIn` (hydrate only while somebody is signed in). Their code is
 * client code (`src/runtime/directives/`), which Astro inlines into each page
 * that uses one.
 */

import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'

const directive = (file: string) =>
  fileURLToPath(new URL(`../../src/runtime/directives/${file}`, import.meta.url))

export function islandDirectives(): AstroIntegration {
  return {
    name: 'island-directives',
    hooks: {
      'astro:config:setup': ({ addClientDirective }) => {
        addClientDirective({ name: 'interaction', entrypoint: directive('interaction.ts') })
        addClientDirective({ name: 'signedIn', entrypoint: directive('signedIn.ts') })
      },
    },
  }
}
