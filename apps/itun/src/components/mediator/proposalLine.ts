/**
 * How a sent proposal reads, wherever it is listed (the propose dock, the
 * Proposals tab, the Game page's "Proposals you sent"), and the list they sit
 * in. A proposal stores no before (ADR-030 §4 as amended for issue 1130), so a row
 * names only the value it asks for.
 */

import { tokens } from 'component-lib'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties } from 'react'
import type { api } from '../../../convex/_generated/api'
import { fieldLabel } from '../../lib/games/proposals'

const { space } = tokens

export type SentProposal = FunctionReturnType<typeof api.proposals.sent>[number]

/** "just now", "2 min ago", "3 h ago", "2 days ago". */
export function ago(ts: number, now: number): string {
  const minutes = Math.floor((now - ts) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

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

/** A list of rows, newest first. */
export const PROPOSAL_LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
}
