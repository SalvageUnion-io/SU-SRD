/**
 * Re-export shim. The implementation moved to `src/lib/runWrite.ts`.
 *
 * `runWrite` was written here because the Live Sheet was the only surface
 * voiding entity writes. It no longer is — the Dashboard, the encounter tray
 * and `useEntityChoices` void writes that can be refused for exactly the same
 * reason (`WritesBlockedOffline`, ADR-030 §1), and 20 of them were being
 * dropped on the floor. Handling that once meant the handler could not stay
 * under `components/sheet/`.
 *
 * This file stays so the sheet's 15 existing call sites keep resolving. It
 * carries no behaviour and should be deleted once those imports are repointed
 * at `../../lib/runWrite`.
 */

export { reportWriteFailure, runWrite } from '../../lib/runWrite'
