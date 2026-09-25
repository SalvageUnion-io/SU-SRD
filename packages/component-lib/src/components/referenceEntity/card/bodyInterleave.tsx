import type { ReactNode } from 'react'
import type { SURefObjectChoice, SURefObjectContentBlock } from 'salvageunion-reference'
import type { CardProseContext } from './CardProse'
import { CardProse } from './CardProse'
import type { AnchoredContentBlock } from './choiceAnchoring'

/**
 * The card BODY as an interleave: a plain in-order walk of the (anchored)
 * content blocks, in BOTH modes. Prose runs are rendered as `Content`
 * segments; a `{type:'choice'}` marker drops that choice's region in exactly
 * where it sits in the data; a `{type:'bonus'}` marker drops the
 * Bonus-per-Tech-Level box. Choices with no marker render at the natural END
 * position (trailing fallback), and so does an unanchored bonus box.
 *
 * Markers never contribute body text. A choice renders once, and not at all
 * when `choiceIsEmpty` says its region would be empty (a read-only text input
 * with no value would otherwise leave a margin gap in the prose).
 */
export function interleaveBody({
  blocks,
  choices,
  hideChoices,
  showProse,
  choiceIsEmpty,
  renderChoice,
  bonusNode,
  bonusAnchored,
  prose,
}: {
  blocks: AnchoredContentBlock[]
  choices: SURefObjectChoice[]
  hideChoices: boolean
  /** Prose segments render at all (the card shows a body, and `hide.content` is off). */
  showProse: boolean
  choiceIsEmpty: (choice: SURefObjectChoice) => boolean
  renderChoice: (choice: SURefObjectChoice) => ReactNode
  bonusNode: ReactNode
  bonusAnchored: boolean
  prose: CardProseContext
}): ReactNode[] {
  const nodes: ReactNode[] = []
  const choiceById = new Map(choices.map((c) => [c.id, c] as const))
  const rendered = new Set<string>()
  let buffer: SURefObjectContentBlock[] = []
  let seg = 0
  const flush = () => {
    if (buffer.length > 0 && showProse) {
      nodes.push(
        <div key={`seg-${seg}`} className="[&:not(:last-child)]:mb-3">
          <CardProse body={buffer} context={prose} />
        </div>
      )
    }
    buffer = []
    seg += 1
  }
  for (const block of blocks) {
    if (block?.type === 'choice') {
      const choice = block.choiceId ? choiceById.get(block.choiceId) : undefined
      if (choice && !hideChoices && !rendered.has(choice.id) && !choiceIsEmpty(choice)) {
        flush()
        nodes.push(renderChoice(choice))
        rendered.add(choice.id)
      }
      continue // markers never contribute body text
    }
    if (block?.type === 'bonus') {
      flush()
      if (bonusNode) nodes.push(bonusNode)
      continue
    }
    buffer.push(block)
  }
  flush()
  if (!hideChoices) {
    for (const choice of choices) {
      if (!rendered.has(choice.id) && !choiceIsEmpty(choice)) nodes.push(renderChoice(choice))
    }
  }
  // Bonus box that wasn't anchored to any prose → trailing position.
  if (bonusNode && !bonusAnchored) nodes.push(bonusNode)
  return nodes
}
