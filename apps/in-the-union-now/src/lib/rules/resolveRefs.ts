/**
 * Canonical resolution of stored entity refs against the reference ORM.
 *
 * Moved to packages/salvageunion-reference/lib/rules/resolveRefs.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export {
  matchesRef,
  resolveChassisRef,
  resolveSystemRef,
  resolveModuleRef,
  resolveInstalledRef,
  refDisplayName,
} from 'salvageunion-reference/rules'
