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

import { gamePath } from 'game-domain/entityKinds'
import { pilotCallsign } from 'game-domain/pilotLabel'
import { Button, capsLabel, Pending } from '../components/index'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { GAMES_ROOT } from '../lib/appBase'
import { cn } from '../lib/cn'
import { SITE_URL } from '../lib/constants'
import { useOwnUnits } from '../lib/entities'
import { activityCopy } from '../messages/activity'
import { playCopy } from '../messages/play'
import type { MyChannels } from '../play/channels.model'
import { channelTag } from '../play/channels.model'
import { PlayGameItem } from '../play/PlayLanding'
import { gamePilots } from '../play/play.model'
import { YourPilots } from '../play/YourPilots'
import { useGamesQuery } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'

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

/** The Activity's home: a signed-in Activity always has a session, once it has synced. */
export function ActivityHome({ only }: { only?: string }) {
  const { status } = useSync()
  if (status === 'syncing' || status === 'signedOut') {
    return <RoutePending label={playCopy('yourSession')} />
  }
  return (
    <main className="su-activity-page">
      <ActivityGames {...(only === undefined ? {} : { only })} />
    </main>
  )
}
