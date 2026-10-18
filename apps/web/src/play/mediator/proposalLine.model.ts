/**
 * How a sent proposal reads, wherever it is listed (the propose dock, the
 * Proposals tab, the Game page's "Proposals you sent"). A proposal stores no
 * before (ADR-030 §4, as amended), so a row names only the value it asks for.
 */

import { fieldLabel } from 'cantina-domain/games/proposals'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../../convex/_generated/api'

export type SentProposal = FunctionReturnType<typeof api.proposals.sent>[number]

/** "Judge · HP → 4 · "Ejection burn"". */
export function proposalLine(p: SentProposal): string {
  const value = p.after === null || p.after === undefined ? '—' : String(p.after)
  return [
    p.targetName ?? 'A sheet',
    `${fieldLabel(p.field)} → ${value}`,
    p.reason === null ? null : `“${p.reason}”`,
    p.mine || p.actorName === null ? null : `from ${p.actorName}`,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}
