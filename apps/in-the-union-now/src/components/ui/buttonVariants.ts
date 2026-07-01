/**
 * @deprecated Compatibility shim — the local ShadCN-ported Button system was
 * removed in favor of suref-react's `Btn`/`btnVariants` (design-review T-1).
 *
 * This re-export exists only for the sheet routes
 * (`src/routes/sheet/$kind/$id.tsx`, `$id_.share.tsx`), which are being
 * reworked separately (design-review P-4). New code should import
 * `btnVariants` (or `Btn`) from 'suref-react' directly; delete this file once
 * the sheet routes migrate.
 */
export { btnVariants as buttonVariants } from 'suref-react'
