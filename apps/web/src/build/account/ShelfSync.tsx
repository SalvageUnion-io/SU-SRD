/**
 * ShelfSync — brings the account's rows down from the server of record.
 *
 * The read-down half of ADR-034 decision 2: writes go **up** server-first, and
 * this brings the account's rows back **down**. Online this is the only way a
 * row reaches the stores: every page load starts empty and fills from here,
 * and the stores' `hydrate()` resolves once the first answer is applied
 * (`markArrived`, `stores/rowArrival.ts`). Each applied answer is also saved
 * as the device copy (`stores/deviceCopy.ts`, ADR-058), which an offline boot
 * applies the same way (`stores/deviceCopyRestore.ts`). The apply itself is
 * `stores/shelfApply.ts`.
 *
 * ## Server wins, and that is the point
 *
 * A row that comes down newer than the version this browser last saw is
 * adopted over whatever the store held (`planRowSync`, per row, by the row's
 * `updatedAt`). There is no merge and no conflict resolution, because with one
 * source of truth there is no second writer to conflict with — that is the
 * whole benefit ADR-034 buys, and reintroducing a merge here would spend it.
 * The other half of that guarantee is on the write side: a pilot or mech write
 * made against an older version is refused (`entities.upsertByAppId`).
 *
 * `adopt` keeps each record's own id, so the local copy **is** the entity rather
 * than a fork of it, and it deliberately skips `requireWritableBackend`:
 * holding a server row is not a user write.
 *
 * ## Pruning, and the condition that makes it safe
 *
 * It also forgets local rows the server did not return, which is what makes
 * "the stores are a reflection" literally true rather than aspirational. It is
 * the most destructive operation in the codebase, so the guard below is
 * load-bearing and not obvious.
 *
 * **Only rows known to be the caller's.** A local row absent from `listMine`
 * is ambiguous, and the ambiguity differs by container. `listMine` returns what
 * the caller *owns*, wherever it lives — but a Game's **unassigned** pre-gens
 * and its communal crawler have no owner at all, and are legitimately held
 * (`WiringSync` brings the crawler down). So a Game row is pruned only when this browser recorded a server
 * version for it, which only `listMine` or the owner's own write does
 * (`rowMayBePruned`). A shelf row needs no such record: `gameId: null` with no
 * owner is the one combination ADR-030 calls invalid, so every shelf row must
 * be owned, and every owned row is in `listMine`. Patterns and the NPC tray are
 * personal, so the shelf rule holds for every one of them.
 *
 * Absence means deletion rather than not-yet-uploaded because every held row
 * came from the server or from a write it accepted first: signed out nothing
 * is written, and a tab's rows go when its session ends
 * (`stores/sessionRows.ts`).
 *
 * ## …and its sibling, `WiringSync`, for assignments and Game crawlers
 *
 * `listMine` carries what the caller owns, which leaves out the two things an
 * assignment needs (ADR-037): the **links** — drawn on another device, by a
 * crewmate's mech, or by the server — and the **crawlers** of the caller's
 * Games, which have no owner and so are never in `listMine`. Without them a
 * pilot sheet could not show the crawler its pilot crews, and a picker could
 * not list a Game's crawlers. `WiringSync` fills both from
 * `entities.listWiring`, server wins, with the same prune guard; the rules are
 * the pure plans in `lib/links/linkSync.ts`. Like every adoption here it
 * writes through `adopt`/`forget`.
 *
 * Every open tab mounts its own `ShelfSync`, so this is also how one tab hears
 * another's writes: the write reaches Convex, each tab's subscription re-emits,
 * and the emission is adopted (a create or an edit) or pruned (a delete) under
 * the rules above. There is no tab-to-tab channel.
 */

import { useQuery } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import { noteServed, saveCopy } from '../../stores/deviceCopy'
import { useEncounterStore } from '../../stores/encounterStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { registerSync } from '../../stores/rowArrival'
import { applyMine, applyWiring } from '../../stores/shelfApply'
import { EncounterSync } from './EncounterSync'

function ConnectedShelfSync() {
  // `undefined` while in flight — the Convex convention, not a loading flag.
  const mine = useQuery(api.entities.listMine, {})

  useEffect(() => {
    if (mine === undefined) return
    // A newer emission supersedes this one; stop before pruning against an
    // answer that is already out of date.
    let superseded = false
    noteServed()

    // `listMine` is a live subscription, so it re-emits on every server change,
    // this browser's own writes included. Each emission is planned per row
    // against the versions already adopted (`planRowSync`), so an emission that
    // changed nothing writes nothing, and one that changed a single body — an
    // edit on another device — adopts exactly that row.
    void (async () => {
      try {
        await applyMine(mine, () => superseded)
        if (!superseded) void saveCopy({ mine })
      } finally {
        // The first answer is in, even where a row failed to parse: what
        // arrived is what there is. A superseded run leaves it to the next.
        if (!superseded) {
          useEntityStore.getState().markArrived(['pilot', 'mech', 'crawler', 'npc'])
          usePatternStore.getState().markArrived()
          useEncounterStore.getState().markArrived()
        }
      }
    })()

    return () => {
      superseded = true
    }
  }, [mine])

  return null
}

/**
 * Assignments and Game crawlers, down from `entities.listWiring` (ADR-037).
 *
 * Crawlers first, then links: a link's coverage is read through the
 * containers of its held ends, so the crawlers it points at should already
 * be here when it is judged. Each emission is planned from scratch against the
 * current store and the plans are idempotent, so an emission that changed
 * nothing this tab holds writes nothing — which is most of them, since the
 * query also re-runs when one of the caller's own sheets is edited.
 */
function ConnectedWiringSync() {
  const wiring = useQuery(api.entities.listWiring, {})
  /** Each Game crawler's row `updatedAt` when this browser last adopted it. */
  const adoptedAt = useRef(new Map<string, number>())

  useEffect(() => {
    if (wiring === undefined) return
    // A newer emission supersedes this one; stop before pruning against an
    // answer that is already out of date.
    let superseded = false
    noteServed()

    void (async () => {
      try {
        await applyWiring(wiring, adoptedAt.current, () => superseded)
        if (!superseded) void saveCopy({ wiring })
      } finally {
        if (!superseded) useEntityStore.getState().markArrived(['softLink'])
      }
    })()

    return () => {
      superseded = true
    }
  }, [wiring])

  return null
}

/**
 * Mounted by `AccountReconciler` while the server of record is in play
 * (Connected and current), so a Disconnected session does not fire a query it
 * cannot serve. Registered while mounted, so the stores' `hydrate()` waits for
 * its first answer (`rowArrival.ts`).
 */
export function ShelfSync() {
  useEffect(() => registerSync(), [])
  return (
    <>
      <ConnectedShelfSync />
      <ConnectedWiringSync />
      <EncounterSync />
    </>
  )
}
