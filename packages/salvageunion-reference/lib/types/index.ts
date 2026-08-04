/**
 * TypeScript type exports
 *
 * NOTE: All types are inferred from Zod schemas in lib/schemas/.
 * This file re-exports them for backward compatibility — including the
 * `SURefEntity` / `SURefMetaEntity` unions, which are DECLARED ONCE in
 * `lib/schemas/index.ts`. They used to be re-declared here as well; the two
 * copies drifted (the local pair omitted `SURefGuide`), and because
 * `lib/index.ts` re-exports only this module, the drifted copy was the one
 * every consumer got. Never re-declare a union here — re-export it.
 */

export type * from '../schemas/index.js'
