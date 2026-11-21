/**
 * actionEffect — an action's EFFECT, what happens when you use it, for an
 * actions row (Play's board, a Live Sheet's Actions list, the Mediator's NPC
 * actions; R65). Pure, display-only: the book's words are never changed, only
 * left out. The whole text stays on the action's card, which the row's name
 * Peeks.
 *
 * What is left out is marked in the data, not guessed: a content block's
 * `notInPlay` tags name the setup, upkeep, examples and flavour, either the
 * whole block or its exact words (the reference data's `play-tags` check holds
 * every tag to its block). The `flavor`, `hint`, `heading` and `choice` blocks
 * and the unlabelled `datavalues` row (the head's chips are that row, with the
 * picks applied) are left out by type.
 */

import type {
  ChoiceSelections,
  RefMetaAction,
  RefObjectChoice,
  RefObjectContentBlock,
} from 'salvageunion-reference'

/** Tokens a full stop follows without ending a sentence. */
const ABBREVIATION = /(?:^|[\s(])(?:(?:[A-Za-z]\.)*[A-Za-z]|e\.g|i\.e|Art|vs|etc|approx)$/

/** The paragraph's sentences, split at a full stop that ends one. */
function sentencesOf(text: string): string[] {
  const out: string[] = []
  let start = 0
  const stop = /[.!?]+["')\]*]*\s+(?=[A-Z[(*"'])/g
  for (let m = stop.exec(text); m !== null; m = stop.exec(text)) {
    const head = text.slice(start, m.index)
    if (ABBREVIATION.test(head)) continue
    out.push(text.slice(start, m.index + m[0].length).trim())
    start = m.index + m[0].length
  }
  const tail = text.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

const matches = (tests: readonly RegExp[], text: string) => tests.some((t) => t.test(text))

/** The block's words with its tagged words taken out, the spacing they leave tidied. */
function withoutTagged(value: string, cuts: readonly string[]): string {
  let text = value
  for (const cut of cuts) text = text.replace(cut, '')
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/**
 * The action's effect: its content with the tagged setup, upkeep, examples
 * and flavour left out. Empty when the head's chips are the whole of it (a
 * plain weapon).
 */
export function actionEffect(action: RefMetaAction): RefObjectContentBlock[] {
  const kept: RefObjectContentBlock[] = []
  for (const block of action.content ?? []) {
    const type = block.type ?? 'paragraph'
    if (type === 'flavor' || type === 'hint' || type === 'heading' || type === 'choice') continue
    if (type === 'datavalues') {
      if (block.label) kept.push(block)
      continue
    }
    const tags = block.notInPlay ?? []
    if (tags.length === 0 || typeof block.value !== 'string') {
      kept.push(block)
      continue
    }
    const cuts = tags.map((t) => t.text)
    if (cuts.some((c) => c === undefined)) continue
    const { notInPlay: _tags, ...rest } = block
    const value = withoutTagged(block.value, cuts as string[])
    if (value) kept.push({ ...rest, value })
  }
  return kept
}

/** A pick the player made on an action's choices, as its row says it (R60). */
export type ActionPick = {
  /** The choice it answers ("Modification"). */
  choice: string
  /** The option picked ("High Calibre Rounds"). */
  label: string
  /**
   * What the pick lets you do when you use the action, where it is more than
   * a number or trait the chips already carry ("You may spend 2 AP to
   * automatically hit…"). Absent for a pick the chips say in full.
   */
  text?: string
}

/** A sentence that only restates a trait or number the pick's effects already applied. */
const RESTATES = [
  /gains the \[\[[^\]]+\]\] trait\.?$/i,
  /^it also gains the/i,
  /increases its range to/i,
  /deals an additional \d+ (SP|HP) damage/i,
]

/**
 * The picks made on `choices`, in the choices' order. An option's own text is
 * kept only where it says something to do at the table (a spend, a
 * condition); a pick that only changes Range, Damage or a trait reads in the
 * chips.
 */
export function actionPicks(
  choices: readonly RefObjectChoice[],
  selections: ChoiceSelections
): ActionPick[] {
  const out: ActionPick[] = []
  for (const choice of choices) {
    const picked = selections[choice.id] ?? []
    const options = choice.source?.kind === 'options' ? choice.source.options : []
    for (const value of picked) {
      const option = options.find((o) => o.value === value || o.label === value)
      const label = option?.label ?? value
      const text = option?.description
        ? sentencesOf(option.description)
            .filter((s) => !matches(RESTATES, s))
            .join(' ')
        : ''
      out.push({
        choice: choice.name,
        label,
        ...(text && /\b(may|spend|when|if|instead|once)\b/i.test(text) ? { text } : {}),
      })
    }
  }
  return out
}
