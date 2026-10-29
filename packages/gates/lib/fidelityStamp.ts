/**
 * The stamp in each `fidelity.lock.json` entry: what binds a verdict to the
 * book text it was reached on, so that a hand-written entry can be told from
 * one `check-rules-fidelity.ts --update` wrote.
 */
import { createHash } from 'node:crypto'
import type { LockEntry } from './proseFidelity'
import { fold, proseHash } from './proseFidelity'

/**
 * 12 hex digits of SHA-256 over the data's hash, the verdict and reason, and
 * the book passage the comparison read (`evidence`: the matched page or the
 * aligned span, '' when no book text was read). Computing it needs the books,
 * so a hand-written entry cannot carry a stamp that
 * `check-rules-fidelity.ts --verify` recomputes to the same value. The CI
 * gate, with no books, checks only its format.
 */
export function fidelityStamp(
  text: string,
  verdict: LockEntry['verdict'],
  reason: LockEntry['reason'],
  evidence: string
): string {
  const book = fold(evidence).replace(/\s+/g, ' ').trim()
  return createHash('sha256')
    .update(`${proseHash(text)}\n${verdict} ${reason ?? ''}\n${book}`)
    .digest('hex')
    .slice(0, 12)
}
