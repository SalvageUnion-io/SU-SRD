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
  'apps/web/astro/DESIGN.md': 5_400,
  'docs/ARCHITECTURE.md': 21_200,
  'docs/README.md': 2_600,
  'docs/architecture/addresses.md': 2_000,
  'docs/architecture/contributions.md': 3_700,
  'docs/architecture/dataset-api.md': 2_400,
  'docs/architecture/entity-card.md': 3_500,
  'docs/architecture/messages.md': 2_200,
  'docs/architecture/npc-builder.md': 2_000,
  'docs/architecture/one-app.md': 2_800,
  'docs/architecture/play.md': 10_500,
  'docs/architecture/surfaces.md': 4_400,
  'docs/design-system/chrome.md': 3_250,
  'docs/design-system/chips-and-actions.md': 7_800,
  'docs/design-system/entity-display-language.md': 6_250,
  'docs/design-system/hard-rules.md': 17_400,
  'docs/design-system/ruleset.md': 14_250,
  'docs/ops/cloud-environment.md': 3_800,
}

/** The sessions the repo budgets (`gates/lib/sessionLoad`), each held to `SESSION_CEILINGS`. */
export const SESSION_PROFILES: Record<string, SessionProfile> = {
  web: { dirs: ['apps/web'], reads: [] },
  bot: { dirs: ['apps/discord-bot'], reads: [] },
}

/**
 * Characters each profile loads, held at today's total: a ratchet. Lower an
 * entry when its total drops more than `SESSION_SLACK` under it (the check says
 * so); raise one only on purpose, saying why in the commit.
 */
export const SESSION_CEILINGS: Record<string, number> = {
  web: 22_420,
  bot: 11_463,
}
