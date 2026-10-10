/**
 * ShelfSync — fills the local cache from the server of record.
 *
 * The read-down half of ADR-034 decision 2: writes go **up** server-first, and
 * this brings the account's rows back **down** outside a Game, so a signed-in
 * player opening ITUN on a second device sees their roster. A cache is
 * something that can be filled, and this is what fills it.
 *
 * ## Server wins, and that is the point
 *
 * A row that comes down newer than the version this browser last saw is
 * adopted over whatever the cache held (`planRowSync`, per row, by the row's
 * `updatedAt`). There is no merge and no conflict resolution, because with one
 * source of truth there is no second writer to conflict with — that is the
 * whole benefit ADR-034 buys, and reintroducing a merge here would spend it.
 * The other half of that guarantee is on the write side: a pilot or mech write
 * made against an older version is refused (`entities.upsertByAppId`).
 *
 * `adopt` keeps each record's own id, so the local copy **is** the entity rather
 * than a fork of it, and it deliberately skips `requireWritableBackend`: filling
 * a cache is not a user write, and a Disconnected reader must still be able to
 * open what they already pulled down.
 *
 * ## Pruning, and the condition that makes it safe
 *
 * It also forgets local rows the server did not return, which is what makes
 * "the cache is a reflection" literally true rather than aspirational. It is
 * the most destructive operation in the codebase, so the guard below is
 * load-bearing and not obvious.
 *
 * **Only rows known to be the caller's.** A local row absent from `listMine`
 * is ambiguous, and the ambiguity differs by container. `listMine` returns what
 * the caller *owns*, wherever it lives — but a Game's **unclaimed** pre-gens
 * and its communal crawler have no owner at all, and are legitimately cached
 * (`WiringSync` caches the crawler; earlier builds cached pre-gens opened from a
 * roster). So a Game row is pruned only when this browser recorded a server
 * version for it, which only `listMine` or the owner's own write does
 * (`rowMayBePruned`). A shelf row needs no such record: `gameId: null` with no
 * owner is the one combination ADR-030 calls invalid, so every shelf row must
 * be owned, and every owned row is in `listMine`. Patterns and the NPC tray are
 * personal, so the shelf rule holds for every one of them.
 *
 * Absence means deletion rather than not-yet-uploaded because every cached row
 * came from the server or from a write it accepted first: signed out nothing
 * is written, and the cache belongs to the signed-in account
 * (`lib/account/cacheOwner.ts`).
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
import { containerOf } from '../../lib/container'
import { rowMayBePruned } from '../../lib/db/pruneRules'
import type { ServedRow } from '../../lib/links/linkSync'
import { planCrawlerSync, planLinkSync, planRowSync } from '../../lib/links/linkSync'
import { captureException } from '../../lib/observability'
import type { EncounterNpc } from '../../lib/schemas/encounterNpc'
import type { MechPattern } from '../../lib/schemas/pattern'
import { useEncounterStore } from '../../stores/encounterStore'
import { selectBackend } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { noteVersion, serverVersions } from '../../stores/serverVersions'

/** The body ids a served answer carries. */
function servedIds(rows: readonly ServedRow[]): Set<string> {
  return new Set(
    rows
      .map((r) => (r.body as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === 'string')
  )
}

function ConnectedShelfSync() {
  // `undefined` while in flight — the Convex convention, not a loading flag.
  const mine = useQuery(api.entities.listMine, {})

  useEffect(() => {
    if (mine === undefined) return
    // A newer emission supersedes this one; stop before pruning against an
    // answer that is already out of date.
    let superseded = false

    // `listMine` is a live subscription, so it re-emits on every server change,
    // this browser's own writes included. Each emission is planned per row
    // against the versions already adopted (`planRowSync`), so an emission that
    // changed nothing writes nothing, and one that changed a single body — an
    // edit on another device — adopts exactly that row.
    void (async () => {
      const store = useEntityStore.getState()
      const patterns = usePatternStore.getState()
      const npcs = useEncounterStore.getState()
      await Promise.all([
        store.hydrate('pilot'),
        store.hydrate('mech'),
        store.hydrate('crawler'),
        store.hydrate('npc'),
        patterns.hydrate(),
        npcs.hydrate(),
      ])
      // Built NPCs (ADR-043) are owned rows like pilots, so they come down,
      // and are pruned, on exactly the pilot's rule.
      const kinds = [
        ['pilot', mine.pilots],
        ['mech', mine.mechs],
        ['crawler', mine.crawlers],
        ['npc', mine.npcs],
      ] as const

      for (const [kind, rows] of kinds) {
        const plan = planRowSync({
          local: useEntityStore.getState().list(kind),
          served: rows as ServedRow[],
          adoptedAt: serverVersions(),
        })
        for (const { id, updatedAt, row } of plan) {
          try {
            await store.adopt(kind, row.body as never)
            noteVersion(id, updatedAt)
          } catch (err) {
            // One unreadable row must not stop the rest of the roster arriving.
            // A body the server accepted that this build cannot parse is a real
            // schema disagreement worth reporting, but the other builds are
            // fine and the player should see them.
            captureException(err)
          }
        }
      }

      // Patterns and the NPC tray live in their own stores. Their rows carry
      // only `{ body }` — no `appId`, no `updatedAt` column — because each is
      // addressed by the id inside its body, so `rowVersion` reads the body's
      // own stamp.
      const patternPlan = planRowSync({
        local: usePatternStore.getState().list(),
        served: mine.mechPatterns as ServedRow[],
        adoptedAt: serverVersions(),
      })
      for (const { id, updatedAt, row } of patternPlan) {
        try {
          await patterns.adopt(row.body as MechPattern)
          noteVersion(id, updatedAt)
        } catch (err) {
          // Same rule as the roster loop above: one unreadable pattern must not
          // stop the rest of the library arriving.
          captureException(err)
        }
      }

      const npcPlan = planRowSync({
        local: useEncounterStore.getState().list(),
        served: mine.encounterNpcs as ServedRow[],
        adoptedAt: serverVersions(),
      })
      for (const { id, updatedAt, row } of npcPlan) {
        try {
          await npcs.adopt(row.body as EncounterNpc)
          noteVersion(id, updatedAt)
        } catch (err) {
          captureException(err)
        }
      }

      // Prune only where absence is unambiguous — see the header. Dropping the
      // guard turns this into a roster-deleter.
      if (superseded) return

      // `forget`, never `delete`, everywhere below: this removes the local COPY
      // and must never become a server delete. The row is already gone there —
      // that is why it is being pruned — and issuing a delete would turn a sync
      // into a destructive write against whatever the server does hold.
      for (const [kind, rows] of kinds) {
        const served = servedIds(rows as ServedRow[])
        for (const local of store.list(kind)) {
          if (served.has(local.id)) continue
          // A Game crawler is the crew's, never `listMine`'s; `WiringSync`
          // prunes it.
          const knownMine = kind !== 'crawler' && serverVersions().has(local.id)
          if (!rowMayBePruned(local, knownMine)) continue
          await store.forget(kind, local.id)
        }
      }

      // Patterns and the tray are personal: every one is owned, so every one is
      // in `listMine`, and absence means deleted — the shelf rule.
      const servedPatterns = servedIds(mine.mechPatterns as ServedRow[])
      for (const local of usePatternStore.getState().list()) {
        if (!servedPatterns.has(local.id)) await patterns.forget(local.id)
      }
      const servedNpcs = servedIds(mine.encounterNpcs as ServedRow[])
      for (const local of useEncounterStore.getState().list()) {
        if (!servedNpcs.has(local.id)) await npcs.forget(local.id)
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
 * containers of its cached ends, so the crawlers it points at should already
 * be here when it is judged. Each emission is planned from scratch against the
 * current cache and the plans are idempotent, so an emission that changed
 * nothing this browser holds writes nothing — which is most of them, since the
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

    void (async () => {
      const store = useEntityStore.getState()
      await Promise.all([
        store.hydrate('pilot'),
        store.hydrate('mech'),
        store.hydrate('crawler'),
        store.hydrate('npc'),
        store.hydrate('softLink'),
      ])
      const gameIds = new Set<string>(wiring.gameIds)

      const crawlerPlan = planCrawlerSync({
        local: useEntityStore.getState().crawlers,
        served: wiring.crawlers,
        gameIds,
        adoptedAt: adoptedAt.current,
      })
      for (const crawler of crawlerPlan.adopt) {
        try {
          await store.adopt('crawler', crawler.body as never)
          adoptedAt.current.set(crawler.id, crawler.updatedAt)
        } catch (err) {
          // One unreadable crawler must not stop the rest arriving — the same
          // rule as the roster loop in `ConnectedShelfSync`.
          captureException(err)
        }
      }
      if (superseded) return
      for (const id of crawlerPlan.prune) {
        // `forget`, never `delete`: the row is already gone or elsewhere on the
        // server, and a server delete would destroy whatever it now is.
        await store.forget('crawler', id)
        adoptedAt.current.delete(id)
      }

      const cached = useEntityStore.getState()
      const linkPlan = planLinkSync({
        local: cached.softLinks,
        served: wiring.softLinks,
        gameIds,
        containerOfEnd: (ref) => {
          const entity = cached.get(ref.type, ref.id)
          return entity === null ? null : containerOf(entity)
        },
      })
      for (const link of linkPlan.adopt) {
        try {
          await store.adopt('softLink', link)
        } catch (err) {
          captureException(err)
        }
      }
      if (superseded) return
      for (const id of linkPlan.prune) await store.forget('softLink', id)
    })()

    return () => {
      superseded = true
    }
  }, [wiring])

  return null
}

/**
 * Mounted by `AccountReconciler`'s signed-in half, not at the root on its own:
 * nothing may sync into the cache until it is confirmed to be this account's
 * (`claimCacheFor`).
 */
export function ShelfSync() {
  // Only when the server of record is actually in play. `remote` rather than
  // "signed in" so a Disconnected session does not fire a query it cannot serve.
  if (selectBackend() !== 'remote') return null
  return (
    <>
      <ConnectedShelfSync />
      <ConnectedWiringSync />
    </>
  )
}
