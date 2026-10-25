/**
 * The 4.5.0 cutover's one-off copy: reads a Convex snapshot export
 * (`convex export --path`, unzipped) and writes the import bundles the rooms
 * and D1 take (`game-domain/migration/bundle`). It only reads: Convex is left
 * as it is (Jrvs, 2026-10-25). Deleted once the sweep and its diff are clean.
 *
 *   bun tools/convex-copy.ts <export-dir> <out-dir>
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AccountBundle,
  BundleOp,
  BundleRecord,
  BundleUnit,
  GameBundle,
  SiteBundle,
} from 'game-domain/migration/bundle'
import {
  AccountBundleSchema,
  GameBundleSchema,
  SiteBundleSchema,
} from 'game-domain/migration/bundle'

type Row = Record<string, unknown> & { _id: string; _creationTime: number }
export type Tables = Record<string, Row[]>

const UNIT_TABLES = { pilots: 'pilot', mechs: 'mech', crawlers: 'crawler', npcs: 'npc' } as const

export type CopyResult = {
  accounts: AccountBundle[]
  games: GameBundle[]
  site: SiteBundle
  /** Rows the copy could not place, by reason, so the diff report names them. */
  skipped: { table: string; id: string; reason: string }[]
}

/** Reads `<table>/documents.jsonl` for every table in an unzipped export. */
function readExport(dir: string): Tables {
  const tables: Tables = {}
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'documents.jsonl')
    if (!existsSync(file)) continue
    tables[name] = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Row)
  }
  return tables
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback)

export function buildBundles(t: Tables): CopyResult {
  const rows = (name: string) => t[name] ?? []
  const skipped: CopyResult['skipped'] = []

  const discordOf = new Map<string, string>()
  for (const a of rows('authAccounts')) {
    if (a.provider === 'discord') discordOf.set(String(a.userId), String(a.providerAccountId))
  }
  const who = (userId: unknown) =>
    typeof userId === 'string' ? (discordOf.get(userId) ?? null) : null

  const accounts = new Map<string, AccountBundle>()
  for (const u of rows('users')) {
    const discordId = discordOf.get(u._id)
    if (!discordId) {
      skipped.push({ table: 'users', id: u._id, reason: 'no Discord account' })
      continue
    }
    accounts.set(u._id, {
      discordId,
      name: str(u.displayName) ?? str(u.name),
      avatarUrl: str(u.avatarUrl) ?? str(u.image),
      units: [],
      patterns: [],
      encounters: [],
      npcTray: [],
      links: [],
      seats: [],
      channelBindings: [],
    })
  }

  const games = new Map<string, GameBundle>()
  for (const g of rows('games')) {
    games.set(g._id, {
      gameId: g._id,
      name: String(g.name),
      members: [],
      inviteCode: null,
      primaryCrawler: null,
      units: [],
      opposition: [],
      links: [],
      seats: [],
      downtime: null,
      runningEncounter: null,
      channelBindings: [],
      crewPatterns: [],
    })
  }

  // Ops by unit: the legacy Change Log rows until ops are the write, then the op log.
  const opsByUnit = new Map<string, BundleOp[]>()
  for (const c of rows('changeLog')) {
    if (c.entityType === 'softLink' || c.entityType === 'game') continue
    const field = String(c.field)
    const op: BundleOp = {
      id: c._id,
      unitId: String(c.entityId),
      seq: null,
      baseSeq: 0,
      author: who(c.actorId),
      at: num(c.ts, c._creationTime),
      kind: c.kind as BundleOp['kind'],
      source: String(c.source),
      state: c.state as BundleOp['state'],
      patch: { [field]: c.after },
      before: c.state === 'applied' ? { [field]: c.before } : null,
      ...(typeof c.reason === 'string' ? { reason: c.reason } : {}),
    }
    const list = opsByUnit.get(op.unitId) ?? []
    list.push(op)
    opsByUnit.set(op.unitId, list)
  }

  const appIdOf = new Map<string, string>()
  for (const [table, kind] of Object.entries(UNIT_TABLES)) {
    for (const r of rows(table)) {
      const appId = str(r.appId) ?? r._id
      appIdOf.set(r._id, appId)
      const ops = (opsByUnit.get(appId) ?? opsByUnit.get(r._id) ?? []).sort((a, b) => a.at - b.at)
      const unit: BundleUnit = {
        kind,
        appId,
        owner: who(r.ownerId),
        publicRead: r.publicRead === true,
        body: (r.body ?? {}) as BundleUnit['body'],
        headSeq: num(r.headSeq),
        fieldSeqs: (r.fieldSeqs ?? {}) as Record<string, number>,
        updatedAt: num(r.updatedAt, r._creationTime),
        ops,
      }
      const game = typeof r.gameId === 'string' ? games.get(r.gameId) : undefined
      const shelf = typeof r.ownerId === 'string' ? accounts.get(r.ownerId) : undefined
      if (game) game.units.push(unit)
      else if (shelf) shelf.units.push(unit)
      else skipped.push({ table, id: r._id, reason: 'neither in a Game nor on a known shelf' })
    }
  }

  const record = (r: Row, keys: string[]): BundleRecord => ({
    appId: str(r.appId) ?? r._id,
    body: (r.body ?? {}) as BundleRecord['body'],
    extra: Object.fromEntries(keys.filter((k) => r[k] !== undefined).map((k) => [k, r[k]])),
  })

  const patternAppId = new Map<string, string>()
  for (const p of rows('mechPatterns')) {
    patternAppId.set(p._id, String(p.appId))
    const owner = accounts.get(String(p.ownerId))
    if (!owner) {
      skipped.push({ table: 'mechPatterns', id: p._id, reason: 'owner has no account' })
      continue
    }
    owner.patterns.push(record(p, ['publicRead', 'sharedAt', 'builtCount', 'homebrew']))
    if (typeof p.gameId === 'string') games.get(p.gameId)?.crewPatterns.push(String(p.appId))
  }
  for (const e of rows('encounters')) {
    const owner = accounts.get(String(e.ownerId))
    if (owner) owner.encounters.push(record(e, []))
    else skipped.push({ table: 'encounters', id: e._id, reason: 'owner has no account' })
  }
  for (const n of rows('encounterNpcs')) {
    const game = typeof n.gameId === 'string' ? games.get(n.gameId) : undefined
    const owner = typeof n.ownerId === 'string' ? accounts.get(n.ownerId) : undefined
    if (game) game.opposition.push(record(n, []))
    else if (owner) owner.npcTray.push(record(n, []))
    else skipped.push({ table: 'encounterNpcs', id: n._id, reason: 'no Game or owner' })
  }

  for (const m of rows('memberships')) {
    const game = games.get(String(m.gameId))
    const discordId = who(m.userId)
    if (game && discordId) {
      game.members.push({
        discordId,
        mediator: m.mediator === true,
        organizer: m.organizer === true,
        joinedAt: num(m.joinedAt),
      })
    } else skipped.push({ table: 'memberships', id: m._id, reason: 'Game or account missing' })
  }
  for (const i of rows('invites')) {
    const game = games.get(String(i.gameId))
    if (game && i.revokedAt === undefined && i.target === undefined)
      game.inviteCode = String(i.code)
  }
  for (const g of rows('games')) {
    const crawler = str(g.primaryCrawlerId)
    const game = games.get(g._id)
    if (crawler && game) game.primaryCrawler = appIdOf.get(crawler) ?? null
  }

  const ownerOfAppId = new Map<string, AccountBundle>()
  for (const a of accounts.values()) for (const u of a.units) ownerOfAppId.set(u.appId, a)
  for (const l of rows('softLinks')) {
    const link = {
      type: String(l.type),
      from: l.from as { type: string; id: string },
      to: l.to as { type: string; id: string },
      ...(l.slot !== undefined ? { slot: l.slot } : {}),
    }
    const game = typeof l.gameId === 'string' ? games.get(l.gameId) : undefined
    const shelf = ownerOfAppId.get(link.from.id) ?? ownerOfAppId.get(link.to.id)
    if (game) game.links.push(link)
    else if (shelf) shelf.links.push(link)
    else skipped.push({ table: 'softLinks', id: l._id, reason: 'no container' })
  }

  const strip = (r: Row) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_') && k !== 'lastSeenAt'))
  for (const s of rows('seats')) {
    const game = typeof s.gameId === 'string' ? games.get(s.gameId) : undefined
    const owner = typeof s.ownerId === 'string' ? accounts.get(s.ownerId) : undefined
    if (game) game.seats.push(strip(s))
    else if (owner) owner.seats.push(strip(s))
  }
  for (const d of rows('downtime')) {
    const game = games.get(String(d.gameId))
    if (game) game.downtime = strip(d)
  }
  for (const r of rows('runningEncounters')) {
    const game = games.get(String(r.gameId))
    if (game) game.runningEncounter = (r.body ?? {}) as Record<string, unknown>
  }
  for (const b of rows('channelBindings')) {
    const game = typeof b.gameId === 'string' ? games.get(b.gameId) : undefined
    const owner = accounts.get(String(b.boundBy))
    const row = { ...strip(b), boundBy: who(b.boundBy) }
    if (game) game.channelBindings.push(row)
    else if (owner) owner.channelBindings.push(row)
  }

  const site: SiteBundle = {
    homebrewReports: rows('homebrewReports').flatMap((r) => {
      const reporter = who(r.reporterId)
      const appId = patternAppId.get(String(r.patternId))
      return reporter && appId
        ? [{ patternAppId: appId, reporter, reason: String(r.reason), at: num(r.at) }]
        : []
    }),
    homebrewHidden: rows('homebrewModeration').flatMap((m) => {
      const appId = patternAppId.get(String(m.patternId))
      return appId && m.hidden === true
        ? [
            {
              patternAppId: appId,
              hiddenAt: typeof m.hiddenAt === 'number' ? m.hiddenAt : null,
              reportCount: num(m.reportCount),
            },
          ]
        : []
    }),
    usageCounts: rows('usageCounts').map((u) => ({
      key: String(u.key),
      weekStart: num(u.weekStart),
      count: num(u.count),
    })),
    botGuilds: rows('botGuilds').map((g) => ({
      guildId: String(g.guildId),
      firstSeenAt: num(g.firstSeenAt),
      lastSeenAt: num(g.lastSeenAt),
    })),
    metricsSnapshots: rows('metricsSnapshots').map(strip),
    feedback: rows('feedback').map(strip),
    photos: rows('photos').flatMap((p) => {
      const owner = who(p.ownerId)
      return owner ? [{ storageId: String(p.storageId), owner }] : []
    }),
  }

  return {
    accounts: [...accounts.values()].map((a) => AccountBundleSchema.parse(a)),
    games: [...games.values()].map((g) => GameBundleSchema.parse(g)),
    site: SiteBundleSchema.parse(site),
    skipped,
  }
}

/** Row counts in and out, the start of the diff report. */
export function summarize(t: Tables, r: CopyResult) {
  const units =
    r.accounts.reduce((n, a) => n + a.units.length, 0) +
    r.games.reduce((n, g) => n + g.units.length, 0)
  const source = Object.keys(UNIT_TABLES).reduce((n, k) => n + (t[k]?.length ?? 0), 0)
  return {
    accounts: r.accounts.length,
    games: r.games.length,
    units,
    sourceUnits: source,
    skipped: r.skipped.length,
  }
}

if (import.meta.main) {
  const [dir, out] = process.argv.slice(2)
  if (!dir || !out) {
    console.error('usage: bun tools/convex-copy.ts <export-dir> <out-dir>')
    process.exit(1)
  }
  const tables = readExport(dir)
  const result = buildBundles(tables)
  for (const sub of ['accounts', 'games']) mkdirSync(join(out, sub), { recursive: true })
  for (const a of result.accounts)
    writeFileSync(join(out, 'accounts', `${a.discordId}.json`), JSON.stringify(a))
  for (const g of result.games)
    writeFileSync(join(out, 'games', `${g.gameId}.json`), JSON.stringify(g))
  writeFileSync(join(out, 'site.json'), JSON.stringify(result.site))
  writeFileSync(join(out, 'skipped.json'), JSON.stringify(result.skipped, null, 2))
  console.log(JSON.stringify(summarize(tables, result), null, 2))
}
