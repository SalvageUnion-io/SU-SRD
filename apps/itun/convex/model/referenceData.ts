// No `with { type: 'json' }` on these: a Convex entry point carrying an import
// attribute makes `convex deploy` exit 1 without a message, before it uploads.
import { SalvageUnionReference } from 'salvageunion-reference'
import abilities from 'salvageunion-reference/data/abilities.json'
import chassis from 'salvageunion-reference/data/chassis.json'
import guides from 'salvageunion-reference/data/guides.json'
import modules from 'salvageunion-reference/data/modules.json'
import systems from 'salvageunion-reference/data/systems.json'

/**
 * The Salvage Union reference data Convex derives from (docs/architecture/
 * dashboard-redesign.md §8 A3).
 *
 * The server runs the same rules as the client (`salvageunion-reference/rules`,
 * ADR-006), so the Crew tab's maxima and status are one answer every client
 * reads rather than one each client works out. The rules read the dataset
 * through `SalvageUnionReference`, which loads it lazily with `preload()`, and
 * Convex's default runtime cannot: its dynamic `import()` throws "dynamic
 * module import unsupported" (tried on a local backend before this was
 * written). So the files a derivation needs are imported here statically and
 * installed with `SalvageUnionReference.install`, which is synchronous and
 * idempotent: the first call in an isolate installs, the rest return at once.
 *
 * Only the schemas something here reads are bundled: abilities (a pilot's and
 * a piloted mech's contributions), chassis, systems and modules (a mech's
 * maxima and its destroyed items by name), and guides (Downtime's steps).
 * Add a file here, never a `preload`, when a derivation needs another.
 */
export function loadReferenceData(): void {
  SalvageUnionReference.install({ abilities, chassis, guides, modules, systems })
}
