/**
 * EncounterShelf — the Training Bay's Encounters (ADR-053): the Mediator's
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
import { useConnection } from '../../lib/connection/connectionContext'
import { useHydrateOnMount } from '../../lib/entities/useHydrateEntities'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { runWrite } from '../../lib/runWrite'
import { encounterChips, encounterReading } from '../../lib/shelves/shelfItems'
import { usePrepStore } from '../../stores/prepStore'
import { blankEncounter, encounterCopy, encounterHref } from '../prep/encounter.model'
import { Shelf } from './Shelf'
import { ShelfItem } from './ShelfItem'

export function EncounterShelf({ confirm }: { confirm: Confirm }) {
  const { canWrite } = useConnection()
  const go = useGo()
  const hydrated = useHydrateOnMount(() => usePrepStore.getState().hydrate())
  const encounters = usePrepStore((s) => s.encounters)

  /** Write verbs exist only where a write could land. */
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)

  function menu(encounter: Encounter): HeaderMenuItem[][] {
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(encounterHref(encounter.id)) },
        {
          id: 'copy',
          label: 'Make a copy',
          onSelect: writable(() =>
            confirm({
              ...ROW_ACTION_COPY.copyOnShelf(encounter.name),
              onConfirm: async () => {
                const created = await usePrepStore.getState().create(encounterCopy(encounter))
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
              onConfirm: () => usePrepStore.getState().delete(encounter.id),
            })
          ),
        },
      ],
    ]
  }

  async function newEncounter() {
    const created = await usePrepStore.getState().create(blankEncounter())
    go(encounterHref(created.id))
  }

  return (
    <Shelf
      id="shelf-encounters"
      title="Encounters"
      aside="Yours"
      note="Your prep, ready to run in a Game you mediate."
      action={
        canWrite ? (
          <Button size="mini" onClick={() => runWrite(newEncounter)}>
            + New encounter
          </Button>
        ) : undefined
      }
      isEmpty={hydrated && encounters.length === 0}
      empty="No encounters yet. Prep one before the session."
    >
      {encounters.map((e) => (
        <ShelfItem
          key={e.id}
          kind="encounter"
          name={e.name}
          reading={encounterReading(e)}
          href={encounterHref(e.id)}
          userMade
          chips={encounterChips(e)}
          menu={menu(e)}
        />
      ))}
    </Shelf>
  )
}
