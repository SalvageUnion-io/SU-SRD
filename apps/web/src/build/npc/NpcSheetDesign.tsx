/**
 * NpcSheetDesign — the NPC sheet's Edit of its stat block (r6 B12, MD6-15):
 * its stats, and the reference actions and traits it carries, the designer's
 * own fields (`NpcDesignFields`) on the sheet, so one Edit edits everything.
 *
 * Saved as `saveNpcRedesign` saves the designer: onto the NPC in place and
 * every encounter of the maker's that fields it. A carried action saves at
 * once, as does HP or SP; a typed number when the player leaves it, the
 * sheet, Edit or the page.
 * Only the stat block is taken from here: the name and the identity lines are
 * the sheet's own fields, read fresh from the NPC at each save.
 *
 * Loaded on Edit, so Sheet view never carries it.
 */

import type { Npc } from 'game-domain/schemas/npc'
import { useEffect, useRef, useState } from 'react'
import { SlabSection } from '../../components/index'
import { npcCreationStepGate } from '../../lib/rules/creation'
import { runWrite } from '../../lib/runWrite'
import type { NpcFormState } from '../../lib/wizard/npcFormState'
import { NPC_STEP_LABELS, npcFormFromNpc } from '../../lib/wizard/npcFormState'
import { NpcActionsFields, NpcStatsFields } from './NpcDesignFields'
import { saveNpcRedesign } from './redesign.model'

/** The form's stat block: what this panel edits and saves. */
type StatBlock = Pick<
  NpcFormState,
  | 'hitPoints'
  | 'damageType'
  | 'bioSalvageValue'
  | 'actions'
  | 'traits'
  | 'offeredActions'
  | 'offeredTraits'
>

export function NpcSheetDesign({ npc }: { npc: Npc }) {
  const [form, setForm] = useState<NpcFormState>(() => npcFormFromNpc(npc))
  // The NPC as it stands now: the sheet's own fields may have changed its name since.
  const latest = useRef(npc)
  latest.current = npc
  const unsaved = useRef<StatBlock | null>(null)

  /** Save the stat block onto the NPC as it now stands, if it holds a name and HP ≥ 1. */
  const commit = useRef(() => {
    const block = unsaved.current
    if (block === null) return
    const next = { ...npcFormFromNpc(latest.current), ...block }
    if (!npcCreationStepGate('design', next).ok) return
    unsaved.current = null
    runWrite(() => saveNpcRedesign(latest.current, next))
  })

  function change(update: (prev: NpcFormState) => NpcFormState, now: boolean) {
    const next = update(form)
    unsaved.current = statBlock(next)
    setForm(next)
    if (now) commit.current()
  }

  // Leaving Edit, the sheet or the page saves what is still unsaved.
  useEffect(() => {
    const save = commit.current
    const hidden = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', save)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [])

  return (
    <>
      <SlabSection fold="open" title={NPC_STEP_LABELS.stats}>
        {/* A typed number saves when it is left, not per key; HP or SP at once. */}
        <NpcStatsFields
          form={form}
          onChange={(patch) => change((prev) => ({ ...prev, ...patch }), 'damageType' in patch)}
          onLeave={() => commit.current()}
        />
      </SlabSection>
      <SlabSection fold="open" title={NPC_STEP_LABELS.actions}>
        <NpcActionsFields form={form} onChange={(update) => change(update, true)} />
      </SlabSection>
    </>
  )
}

function statBlock(form: NpcFormState): StatBlock {
  const { hitPoints, damageType, bioSalvageValue, actions, traits, offeredActions, offeredTraits } =
    form
  return {
    hitPoints,
    damageType,
    bioSalvageValue,
    actions,
    traits,
    offeredActions,
    offeredTraits,
  }
}
