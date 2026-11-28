/**
 * The Activity's home and a Game in it: the Games' own pieces, laid out as
 * an Activity rather than as the site's pages.
 *
 *  - **Home** (`/games/` in the Activity): your Games at this table, each as
 *    the hub's own Game line (`PlayGameItem`: your role, who is here, the
 *    crew, and the door into your seat), then your pilots (`YourPilots`),
 *    each one tap from playing solo.
 *  - **A Game** (`/games/:id` in the Activity): that Game's line alone, its
 *    crew open, and its door. Managing a Game (its roster, invites, settings)
 *    is the website's work: "Manage on the web" opens it outside Discord.
 *
 * No band, page measure or foot: the screen is the Activity's, edge to edge.
 */

import { useNavigate } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import { pilotCallsign } from 'game-domain/pilotLabel'
import { useEffect } from 'react'
import { Button, capsLabel, Pending } from '../components/index'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { GAMES_ROOT } from '../lib/appBase'
import { cn } from '../lib/cn'
import { useServerAction } from '../lib/connection/useServerAction'
import { SITE_URL } from '../lib/constants'
import { useOwnUnits } from '../lib/entities'
import { activityCopy } from '../messages/activity'
import { playCopy } from '../messages/play'
import type { MyChannels } from '../play/channels.model'
import { channelTag } from '../play/channels.model'
import { PlayGameItem } from '../play/PlayLanding'
import { gamePilots } from '../play/play.model'
import { YourPilots } from '../play/YourPilots'
import { useGamesCall, useGamesQuery } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { useActivity } from './activityStore'

const HEADING = cn('su-activity-heading', capsLabel({ size: 'title' }))

/** Your Games as the Activity lists them; `only` narrows the list to one Game. */
function ActivityGames({ only }: { only?: string }) {
  const games = useGamesQuery('games.listMine', {})
  const channels = useGamesQuery('channelBindings.mine', {}) as MyChannels | undefined
  const pilots = useOwnUnits('pilot')
  const channelOf = new Map(
    (channels?.games ?? []).map((g) => [g.gameId, channelTag(g.binding)] as const)
  )
  const shown = only === undefined ? games : games?.filter((game) => game._id === only)
  const manage = `${SITE_URL}${only === undefined ? `${GAMES_ROOT}/` : gamePath(only)}`

  return (
    <>
      <section className="su-activity-section" aria-labelledby="activity-games">
        <div className="su-activity-head">
          <h2 id="activity-games" className={HEADING}>
            {only === undefined ? playCopy('yourGames') : activityCopy('thisGame')}
          </h2>
          <Button href={manage} variant="default" size="compact">
            {activityCopy('manageOnWeb')}
          </Button>
        </div>
        {shown === undefined ? (
          <Pending as="p" label={playCopy('yourGames2')} />
        ) : shown.length === 0 ? (
          <p className="su-activity-note">
            {only === undefined ? activityCopy('noGames') : activityCopy('notInGame')}
          </p>
        ) : (
          <ul className="su-activity-games">
            {shown.map((game) => (
              <PlayGameItem
                key={game._id}
                game={game}
                pilots={gamePilots(pilots, game._id).map((p) => ({
                  id: p.id,
                  name: pilotCallsign(p),
                }))}
                channel={channelOf.get(game._id) ?? null}
              />
            ))}
          </ul>
        )}
      </section>
      {only === undefined ? (
        <section className="su-activity-section">
          <YourPilots games={games} makes={false} />
        </section>
      ) : null}
    </>
  )
}

/** The launch channels whose Game this Activity already opened: once each, so Back stays home. */
const opened = new Set<string>()

/**
 * Where the Activity was launched (ADR-068 §6): the Game bound there opens
 * at once; with none, a Mediator runs one of theirs here with one tap, and a
 * player is told to ask theirs.
 */
function ActivityHere({ channelId, instanceId }: { channelId: string; instanceId: string }) {
  const launch = useGamesQuery('channelBindings.launch', { channelId })
  const bind = useServerAction(useGamesCall('channelBindings.bindHere'), {
    failure: activityCopy('bindDidNotLand'),
    toastId: 'activity-bind-here',
  })
  const navigate = useNavigate()
  const open = (gameId: string) => void navigate({ to: '/games/$gameId', params: { gameId } })
  const found = launch?.game?.gameId ?? null
  useEffect(() => {
    if (found === null || opened.has(channelId)) return
    opened.add(channelId)
    void navigate({ to: '/games/$gameId', params: { gameId: found } })
  }, [found, channelId, navigate])
  if (launch === undefined || launch.game !== null) return null
  return (
    <section className="su-activity-section" aria-labelledby="activity-here">
      <div className="su-activity-head">
        <h2 id="activity-here" className={HEADING}>
          {activityCopy('here')}
        </h2>
      </div>
      {launch.bindable.length === 0 ? (
        <p className="su-activity-note">{activityCopy('nothingHere')}</p>
      ) : (
        <>
          <p className="su-activity-note">{activityCopy('runHereNote')}</p>
          {launch.bindable.map((game) => (
            <Button
              key={game.gameId}
              variant="primary"
              size="compact"
              disabled={bind.pending}
              onClick={() =>
                void bind.run({ channelId, gameId: game.gameId, instanceId }).then((done) => {
                  if (done.ok) open(game.gameId)
                })
              }
            >
              {activityCopy('runHere', { name: game.gameName })}
            </Button>
          ))}
        </>
      )}
    </section>
  )
}

/** The Activity's home: a signed-in Activity always has a session, once it has synced. */
export function ActivityHome({ only }: { only?: string }) {
  const { status } = useSync()
  const activity = useActivity()
  const channelId = activity?.channelId ?? null
  const instanceId = activity?.instanceId ?? null
  if (status === 'syncing' || status === 'signedOut') {
    return <RoutePending label={playCopy('yourSession')} />
  }
  return (
    <main className="su-activity-page">
      {only === undefined && channelId && instanceId ? (
        <ActivityHere channelId={channelId} instanceId={instanceId} />
      ) : null}
      <ActivityGames {...(only === undefined ? {} : { only })} />
    </main>
  )
}
