/**
 * PatternEditControls — the maker's edits on their saved pattern's page:
 * Rename, and its Systems and Modules in the one picker (the count picker a
 * mech sheet's Manage opens), so a pattern is changed where it is, not by
 * building a mech from it and saving that over again. Each act's dialog is
 * titled as its button reads.
 *
 * The page reads the pattern from the public query, so these read the shelf's
 * own copy for what is installed now and write through the store; the query
 * hears the write back.
 */

import type { MechPattern } from 'game-domain/schemas/pattern'
import { useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { Button, EntitySearcher } from '../../../components/index'
import { loadoutSlots } from '../../../lib/patterns/patterns'
import { mechCopy } from '../../../messages/build-mech'
import { usePatterns } from '../../../replica/collections'
import { SheetPickerModal } from '../../sheet/SheetPickerModal'
import { RenameDialog } from '../../shelves/RenameDialog'

type Part = 'systems' | 'modules'

const COPY = {
  systems: {
    act: mechCopy('editSystems'),
    slots: mechCopy('systemSlots'),
    empty: mechCopy('noSystemsMatch'),
  },
  modules: {
    act: mechCopy('editModules'),
    slots: mechCopy('moduleSlots'),
    empty: mechCopy('noModulesMatch'),
  },
} as const

/** Patch the maker's own pattern, once the shelf's copy of it has arrived. */
async function patchPattern(id: string, patch: Partial<MechPattern>): Promise<void> {
  await usePatterns.getState().hydrate()
  await usePatterns.getState().update(id, patch)
}

export function PatternEditControls({ pattern }: { pattern: MechPattern }) {
  const [renaming, setRenaming] = useState(false)
  const [editing, setEditing] = useState<Part | null>(null)
  // The shelf's copy, live under the picker; the page's own until it arrives.
  const own = usePatterns((s) => s.mechPatterns.find((p) => p.id === pattern.id)) ?? pattern
  const slots = loadoutSlots(own)
  const budget = {
    systems: { used: slots.systemSlotsUsed, max: slots.systemSlotsMax },
    modules: { used: slots.moduleSlotsUsed, max: slots.moduleSlotsMax },
  }
  return (
    <>
      <Button className="su-page-action" onClick={() => setRenaming(true)}>
        {mechCopy('rename')}
      </Button>
      {(['systems', 'modules'] as const).map((part) => (
        <Button key={part} className="su-page-action" onClick={() => setEditing(part)}>
          {COPY[part].act}
        </Button>
      ))}
      <RenameDialog
        subject={
          renaming
            ? {
                name: own.name,
                label: mechCopy('patternName'),
                save: (name) => patchPattern(own.id, { name }),
              }
            : null
        }
        onClose={() => setRenaming(false)}
      />
      {(['systems', 'modules'] as const).map((part) => (
        <SheetPickerModal
          key={part}
          open={editing === part}
          onClose={() => setEditing(null)}
          title={COPY[part].act}
          floating
        >
          <EntitySearcher
            schema={part}
            mode="count"
            selected={own[part]}
            idOf={(item) => nameToSlug(item.name)}
            onAdd={(slug) => void patchPattern(own.id, { [part]: [...own[part], slug] })}
            onRemove={(index) =>
              void patchPattern(own.id, { [part]: own[part].filter((_, i) => i !== index) })
            }
            railName={own.name}
            chosenLabel={mechCopy('inThePattern')}
            emptyMessage={COPY[part].empty}
            budget={[{ label: COPY[part].slots, ...budget[part] }]}
          />
        </SheetPickerModal>
      ))}
    </>
  )
}
