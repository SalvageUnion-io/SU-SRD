/**
 * actionEffect — an action's EFFECT, what happens when you use it, cut from
 * its book text for an actions row (Play's board, a Live Sheet's Actions
 * list; R65). Pure, display-only: the book's words are never changed, only
 * left out. The whole text stays on the action's card, which the row's name
 * Peeks.
 *
 * Left out, a sentence at a time:
 *  - SETUP and ON-CHOOSE text: what you do when you take, craft or build the
 *    thing ("Choose if it is a Ballistic or Energy weapon", "At each Tech
 *    Level you may choose an additional modification", "Name and describe").
 *  - UPKEEP text: how you replace it, how it scales with the Union Crawler
 *    (the row's chips already carry the scaled numbers).
 *  - EXAMPLES ("For example, …", "e.g. …").
 * Left out, a paragraph at a time:
 *  - FLAVOUR: a paragraph with no rules signal in it (no number, trait,
 *    resource, range, roll, action type or "you may"), where the action has
 *    other rules text or its chips already say what it does.
 *  - `flavor`, `hint`, `heading` and `choice` blocks, and the unlabelled
 *    `datavalues` row (the head's chips are that row, with the picks applied).
 *
 * The reference data types only `flavor` on a content block, so the rest is
 * read from the words: the patterns below are the whole rule, and
 * `__tests__/actionEffect.test.ts` holds them to the book's actions.
 */

import type {
  ChoiceSelections,
  RefMetaAction,
  RefObjectChoice,
  RefObjectContentBlock,
} from 'salvageunion-reference'

/** A sentence that is about taking, crafting or building the thing. */
const SETUP: readonly RegExp[] = [
  /^when (crafting|you (first )?(choose|take|select|acquire|install|craft|build|gain) this)/i,
  /a\.i\. personality/i,
  /^choose (if (it|your)|a modification|your own|this or roll)/i,
  /^in addition, choose/i,
  /choose (a|an additional|three) modifi/i,
  /^at each tech level/i,
  /^name (and describe|your)/i,
  /describe what/i,
  /can look however you wish/i,
  /^(it|this) could be /i,
  /^you (acquire and train|have constructed|construct an?|have built)\b/i,
  /^it can be customised/i,
]

/** A sentence about replacing it or how it scales (the chips carry the scaled numbers). */
const UPKEEP: readonly RegExp[] = [
  /acquire a new one/i,
  /you may only ever have one/i,
  /per tech level/i,
  /tech level equal to your union crawler/i,
  /upgraded along with/i,
  /if your union crawler is upgraded/i,
  /uses the same rules as mechs/i,
  /may have one active/i,
  /you may craft a new/i,
]

const EXAMPLE: readonly RegExp[] = [/^for example\b/i, /^e\.g\./i, /\be\.g\. /i]

/** Words that mark rules text: a number, a trait, a resource, a range, a roll, an action type. */
const SIGNAL: readonly RegExp[] = [
  // A number standing alone (a cost, an amount, a roll), never a model name's (120mm, 360°).
  /(^|[\s(+-])\d+(-\d+)?(?=[\s.,;:)]|$)/,
  /\[\[/,
  /\b(SP|HP|EP|AP|Heat|Range|Trait|Hit Points?|Structure Points?|Energy Points?|Ability Points?)\b/,
  /\b(Turn|Free|Short|Long|Downtime) Actions?\b|\bReaction\b/,
  /\b[Rr]e-?rolls?\b|\b[Rr]oll(s|ed)?\b/,
  /\bwhen activated\b/i,
  /\bMediator\b/,
  /\b(Damaged|Destroyed|Intact|Vulnerable|Shutdown|Push(ed)?)\b/,
  /\byou (may|can|cannot|must|regain|gain|repair|deal|take|make|salvage)\b/i,
]

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

/** Whether a sentence is setup, upkeep or an example: never the effect. */
function isBuildSentence(sentence: string): boolean {
  return matches(SETUP, sentence) || matches(UPKEEP, sentence) || matches(EXAMPLE, sentence)
}

/** Whether text carries a rules signal. */
function hasRulesSignal(text: string): boolean {
  return matches(SIGNAL, text)
}

/** Whether the action's head already says what it does: a range or damage of its own. */
function headSaysIt(action: RefMetaAction): boolean {
  return (
    (action.range?.length ?? 0) > 0 ||
    action.damage !== undefined ||
    (action.content ?? []).some((c) => c.type === 'datavalues' && !c.label)
  )
}

/**
 * The action's effect: its content with the setup, upkeep, examples and
 * flavour left out. Empty when the head's chips are the whole of it (a plain
 * weapon).
 */
export function actionEffect(action: RefMetaAction): RefObjectContentBlock[] {
  const kept: { block: RefObjectContentBlock; signal: boolean }[] = []
  for (const block of action.content ?? []) {
    const type = block.type ?? 'paragraph'
    if (type === 'flavor' || type === 'hint' || type === 'heading' || type === 'choice') continue
    if (type === 'datavalues') {
      if (block.label) kept.push({ block, signal: true })
      continue
    }
    if (typeof block.value !== 'string') {
      kept.push({ block, signal: true })
      continue
    }
    const text = sentencesOf(block.value)
      .filter((s) => !isBuildSentence(s))
      .join(' ')
    if (!text) continue
    // A list item is one of the effect's options: its label is a signal.
    const signal = type === 'list-item' || hasRulesSignal(text)
    kept.push({ block: text === block.value ? block : { ...block, value: text }, signal })
  }
  const anySignal = kept.some((k) => k.signal)
  // Flavour goes where something else says what the action does.
  if (anySignal || headSaysIt(action)) return kept.filter((k) => k.signal).map((k) => k.block)
  return kept.map((k) => k.block)
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
