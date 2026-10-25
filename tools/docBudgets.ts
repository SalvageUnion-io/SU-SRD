/**
 * The numbers doc-drift holds the docs to (`tools/check-doc-drift.ts`): a
 * PR that resizes a doc or a session changes this file, not the checks.
 */

import type { SessionProfile } from 'gates/lib/sessionLoad'

export const CLAUDE_MD_BUDGET = 8_000
export const RULE_BUDGET = 4_000
/** Files over budget when it landed, held there: lower an entry as it shrinks, delete it under budget. */
export const OVER_BUDGET: Record<string, number> = {}

/** Context docs collapsed to terse lists, held near that size: raise one only on purpose, in the PR. */
export const COLLAPSED_DOCS: Record<string, number> = {
  'apps/web/ssg/DESIGN.md': 5_400,
  'docs/ARCHITECTURE.md': 21_200,
  'docs/README.md': 2_600,
  'docs/architecture/dataset-api.md': 2_400,
  'docs/architecture/npc-builder.md': 2_000,
  'docs/architecture/play.md': 10_500,
  'docs/design-system/chrome.md': 3_250,
  'docs/design-system/chips-and-actions.md': 7_700,
  'docs/design-system/entity-display-language.md': 5_800,
  'docs/design-system/hard-rules.md': 16_350,
  'docs/design-system/ruleset.md': 13_350,
  'docs/ops/cloud-environment.md': 3_800,
}

/** The sessions the repo budgets (`gates/lib/sessionLoad`), each held to `SESSION_CEILINGS`. */
export const SESSION_PROFILES: Record<string, SessionProfile> = {
  web: { dirs: ['apps/web'], reads: [], skip: ['apps/web/convex'] },
  /** It reads the Convex CLI's guidelines; a Convex upgrade that grows them raises this on purpose. */
  convex: {
    dirs: ['apps/web/convex'],
    reads: ['apps/web/CLAUDE.md', 'apps/web/convex/_generated/ai/guidelines.md'],
  },
  bot: { dirs: ['apps/discord-bot'], reads: [] },
}

/**
 * Characters each profile loads, held at today's total: a ratchet. Lower an
 * entry when its total drops more than `SESSION_SLACK` under it (the check says
 * so); raise one only on purpose, saying why in the commit.
 */
export const SESSION_CEILINGS: Record<string, number> = {
  web: 24_080,
  convex: 27_588,
  bot: 11_463,
}
