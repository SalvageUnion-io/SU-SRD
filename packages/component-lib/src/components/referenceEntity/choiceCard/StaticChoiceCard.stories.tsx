import type { Story } from '@ladle/react'
import { SalvageUnionReference, type SURefObjectContentBlock } from 'salvageunion-reference'

import { StaticChoiceCard } from './StaticChoiceCard'

/**
 * Compositions/Static Choice Card — the display-only frame `Content` uses to
 * render `list-item` content blocks (NPC motivations, "one of the following"
 * options, the settlement tech-level examples). A coloured frame over a white
 * inset body; labelled items lead with a black-stamp header, unlabelled bullets
 * are just the framed body. Not interactive — it borrows the choice-card look.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Static Choice Card',
}

/** Real list-item blocks pulled from action content. */
function listItems(actionName: string): SURefObjectContentBlock[] {
  const action = SalvageUnionReference.Actions.all().find(
    (a) => (a as { name?: string }).name === actionName
  ) as { content?: SURefObjectContentBlock[] } | undefined
  return (action?.content ?? []).filter((b) => b?.type === 'list-item')
}

// Unlabelled bullets — the Mech Acquisition settlement tech-level examples.
const unlabelled = listItems('Mech Acquisition')
// A labelled list-item, if any action carries one (NPC motivations etc.).
const labelled = SalvageUnionReference.Actions.all()
  .flatMap((a) => (a as { content?: SURefObjectContentBlock[] }).content ?? [])
  .find((b) => b?.type === 'list-item' && !!(b as { label?: string }).label) as
  | { label?: string; value?: unknown }
  | undefined

const MECH_TONE = 'var(--color-sheet-mech)'

/** Unlabelled + labelled, on a mech accent, both sizes. */
export const Default: Story = () => (
  <div className="flex max-w-xl flex-col gap-6">
    <div>
      <p className="mb-2 font-mono text-xs text-wk-muted">Unlabelled bullets (full)</p>
      {unlabelled.map((b, i) => (
        <StaticChoiceCard
          // biome-ignore lint/suspicious/noArrayIndexKey: static SRD list, order-stable
          key={i}
          description={String((b as { value?: unknown }).value ?? '')}
          parentHeaderBgColor={MECH_TONE}
        />
      ))}
    </div>
    {labelled && (
      <div>
        <p className="mb-2 font-mono text-xs text-wk-muted">Labelled (full)</p>
        <StaticChoiceCard
          label={String(labelled.label)}
          description={String(labelled.value ?? '')}
          parentHeaderBgColor={MECH_TONE}
        />
      </div>
    )}
    <div>
      <p className="mb-2 font-mono text-xs text-wk-muted">Compact</p>
      {unlabelled.map((b, i) => (
        <StaticChoiceCard
          // biome-ignore lint/suspicious/noArrayIndexKey: static SRD list, order-stable
          key={i}
          compact
          description={String((b as { value?: unknown }).value ?? '')}
          parentHeaderBgColor={MECH_TONE}
        />
      ))}
    </div>
  </div>
)
