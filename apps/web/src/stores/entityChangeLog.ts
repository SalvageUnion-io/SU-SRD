/**
 * The provenance an entity store write carries (ADR-022): every op it sends
 * names its `kind` and the surface it came from (ADR-063).
 */

import type { ChangeLogKind } from 'game-domain/schemas/changeLog'

/**
 * Provenance tags for an op.
 *
 * Both fields are required, and so is the parameter that carries them. The
 * earlier all-optional shape meant a forgotten tag was not a compile error but a
 * Change Log line reading `manual` / `unknown` — indistinguishable from a real
 * hand edit, and invisible until somebody read the drawer and disbelieved it.
 * Declare the tag once per surface in `surfaceProvenance.ts` and pass the
 * constant.
 */
export type ChangeMeta = {
  kind: ChangeLogKind
  source: string
}
