/**
 * Where the Cantina is served: `salvageunion.io/build/`, beside the SRD on one
 * origin (ADR-048).
 *
 * The shell and the app's own files land in `dist/build/` (`vite.config.ts`);
 * its chunks share `dist/assets/` with srd's. App code reads the base back
 * through `import.meta.env.CANTINA_BASE` (`appUrl.ts`); the Worker reads `SITE`
 * itself (`../worker/builder.ts`).
 */

export type CantinaSite = {
  /** The public origin, without a trailing slash. */
  origin: string
  /** The path every URL the app serves starts with. */
  base: string
}

export const SITE: CantinaSite = {
  origin: 'https://salvageunion.io',
  base: '/build/',
}

/**
 * A base without its trailing slash: `''` at the root, `/build` under it. The
 * prefix a root-relative route path is appended to, the Worker's `BUILD_BASE`,
 * and (as `/` for the root) the router's `basepath`.
 */
export function basePathOf(base: string): string {
  return base.replace(/\/+$/, '')
}
