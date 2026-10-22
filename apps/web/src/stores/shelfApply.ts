/**
 * shelfApply — how one served answer reaches the stores, under the rules
 * `ShelfSync` documents: server wins per row (`planRowSync`), and a local row
 * is pruned only where its absence is unambiguous (`rowMayBePruned`).
 *
 * Split out of `ShelfSync` so the device copy's restore (`deviceCopyRestore`,
 * ADR-058) applies a saved answer through exactly the code a live one takes:
 * the copy IS a served answer, only an older one.
 *
 * Every write here is `adopt` or `forget`, never a store write: holding a
 * server row is not a user write, and pruning removes a local copy, never a
 * server row.
 */

import { containerOf } from 'game-domain/container'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { ServedRow } from '../lib/links/linkSync'
import { planCrawlerSync, planLinkSync, planRowSync } from '../lib/links/linkSync'
import { captureException } from '../lib/observability'
import type { MineAnswer, WiringAnswer } from './deviceCopy'
import { useEncounterStore } from './encounterStore'
import { useEntityStore } from './entityStore'
import { usePatternStore } from './patternStore'
import { rowMayBePruned } from './pruneRules'
import { noteVersion, serverVersions } from './serverVersions'

/** The body ids a served answer carries. */
function servedIds(rows: readonly ServedRow[]): Set<string> {
  return new Set(
    rows
      .map((r) => (r.body as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === 'string')
  )
}

/**
 * Apply `entities.listMine`'s answer: adopt what is newer, then prune what the
 * answer left out. Stops as soon as `superseded()` says a newer answer has
 * spoken, before pruning against an out-of-date one.
 */
export async function applyMine(mine: MineAnswer, superseded: () => boolean): Promise<void> {
  const store = useEntityStore.getState()
  const patterns = usePatternStore.getState()
  const npcs = useEncounterStore.getState()
  // Built NPCs (ADR-044) are owned rows like pilots, so they come down,
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
      // A newer emission has spoken: this plan may name a row the player
      // has deleted since, and adopting it would bring it back.
      if (superseded()) return
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
    if (superseded()) return
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
    if (superseded()) return
    try {
      await npcs.adopt(row.body as EncounterNpc)
      noteVersion(id, updatedAt)
    } catch (err) {
      captureException(err)
    }
  }

  // Prune only where absence is unambiguous — see `ShelfSync`'s header.
  // Dropping the guard turns this into a roster-deleter.
  if (superseded()) return

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
}

/**
 * Apply `entities.listWiring`'s answer: the Game crawlers first, then the
 * links, since a link's coverage is read through the containers of its held
 * ends. `adoptedAt` is each Game crawler's row `updatedAt` when this tab last
 * adopted it.
 */
export async function applyWiring(
  wiring: WiringAnswer,
  adoptedAt: Map<string, number>,
  superseded: () => boolean
): Promise<void> {
  const store = useEntityStore.getState()
  const gameIds = new Set<string>(wiring.gameIds)

  const crawlerPlan = planCrawlerSync({
    local: useEntityStore.getState().crawlers,
    served: wiring.crawlers,
    gameIds,
    adoptedAt,
  })
  for (const crawler of crawlerPlan.adopt) {
    try {
      await store.adopt('crawler', crawler.body as never)
      adoptedAt.set(crawler.id, crawler.updatedAt)
    } catch (err) {
      // One unreadable crawler must not stop the rest arriving — the same
      // rule as the roster loop in `applyMine`.
      captureException(err)
    }
  }
  if (superseded()) return
  for (const id of crawlerPlan.prune) {
    // `forget`, never `delete`: the row is already gone or elsewhere on the
    // server, and a server delete would destroy whatever it now is.
    await store.forget('crawler', id)
    adoptedAt.delete(id)
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
  if (superseded()) return
  for (const id of linkPlan.prune) await store.forget('softLink', id)
}
