// No `with { type: 'json' }` on these: see `model/referenceData.ts`.
import { v } from 'convex/values'
import type { SURefEntity } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import abilities from 'salvageunion-reference/data/abilities.json'
import chassis from 'salvageunion-reference/data/chassis.json'
import crawlerBays from 'salvageunion-reference/data/crawler-bays.json'
import crawlers from 'salvageunion-reference/data/crawlers.json'
import drones from 'salvageunion-reference/data/drones.json'
import equipment from 'salvageunion-reference/data/equipment.json'
import modules from 'salvageunion-reference/data/modules.json'
import systems from 'salvageunion-reference/data/systems.json'
import {
  resolveChassisRef,
  resolveCrawlerBayRef,
  resolveCrawlerRef,
  resolveInstalledRef,
  resolveModuleRef,
  resolveRef,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { isRecord } from '../src/lib/isRecord'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { internalMutation, PARSERS, resolveLinkEnd } from './model/entities'

/**
 * One-off rewrite of every stored row into its canonical shape (#1179).
 *
 * Run from the Convex dashboard's function runner: `legacyRows:rewrite` with
 * `{}` reports what it would change and writes nothing; `{"apply": true}`
 * writes it. Every rule is idempotent, so a second applied run reports
 * `changed: 0` for every table.
 *
 * Per row (`canonicalRow`):
 *
 *  - pilots, mechs, crawlers: `body.workspaceId` is stripped. A body with no
 *    `gameId` of its own gets the row's `gameId` column in the same patch,
 *    because the column is the authority and a body with neither reads as
 *    shelved.
 *  - mechs: `body.description` moves into `appearance` when that is unset
 *    (the order the sheet reads them in), and is dropped otherwise.
 *  - crawlers: a row with no `ownerId` column gets `ownerId: null`.
 *  - every reference into `salvageunion-reference` becomes the entity's slug:
 *    crawler `type`, `crawlerBays[].bayRef`, `systems` and the `bayChoices`
 *    keys; mech and pattern `chassisRef`, `systems`, `modules` and the mech's
 *    per-item maps; pilot `abilities`, `usedAbilities`, `equipment`, the keys
 *    of `equipmentChoices`, `equipmentConditions` and `equipmentUses`, and
 *    `partners[].hostRef`.
 *
 * A ref nothing resolves is left as it is and its row listed under
 * `unresolvedRefs`; a rewritten body that fails its schema is not written and
 * its row listed under `unparseable`. Both list row ids only.
 *
 * Separately, a soft link with an end that resolves to no row is deleted
 * (`orphanedLinksDeleted`).
 *
 * The run is paged, one mutation per page, so an applied page stays applied
 * if a later one fails; running it again finishes the job.
 */

const DEFAULT_PAGE_SIZE = 200

const TABLES = ['pilots', 'mechs', 'crawlers', 'mechPatterns'] as const
type RewrittenTable = (typeof TABLES)[number]

const CHANGES = [
  'workspaceIdStripped',
  'gameIdStamped',
  'descriptionMoved',
  'descriptionDropped',
  'ownerIdBackfilled',
  'typeSlugged',
  'bayRefSlugged',
  'crawlerSystemsSlugged',
  'bayChoicesRekeyed',
  'mechRefsSlugged',
  'pilotRefsSlugged',
] as const
export type Change = (typeof CHANGES)[number]

/** The reference schemas the rewrite resolves refs against. */
function installReferenceData(): void {
  SalvageUnionReference.install({
    abilities,
    chassis,
    'crawler-bays': crawlerBays,
    crawlers,
    drones,
    equipment,
    modules,
    systems,
  })
}

type Resolver = (ref: string) => SURefEntity | null

const resolveAbility: Resolver = (ref) => resolveRef(SalvageUnionReference.Abilities, ref)
const resolveEquipment: Resolver = (ref) => resolveRef(SalvageUnionReference.Equipment, ref)
const resolveDrone: Resolver = (ref) => resolveRef(SalvageUnionReference.Drones, ref)
/** A `bayChoices` key names a bay or the crawler's type. */
const resolveBayChoiceKey: Resolver = (ref) => resolveCrawlerBayRef(ref) ?? resolveCrawlerRef(ref)

/**
 * The slug `ref` should be stored as, or null when nothing resolves it — or
 * when its slug would not resolve back to the same entity.
 */
function slugOf(resolve: Resolver, ref: string): string | null {
  const entity = resolve(ref)
  if (entity === null) return null
  const slug = getEntitySlug(entity)
  return resolve(slug)?.id === entity.id ? slug : null
}

/** What rewriting one body has done so far. */
type Pass = { changes: Set<Change>; unresolved: number }

function slugRef(ref: unknown, resolve: Resolver, change: Change, pass: Pass): unknown {
  if (typeof ref !== 'string') return ref
  const slug = slugOf(resolve, ref)
  if (slug === null) {
    pass.unresolved += 1
    return ref
  }
  if (slug !== ref) pass.changes.add(change)
  return slug
}

function slugRefs(list: unknown, resolve: Resolver, change: Change, pass: Pass): unknown {
  return Array.isArray(list) ? list.map((ref) => slugRef(ref, resolve, change, pass)) : list
}

/**
 * A map keyed by refs, re-keyed by slug. A key whose slug is already taken in
 * the map is left as it is and counted unresolved, so no entry is dropped.
 */
function rekey(map: unknown, resolve: Resolver, change: Change, pass: Pass): unknown {
  if (!isRecord(map) || Array.isArray(map)) return map
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(map)) {
    const slug = slugOf(resolve, key)
    if (slug === null || (slug !== key && (Object.hasOwn(map, slug) || Object.hasOwn(out, slug)))) {
      pass.unresolved += 1
      out[key] = value
      continue
    }
    if (slug !== key) pass.changes.add(change)
    out[slug] = value
  }
  return out
}

/** Set `key` only when the body carries it, so an absent field stays absent. */
function rewriteField(
  body: Record<string, unknown>,
  key: string,
  rewrite: (value: unknown) => unknown
): void {
  if (key in body) body[key] = rewrite(body[key])
}

function stripWorkspace(body: Record<string, unknown>, gameId: string | null, pass: Pass): void {
  if (!('workspaceId' in body)) return
  delete body.workspaceId
  pass.changes.add('workspaceIdStripped')
  if (body.gameId === undefined) {
    body.gameId = gameId
    pass.changes.add('gameIdStamped')
  }
}

function canonicalMechRefs(body: Record<string, unknown>, pass: Pass): void {
  const change = 'mechRefsSlugged'
  rewriteField(body, 'chassisRef', (ref) => slugRef(ref, resolveChassisRef, change, pass))
  rewriteField(body, 'systems', (list) => slugRefs(list, resolveSystemRef, change, pass))
  rewriteField(body, 'modules', (list) => slugRefs(list, resolveModuleRef, change, pass))
}

function canonicalPilot(body: Record<string, unknown>, pass: Pass): void {
  const change = 'pilotRefsSlugged'
  rewriteField(body, 'abilities', (list) => slugRefs(list, resolveAbility, change, pass))
  rewriteField(body, 'usedAbilities', (list) => slugRefs(list, resolveAbility, change, pass))
  rewriteField(body, 'equipment', (list) => slugRefs(list, resolveEquipment, change, pass))
  for (const key of ['equipmentChoices', 'equipmentConditions', 'equipmentUses']) {
    rewriteField(body, key, (map) => rekey(map, resolveEquipment, change, pass))
  }
  rewriteField(body, 'partners', (partners) =>
    Array.isArray(partners)
      ? partners.map((partner) => {
          if (!isRecord(partner)) return partner
          const resolve = partner.hostSchema === 'drones' ? resolveDrone : resolveEquipment
          return { ...partner, hostRef: slugRef(partner.hostRef, resolve, change, pass) }
        })
      : partners
  )
}

function canonicalMech(body: Record<string, unknown>, pass: Pass): void {
  if ('description' in body) {
    const { description } = body
    delete body.description
    if (
      body.appearance === undefined &&
      typeof description === 'string' &&
      description.trim() !== ''
    ) {
      body.appearance = description
      pass.changes.add('descriptionMoved')
    } else {
      pass.changes.add('descriptionDropped')
    }
  }
  canonicalMechRefs(body, pass)
  const change = 'mechRefsSlugged'
  rewriteField(body, 'systemConditions', (map) => rekey(map, resolveSystemRef, change, pass))
  rewriteField(body, 'moduleConditions', (map) => rekey(map, resolveModuleRef, change, pass))
  rewriteField(body, 'itemUses', (map) => rekey(map, resolveInstalledRef, change, pass))
}

function canonicalCrawler(body: Record<string, unknown>, pass: Pass): void {
  rewriteField(body, 'type', (ref) => slugRef(ref, resolveCrawlerRef, 'typeSlugged', pass))
  rewriteField(body, 'crawlerBays', (bays) =>
    Array.isArray(bays)
      ? bays.map((bay) =>
          isRecord(bay)
            ? { ...bay, bayRef: slugRef(bay.bayRef, resolveCrawlerBayRef, 'bayRefSlugged', pass) }
            : bay
        )
      : bays
  )
  rewriteField(body, 'systems', (list) =>
    slugRefs(list, resolveSystemRef, 'crawlerSystemsSlugged', pass)
  )
  rewriteField(body, 'bayChoices', (map) =>
    rekey(map, resolveBayChoiceKey, 'bayChoicesRekeyed', pass)
  )
}

/** The part of a row the rewrite reads. */
export type StoredRow = { body: unknown; gameId: string | null; ownerId?: string | null }

export type CanonicalRow = {
  /** The rewritten body; equal to the stored one when no body rule applied. */
  body: Record<string, unknown>
  /** Whether any rule changed the body. */
  bodyChanged: boolean
  /** Set when the `ownerId` column is to be written. */
  ownerId?: null
  /** Each rule that applied, once. */
  changes: Change[]
  /** Refs (and map keys) nothing resolved, left as they were. */
  unresolvedRefs: number
}

/**
 * A row in its canonical shape, or null when its body is not an object.
 * Pure: it reads the reference data `installReferenceData` loads.
 */
export function canonicalRow(table: RewrittenTable, row: StoredRow): CanonicalRow | null {
  if (!isRecord(row.body) || Array.isArray(row.body)) return null
  const body: Record<string, unknown> = { ...row.body }
  const pass: Pass = { changes: new Set(), unresolved: 0 }

  if (table === 'mechPatterns') {
    canonicalMechRefs(body, pass)
  } else {
    stripWorkspace(body, row.gameId, pass)
    if (table === 'pilots') canonicalPilot(body, pass)
    if (table === 'mechs') canonicalMech(body, pass)
    if (table === 'crawlers') canonicalCrawler(body, pass)
  }

  const bodyChanged = pass.changes.size > 0
  const backfillOwner = table === 'crawlers' && row.ownerId === undefined
  if (backfillOwner) pass.changes.add('ownerIdBackfilled')
  return {
    body,
    bodyChanged,
    ...(backfillOwner ? { ownerId: null } : {}),
    changes: [...pass.changes],
    unresolvedRefs: pass.unresolved,
  }
}

type Counts = Record<Change, number>

type TableReport = Counts & {
  scanned: number
  /** Rows the rewrite changed — or, on a dry run, would change. */
  changed: number
  /** Ids of rows holding a ref nothing resolved. */
  unresolvedRefs: string[]
  /** Ids of rows whose rewritten body fails its schema, left untouched. */
  unparseable: string[]
}

function emptyTableReport(): TableReport {
  const counts = Object.fromEntries(CHANGES.map((change) => [change, 0])) as Counts
  return { scanned: 0, changed: 0, ...counts, unresolvedRefs: [], unparseable: [] }
}

type RewritePage = TableReport & { cursor: string; isDone: boolean }

/** One page of one table. `rewrite` drives it. */
export const rewritePage = internalMutation({
  args: {
    table: v.union(
      v.literal('pilots'),
      v.literal('mechs'),
      v.literal('crawlers'),
      v.literal('mechPatterns')
    ),
    cursor: v.union(v.string(), v.null()),
    apply: v.boolean(),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RewritePage> => {
    installReferenceData()
    const page = await ctx.db
      .query(args.table)
      .paginate({ cursor: args.cursor, numItems: args.pageSize ?? DEFAULT_PAGE_SIZE })
    const report = emptyTableReport()
    report.scanned = page.page.length

    for (const row of page.page) {
      const next = canonicalRow(args.table, row)
      if (next === null) {
        report.unparseable.push(row._id)
        continue
      }
      if (next.unresolvedRefs > 0) report.unresolvedRefs.push(row._id)
      if (next.changes.length === 0) continue

      let body: unknown
      if (next.bodyChanged) {
        const parsed = PARSERS[args.table].safeParse(next.body)
        if (!parsed.success) {
          report.unparseable.push(row._id)
          continue
        }
        body = parsed.data
      }

      report.changed += 1
      for (const change of next.changes) report[change] += 1
      if (!args.apply) continue

      if (args.table === 'mechPatterns') {
        await ctx.db.patch(row._id, { body })
      } else {
        await ctx.db.patch(row._id, {
          ...(next.bodyChanged ? { body, updatedAt: Date.now() } : {}),
          ...(next.ownerId === null ? { ownerId: null } : {}),
        })
      }
    }

    return { ...report, cursor: page.continueCursor, isDone: page.isDone }
  },
})

type LinksPage = { scanned: number; orphanedLinksDeleted: number; cursor: string; isDone: boolean }

/** One page of soft links: delete each one with an end that resolves to no row. */
export const orphanedLinksPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    apply: v.boolean(),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<LinksPage> => {
    const page = await ctx.db
      .query('softLinks')
      .paginate({ cursor: args.cursor, numItems: args.pageSize ?? DEFAULT_PAGE_SIZE })
    let orphanedLinksDeleted = 0
    for (const link of page.page) {
      const [from, to] = await Promise.all([
        resolveLinkEnd(ctx, link.from, link.gameId),
        resolveLinkEnd(ctx, link.to, link.gameId),
      ])
      if (from !== null && to !== null) continue
      orphanedLinksDeleted += 1
      if (args.apply) await ctx.db.delete(link._id)
    }
    return {
      scanned: page.page.length,
      orphanedLinksDeleted,
      cursor: page.continueCursor,
      isDone: page.isDone,
    }
  },
})

type RewriteReport = { applied: boolean } & Record<RewrittenTable, TableReport> & {
    softLinks: { scanned: number; orphanedLinksDeleted: number }
  }

function addPage(into: TableReport, page: RewritePage): void {
  into.scanned += page.scanned
  into.changed += page.changed
  for (const change of CHANGES) into[change] += page[change]
  into.unresolvedRefs.push(...page.unresolvedRefs)
  into.unparseable.push(...page.unparseable)
}

export const rewrite = internalAction({
  args: {
    /** Write the rewrite. Omitted or false = report only, change nothing. */
    apply: v.optional(v.boolean()),
    /** Rows per page. Only tests have a reason to set it. */
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RewriteReport> => {
    const apply = args.apply === true
    const report: RewriteReport = {
      applied: apply,
      pilots: emptyTableReport(),
      mechs: emptyTableReport(),
      crawlers: emptyTableReport(),
      mechPatterns: emptyTableReport(),
      softLinks: { scanned: 0, orphanedLinksDeleted: 0 },
    }

    for (const table of TABLES) {
      let cursor: string | null = null
      for (;;) {
        const page: RewritePage = await ctx.runMutation(internal.legacyRows.rewritePage, {
          table,
          cursor,
          apply,
          pageSize: args.pageSize,
        })
        addPage(report[table], page)
        if (page.isDone) break
        cursor = page.cursor
      }
    }

    let cursor: string | null = null
    for (;;) {
      const page: LinksPage = await ctx.runMutation(internal.legacyRows.orphanedLinksPage, {
        cursor,
        apply,
        pageSize: args.pageSize,
      })
      report.softLinks.scanned += page.scanned
      report.softLinks.orphanedLinksDeleted += page.orphanedLinksDeleted
      if (page.isDone) break
      cursor = page.cursor
    }
    return report
  },
})
