import type { SURefObjectContentBlock } from 'salvageunion-reference'

/**
 * A guide step's prose, split into what the step renders in order: runs of
 * ordinary content blocks (`prose`, through `CardProse`) and the book's page
 * pointers (`note`, "Full details on Pilot Stats can be found on p. 20.").
 *
 * Two shapes in `guides.json` need this, and only guides carry them:
 *
 * - **`hint`** — every one of the 14 shipped hints is a citation or an aside
 *   closing its step. `Content` sets a hint as a centred italic tip, which on
 *   a page broke the left edge every other line holds; the guide sets it as a
 *   left-aligned note instead.
 * - **a value-only `label`, or a sub-`heading`** — "Tech Level" then a
 *   paragraph explaining it (Salvaging), "Out of Bounds" (Safety Protocols),
 *   "In Combat" (Tough Choices). The book prints these as run-in heads; as a
 *   bare label they read as one more paragraph, and as a sub-heading as a
 *   dashed slab — a second section head inside the step's own. `Content` renders a `label` block's
 *   `label` as the ink stamp over its `value`, so the pair folds into that one
 *   block: the head becomes the stamp, the paragraph its text, in a chunk of
 *   its own. A label with nothing to fold onto stays as it is.
 *
 * Pure and copy-preserving: no block's text is changed, only regrouped.
 */
export type GuideStepChunk =
  | { kind: 'prose'; blocks: SURefObjectContentBlock[] }
  | { kind: 'note'; text: string }

export function chunkGuideStepProse(
  content: SURefObjectContentBlock[] | undefined
): GuideStepChunk[] {
  const chunks: GuideStepChunk[] = []
  let run: SURefObjectContentBlock[] = []
  const flush = () => {
    if (run.length > 0) chunks.push({ kind: 'prose', blocks: run })
    run = []
  }

  const blocks = content ?? []
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]
    if (!block) continue
    if (block.type === 'hint' && typeof block.value === 'string') {
      flush()
      chunks.push({ kind: 'note', text: block.value })
      continue
    }
    const next = blocks[index + 1]
    if (
      isRunInHead(block) &&
      typeof block.value === 'string' &&
      next &&
      (next.type ?? 'paragraph') === 'paragraph' &&
      typeof next.value === 'string'
    ) {
      // Its own chunk, so the step's rhythm spaces the run-in head like a
      // paragraph rather than packing it against its neighbours.
      flush()
      chunks.push({ kind: 'prose', blocks: [{ ...next, type: 'label', label: block.value }] })
      index++
      continue
    }
    run.push(block)
  }
  flush()
  return chunks
}

/** A head the book runs into its paragraph: a value-only label, or a sub-heading. */
function isRunInHead(block: SURefObjectContentBlock): boolean {
  if (block.type === 'label') return !block.label
  return block.type === 'heading' && block.level !== 1
}
