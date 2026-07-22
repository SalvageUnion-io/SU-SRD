import type { SURefObjectChoice, SURefObjectContentBlock } from 'salvageunion-reference'

/**
 * Synthetic CLIENT-SIDE marker spliced into a card's body walk: renders the
 * bonus-per-tech-level box at this position. Never present in reference data —
 * `value`/`choiceId` are declared `undefined` so union-wide property reads
 * (`blockLowerText`, the body walk) stay type-safe without casts.
 */
export type BonusMarkerBlock = { type: 'bonus'; value?: undefined; choiceId?: undefined }

/** A reference content block, or the synthetic `{type:'bonus'}` marker. */
export type AnchoredContentBlock = SURefObjectContentBlock | BonusMarkerBlock

/** Words too generic to anchor a choice by (see `anchorChoiceMarkers`). */
const STOP_WORDS = new Set(['ai', 'the', 'and', 'for', 'your', 'you'])

/** Significant words from a choice's name — the anchor keywords. */
const choiceKeywords = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

/** A block's prose, lowercased — empty for choice markers / non-string blocks. */
const blockLowerText = (b: AnchoredContentBlock): string =>
  b && b.type !== 'choice' && typeof b.value === 'string' ? b.value.toLowerCase() : ''

/**
 * AUTO-ANCHOR unmarked choices to the prose that introduces them: for a choice
 * with no explicit `{type:'choice'}` marker, inject one right after the LAST
 * content block that mentions the choice (a significant word from its name), so
 * it renders inline at its describing sentence — e.g. A.I. Personality after
 * "…the A.I. Personality Table for this or consider your own." A choice that
 * matches nothing gets no marker and falls to the card's trailing position.
 *
 * Mutates `blocks` in place (the caller owns the copy).
 */
export function anchorChoiceMarkers(
  blocks: AnchoredContentBlock[],
  choices: SURefObjectChoice[]
): void {
  const marked = new Set(
    blocks
      .map((b) => (b?.type === 'choice' ? b.choiceId : undefined))
      .filter((id): id is string => !!id)
  )
  for (const choice of choices) {
    if (marked.has(choice.id)) continue
    const kws = choiceKeywords(choice.name)
    if (kws.length === 0) continue
    let idx = -1
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const t = block ? blockLowerText(block) : ''
      if (t && kws.some((k) => t.includes(k))) idx = i
    }
    if (idx >= 0) {
      blocks.splice(idx + 1, 0, {
        type: 'choice',
        choiceId: choice.id,
      })
      marked.add(choice.id)
    }
  }
}

/**
 * Anchor the BONUS-PER-TECH-LEVEL box right after the prose that describes it
 * (e.g. "…its damage increases by 1 SP per Tech Level…"), so it sits WITH its
 * prose instead of trailing at the card's foot: splices a synthetic
 * `{type:'bonus'}` marker the body walk renders the box at.
 *
 * Mutates `blocks` in place; returns whether a describing block was found
 * (false ⇒ the caller renders the box at the trailing position).
 */
export function anchorBonusMarker(blocks: AnchoredContentBlock[]): boolean {
  const bonusKws = ['per tech level', 'tech level']
  let bIdx = -1
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const t = block ? blockLowerText(block) : ''
    if (t && bonusKws.some((k) => t.includes(k))) bIdx = i
  }
  if (bIdx >= 0) {
    blocks.splice(bIdx + 1, 0, { type: 'bonus' })
    return true
  }
  return false
}
