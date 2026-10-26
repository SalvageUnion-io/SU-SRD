import type { AccountBundle, GameBundle, SiteBundle } from 'game-domain/migration/bundle'
import {
  AccountBundleSchema,
  GameBundleSchema,
  SiteBundleSchema,
} from 'game-domain/migration/bundle'

/** One account, one Game and the site, as `tools/convex-copy.ts` writes them. */

const unit = (kind: string, appId: string) => ({
  kind,
  appId,
  owner: 'd1',
  publicRead: false,
  body: {},
  headSeq: 0,
  fieldSeqs: {},
  updatedAt: 1,
  ops: [],
})

export const ACCOUNT: AccountBundle = AccountBundleSchema.parse({
  discordId: 'd1',
  name: 'Jrvs',
  avatarUrl: null,
  units: [unit('pilot', 'p1'), unit('pilot', 'p2'), unit('mech', 'm1')],
  patterns: [{ appId: 'mp1', body: {}, extra: {} }],
  encounters: [],
  npcTray: [],
  links: [],
  seats: [],
  channelBindings: [{ channelId: 'C1', channelName: 'solo', boundBy: 'd1', boundAt: 3 }],
})

export const GAME: GameBundle = GameBundleSchema.parse({
  gameId: 'g1',
  name: 'Reclamation',
  members: [
    { discordId: 'd1', mediator: true, organizer: true, joinedAt: 1 },
    { discordId: 'd2', mediator: false, organizer: false, joinedAt: 2 },
  ],
  inviteCode: 'CODE',
  primaryCrawler: null,
  units: [],
  opposition: [],
  links: [],
  seats: [],
  downtime: null,
  runningEncounter: null,
  channelBindings: [
    { gameId: 'g1', channelId: 'C2', boundBy: 'd1', boundAt: 4 },
    { gameId: 'g1', channelId: 'C3', boundBy: null, boundAt: 4 },
  ],
  crewPatterns: [],
})

export const SITE: SiteBundle = SiteBundleSchema.parse({
  homebrewReports: [{ patternAppId: 'mp1', reporter: 'd2', reason: 'rude', at: 5 }],
  homebrewHidden: [{ patternAppId: 'mp1', hiddenAt: 6, reportCount: 1 }],
  usageCounts: [{ key: 'bot:roll', weekStart: 7, count: 3 }],
  botGuilds: [{ guildId: 'G', firstSeenAt: 1, lastSeenAt: 2 }],
  metricsSnapshots: [{ takenAt: 8, counts: { pilots: 2 } }, { counts: {} }],
  feedback: [
    {
      sender: 'discord:d1',
      source: 'app',
      kind: 'bug',
      text: 'waiting',
      page: '/build',
      issue: null,
      createdAt: 9,
      attempts: 1,
    },
    {
      sender: 'discord:d1',
      source: 'bot',
      kind: 'idea',
      text: null,
      page: null,
      issue: 12,
      createdAt: 9,
      attempts: 1,
    },
  ],
  photos: [],
})
