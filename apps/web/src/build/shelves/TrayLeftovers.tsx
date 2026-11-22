/**
 * What an earlier Game delete left in the Mediator's Kit (MD3-03, ADR-030):
 * its field, filed as loose Tray rows. A Game's field now ends with it, so
 * these are only ever offered for removal: one line under the NPC shelf with
 * one act, and nothing goes without the confirm, which names every row.
 */

import type { CSSProperties } from 'react'
import { Button, Text, tokens } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { useTray } from '../../replica/collections'

/** The line: its words, then its one act. */
const LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  margin: 0,
} satisfies CSSProperties

export function TrayLeftovers({
  tray,
  confirm,
}: {
  tray: readonly { id: string; name: string }[]
  /** Absent where nothing can be written: the line stands with no act. */
  confirm: Confirm | undefined
}) {
  if (tray.length === 0) return null
  const one = tray.length === 1
  return (
    <p style={LINE}>
      <Text as="span" variant="note">
        {buildShelvesCopy(one ? 'leftOnTheFieldOne' : 'leftOnTheFieldMany', {
          count: tray.length,
        })}
      </Text>
      {confirm && (
        <Button
          variant="ghost"
          size="mini"
          onClick={() =>
            confirm({
              ...ROW_ACTION_COPY.removeLeftovers(tray.map((npc) => npc.name)),
              onConfirm: async () => {
                for (const npc of tray) await useTray.getState().delete(npc.id)
              },
            })
          }
        >
          {buildShelvesCopy(one ? 'removeIt' : 'removeThem')}
        </Button>
      )}
    </p>
  )
}
