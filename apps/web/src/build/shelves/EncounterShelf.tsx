/**
 * EncounterShelf — the Training Bay's Encounters (ADR-059): the Mediator's
 * prep, each an opposition, tables to hand and notes, run later from a Game's
 * Play. User-made and only ever its maker's, so dashed and "Only me".
 *
 * "+ New encounter" makes a blank one and opens it; each item's "⋯" menu has
 * Open, Make a copy and Delete…, the last two through the page's one confirm.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import type { HeaderMenuItem } from '../../components/index'
import { Button, toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { runWrite } from '../../lib/runWrite'
import { encounterReading } from '../../lib/shelves/shelfItems'
import { buildPrepCopy } from '../../messages/build-prep'
import { useEncounters } from '../../replica/collections'
import { useSync } from '../../replica/syncContext'
import { blankEncounter, encounterCopy, encounterHref } from '../prep/encounter.model'
import { useSheetModeStore } from '../sheet/sheetMode.model'
import { ShelfLedger } from './ShelfLedger'

export function EncounterShelf({ confirm }: { confirm: Confirm }) {
  const { canWrite } = useSync()
  const go = useGo()
  const hydrated = useHydrateOnMount(() => useEncounters.getState().hydrate())
  const encounters = useEncounters((s) => s.encounters)

  /** Write verbs exist only where a write could land. */
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)

  function menu(encounter: Encounter): HeaderMenuItem[][] {
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(encounterHref(encounter.id)) },
        {
          id: 'copy',
          label: buildPrepCopy('makeACopy'),
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.copyOnShelf(encounter.name),
              onConfirm: async () => {
                const created = await useEncounters.getState().create(encounterCopy(encounter))
                toast.success(`Made ${created.name}.`)
              },
            })
          ),
        },
      ],
      [
        {
          id: 'delete',
          label: 'Delete…',
          tone: 'danger',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.deleteBuild(encounter.name),
              onConfirm: () => useEncounters.getState().delete(encounter.id),
            })
          ),
        },
      ],
    ]
  }

  async function newEncounter() {
    const created = await useEncounters.getState().create(blankEncounter())
    // A blank encounter has nothing to read: it opens in Edit.
    useSheetModeStore.getState().setEditing(true)
    go(encounterHref(created.id))
  }

  return (
    // MOCK (wave 2 build): the Encounters shelf in the Ledger form too.
    <ShelfLedger
      id="shelf-encounters"
      title={buildPrepCopy('encounters')}
      tone="adversary"
      columns={[
        { key: 'opp', label: 'Opposition', kind: 'figure' },
        { key: 'tables', label: 'Tables', kind: 'figure' },
      ]}
      action={
        canWrite ? (
          <Button variant="primary" size="compact" onClick={() => runWrite(newEncounter)}>
            {buildPrepCopy('addEncounter')}
          </Button>
        ) : undefined
      }
      empty={hydrated ? buildPrepCopy('noEncounters') : ''}
      note={buildPrepCopy('shelfNote')}
      rows={encounters.map((e) => ({
        id: e.id,
        name: e.name,
        href: encounterHref(e.id),
        cells: [String(encounterReading(e).value), String(e.tables.length || '')],
        menu: menu(e),
      }))}
    />
  )
}
