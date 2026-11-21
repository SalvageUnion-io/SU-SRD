/**
 * GamePrep — a Game's Prep, `/games/<gameId>/prep` (ADR-067 §3-4): the one
 * home for what its Mediator prepares for this Game. Its encounters in the
 * order they are planned, the NPCs designed for it, the Game's notes and its
 * sessions. Opened from the Game's band and its page's Prep section.
 *
 * Encounters and NPCs are still the Mediator's own records (their Kit lists
 * them across every Game, ADR-059); this page shows the ones marked for this
 * Game and is where they are ordered. The plan (`GamePlanSections`) is kept
 * in the Game's room. It is the table runner's page: anyone else is sent back.
 */

import { gamePath, mediatePath } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import type { Encounter } from 'game-domain/schemas/encounter'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { blankEncounter, encounterHref } from '../../../build/prep/encounter.model'
import { useSheetModeStore } from '../../../build/sheet/sheetMode.model'
import { ShelfLedger } from '../../../build/shelves/ShelfLedger'
import { PageShell } from '../../../components/app'
import type { HeaderMenuItem } from '../../../components/index'
import { Button, Callout, Field, Pending, Select, Text, tokens } from '../../../components/index'
import { useConfirm } from '../../../components/shared/useConfirm'
import { useGo } from '../../../components/shared/useGo'
import { useHydrateEntities, useOwnUnits } from '../../../lib/entities'
import { useHydrateOnMount } from '../../../lib/entities/useHydrateEntities'
import { PAGE_MEASURE } from '../../../lib/pageMeasure'
import { areaTitle } from '../../../lib/pageTitle'
import { runWrite } from '../../../lib/runWrite'
import { encounterReading, npcReading } from '../../../lib/shelves/shelfItems'
import { useTabTitle } from '../../../lib/useTabTitle'
import { playGamesCopy } from '../../../messages/play-games'
import { useEncounters } from '../../../replica/collections'
import { useGamesQuery } from '../../../replica/roomCalls'
import { useSync } from '../../../replica/syncContext'
import { GameBand } from '../GameBand'
import { HUB_COLUMNS, HUB_MAIN, HUB_SIDEBAR } from '../hubStyles.model'
import { GamePlanSections } from './GamePlanSections'
import { gameEncounters, lastOrder, looseEncounters, moveEncounter } from './gamePrep.model'

const { space } = tokens

const DOORS = { display: 'flex', flexWrap: 'wrap', gap: space[8] } satisfies CSSProperties
const TAKE_IN = {
  alignItems: 'end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties
const TAKE_IN_FIELD = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties

export function GamePrep({ gameId }: { gameId: string }) {
  const game = useGamesQuery('games.get', { gameId })
  useTabTitle(game ? areaTitle(PRODUCT.play, `${game.name} · ${playGamesCopy('prep')}`) : null)
  return (
    <PageShell
      measure={PAGE_MEASURE}
      stack={false}
      band={
        <GameBand
          gameId={gameId}
          name={game ? playGamesCopy('prepFor', { name: game.name }) : playGamesCopy('prep')}
          actions={
            <div style={DOORS}>
              <Button href={gamePath(gameId)} back variant="ink" size="compact">
                {playGamesCopy('game')}
              </Button>
              {game?.mediator && (
                <Button href={mediatePath(gameId)} variant="primary" size="compact">
                  {playGamesCopy('mediate')}
                </Button>
              )}
            </div>
          }
        />
      }
    >
      {game === undefined ? (
        <Pending label={playGamesCopy('thisGame')} />
      ) : game === null || !game.tableRunner ? (
        <Callout role="note">
          <Text>{playGamesCopy('prepIsTheMediators')}</Text>
          <div>
            <Button href={game === null ? '/games' : gamePath(gameId)} back size="compact">
              {game === null ? playGamesCopy('play') : playGamesCopy('game')}
            </Button>
          </div>
        </Callout>
      ) : (
        <PrepSections gameId={gameId} />
      )}
    </PageShell>
  )
}

function PrepSections({ gameId }: { gameId: string }) {
  const id = useId()
  const { canWrite } = useSync()
  const go = useGo()
  const { confirm, dialog } = useConfirm()
  useHydrateEntities(['npc'])
  const hydrated = useHydrateOnMount(() => useEncounters.getState().hydrate())
  const all = useEncounters((s) => s.encounters)
  const inGame = gameEncounters(all, gameId)
  const loose = looseEncounters(all)
  const npcs = useOwnUnits('npc').filter((n) => n.gameId === gameId)
  const [taking, setTaking] = useState('')
  const chosen = loose.find((e) => e.id === taking) ?? loose[0]

  const update = (encounterId: string, patch: Partial<Encounter>) =>
    useEncounters.getState().update(encounterId, patch)
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)

  async function newEncounter() {
    const created = await useEncounters
      .getState()
      .create({ ...blankEncounter(), gameId, order: lastOrder(inGame) })
    // A blank encounter has nothing to read: it opens in Edit.
    useSheetModeStore.getState().setEditing(true)
    go(encounterHref(created.id))
  }

  /** Move one a place: every encounter whose place changed is written. */
  const move = (encounterId: string, by: -1 | 1) =>
    runWrite(async () => {
      for (const { id: moved, order } of moveEncounter(inGame, encounterId, by)) {
        await update(moved, { order })
      }
    })

  function menu(encounter: Encounter, at: number): HeaderMenuItem[][] {
    return [
      [
        { id: 'open', label: 'Open', onSelect: () => go(encounterHref(encounter.id)) },
        {
          id: 'up',
          label: playGamesCopy('moveUp'),
          onSelect: at > 0 ? writable(() => move(encounter.id, -1)) : undefined,
        },
        {
          id: 'down',
          label: playGamesCopy('moveDown'),
          onSelect: at < inGame.length - 1 ? writable(() => move(encounter.id, 1)) : undefined,
        },
      ],
      [
        {
          id: 'out',
          label: playGamesCopy('takeOutOfThisGame'),
          onSelect: writable(() =>
            runWrite(() => update(encounter.id, { gameId: undefined, order: undefined }))
          ),
        },
      ],
    ]
  }

  return (
    <div style={HUB_COLUMNS}>
      <div style={HUB_MAIN}>
        <ShelfLedger
          id="prep-encounters"
          title={playGamesCopy('encounters')}
          tone="adversary"
          columns={[
            { key: 'order', label: '#', kind: 'figure' },
            { key: 'opp', label: 'Opposition', kind: 'figure' },
            { key: 'tables', label: 'Tables', kind: 'figure' },
          ]}
          action={
            canWrite ? (
              <Button variant="default" size="compact" onClick={() => runWrite(newEncounter)}>
                {playGamesCopy('newEncounterForThisGame')}
              </Button>
            ) : undefined
          }
          empty={hydrated ? playGamesCopy('noEncountersForThisGame') : ''}
          rows={inGame.map((e, at) => ({
            id: e.id,
            name: e.name,
            href: encounterHref(e.id),
            cells: [
              String(at + 1),
              String(encounterReading(e).value),
              String(e.tables.length || ''),
            ],
            menu: menu(e, at),
          }))}
        />
        {canWrite && chosen !== undefined && (
          <div style={TAKE_IN}>
            <div style={TAKE_IN_FIELD}>
              <Field label={playGamesCopy('fromYourKit')} htmlFor={`${id}-take`}>
                <Select
                  id={`${id}-take`}
                  value={chosen.id}
                  onChange={(e) => setTaking(e.target.value)}
                >
                  {loose.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              size="compact"
              onClick={() =>
                runWrite(async () => {
                  await update(chosen.id, { gameId, order: lastOrder(inGame) })
                  setTaking('')
                })
              }
            >
              {playGamesCopy('addToThisGame')}
            </Button>
          </div>
        )}
        <ShelfLedger
          id="prep-npcs"
          title={playGamesCopy('npcs')}
          tone="adversary"
          homebrew
          columns={[
            { key: 'position', label: 'Position', kind: 'text' },
            { key: 'hp', label: 'HP', kind: 'figure' },
          ]}
          action={
            <Button href="/npcs/new" variant="default" size="compact">
              {playGamesCopy('designAnNpc')}
            </Button>
          }
          empty={playGamesCopy('noNpcsForThisGame')}
          note={playGamesCopy('npcsForThisGameNote')}
          rows={npcs.map((n) => ({
            id: n.id,
            name: n.name,
            href: `/npcs/${n.id}`,
            cells: [n.position ?? '', String(npcReading(n).value)],
            menu: [],
          }))}
        />
      </div>
      <aside aria-label={playGamesCopy('thePlan')} style={HUB_SIDEBAR}>
        <GamePlanSections gameId={gameId} canWrite={canWrite} confirm={confirm} />
      </aside>
      {dialog}
    </div>
  )
}
