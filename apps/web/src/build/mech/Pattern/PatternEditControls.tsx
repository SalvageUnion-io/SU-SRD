/**
 * PatternEditControls — the maker's edits on their saved pattern's page, in
 * its ⋯ menu as a sheet's are (r5 D7): Rename, Edit description, its Systems and Modules in the one picker (the
 * count picker a mech sheet's Manage opens), and Delete (r4 E13), so a pattern
 * is changed where it is, not by building a mech from it and saving that over
 * again. Each act's dialog is titled as its button reads; Delete asks first,
 * as its shelf's does, and leaves for the Patterns page. The pickers open at the pattern's Tech Level and
 * an edit over its chassis's slots says so, both as on a mech sheet.
 *
 * The page reads the pattern from the public query, so these read the shelf's
 * own copy for what is installed now and write through the store; the query
 * hears the write back.
 */

import { useNavigate } from '@tanstack/react-router'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { EntitySearcher, HeaderMenu } from '../../../components/index'
import { useConfirm } from '../../../components/shared/useConfirm'
import { loadoutSlots, patternChassis } from '../../../lib/patterns/patterns'
import { mechRuleBreaks, ruleBreaksMade } from '../../../lib/rules/ruleBreaks'
import { mechCopy } from '../../../messages/build-mech'
import { usePatterns } from '../../../replica/collections'
import { ruleBreakToast } from '../../sheet/ruleBreakToast.model'
import { SheetPickerModal } from '../../sheet/SheetPickerModal'
import { deletePattern, deletePatternCopy } from '../../shelves/patternMenu.model'
import { RenameDialog } from '../../shelves/RenameDialog'
import { PatternDescriptionDialog } from './PatternDescriptionDialog'

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

/**
 * Patch the maker's own pattern, once the shelf's copy of it has arrived. An
 * edit that takes a count over its chassis, or further over, still saves and
 * says so, as the mech sheet's does (R71).
 */
async function patchPattern(id: string, patch: Partial<MechPattern>): Promise<void> {
  await usePatterns.getState().hydrate()
  const before = usePatterns.getState().mechPatterns.find((p) => p.id === id)
  await usePatterns.getState().update(id, patch)
  if (!before) return
  ruleBreakToast(
    id,
    ruleBreaksMade(mechRuleBreaks(before), mechRuleBreaks({ ...before, ...patch }))
  )
}

export function PatternEditControls({ pattern }: { pattern: MechPattern }) {
  const [renaming, setRenaming] = useState(false)
  const [describing, setDescribing] = useState(false)
  const { confirm, dialog } = useConfirm()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Part | null>(null)
  // The shelf's copy, live under the picker; the page's own until it arrives.
  const own = usePatterns((s) => s.mechPatterns.find((p) => p.id === pattern.id)) ?? pattern
  const slots = loadoutSlots(own)
  // The pickers open on the pattern's Tech Level, as a mech's do; a lettered one (Bio) shows all.
  const chassisTl = patternChassis(own)?.techLevel
  const techLevel = typeof chassisTl === 'number' ? chassisTl : undefined
  const budget = {
    systems: { used: slots.systemSlotsUsed, max: slots.systemSlotsMax },
    modules: { used: slots.moduleSlotsUsed, max: slots.moduleSlotsMax },
  }
  return (
    <>
      {/* The maker's edits fold into the ⋯ menu, Delete in its own group, as on a sheet (r5 D7). */}
      <HeaderMenu
        variant="overflow"
        size="compact"
        className="su-page-action"
        trigger={null}
        label={mechCopy('moreActions')}
        sections={[
          [
            { id: 'rename', label: mechCopy('rename'), onSelect: () => setRenaming(true) },
            {
              id: 'describe',
              label: mechCopy('editDescription'),
              onSelect: () => setDescribing(true),
            },
            ...(['systems', 'modules'] as const).map((part) => ({
              id: part,
              label: COPY[part].act,
              onSelect: () => setEditing(part),
            })),
          ],
          [
            {
              id: 'delete',
              label: mechCopy('delete'),
              tone: 'danger' as const,
              onSelect: () =>
                confirm({
                  ...deletePatternCopy(own),
                  onConfirm: async () => {
                    await deletePattern(own.id)
                    void navigate({ to: '/patterns' })
                  },
                }),
            },
          ],
        ]}
      />
      {dialog}
      <PatternDescriptionDialog
        open={describing}
        onClose={() => setDescribing(false)}
        name={own.name}
        description={own.notes ?? ''}
        save={(notes) => patchPattern(own.id, { notes: notes || undefined })}
      />
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
            techLevel={techLevel}
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
