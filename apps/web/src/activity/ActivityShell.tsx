/**
 * The Discord Activity's shell, in place of the site's (`routes/__root`): the
 * app as an Activity, not a website in a frame. No Union bar, nav, search or
 * foot; the screen fills the frame edge to edge, on the Activity's own ground.
 *
 *  - **The Activity bar**: back, the Activity's name (home), and who is in
 *    the Activity, as Discord shows them. A Play screen draws its own bar (the
 *    Play bar), so there the Activity bar gives way.
 *  - **Links**: a route of the app moves the router, which never changes the
 *    frame's address (the SDK's connection lives on it). Anything else, a
 *    reference page or another site, opens in the player's browser, outside
 *    Discord (`openOutside`): the frame can show only the app.
 */

import { useRouter, useRouterState } from '@tanstack/react-router'
import { routeInApp } from 'game-domain/appAddress'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import '../styles/play/play.css'
import { Button } from '../components/index'
import { GAMES_ROOT } from '../lib/appBase'
import { SITE_URL } from '../lib/constants'
import { activityCopy } from '../messages/activity'
import { hidesUnionBar } from '../shell/unionSlots'
import type { ActivityState } from './activityStore'
import { ACTIVITY_HOME } from './activityStore'
import { activityLinkTarget } from './frame'

/** How many faces the bar shows before it counts the rest. */
const FACES = 5

export function ActivityShell({
  activity,
  children,
}: {
  activity: ActivityState
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const route = routeInApp(pathname) ?? pathname
  const home = route === ACTIVITY_HOME || route === GAMES_ROOT
  const { openOutside } = activity

  // Heard after the app's own handlers: a router link has already taken its
  // press (`defaultPrevented`); any other link would load a page into the
  // frame, so it moves the router or leaves Discord instead.
  useEffect(() => {
    const pressed = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return
      const target = activityLinkTarget(
        link.getAttribute('href') ?? '',
        window.location.origin,
        SITE_URL
      )
      if (target === null) return
      event.preventDefault()
      if (target.kind === 'route') void router.navigate({ href: target.path })
      else openOutside(target.url)
    }
    document.addEventListener('click', pressed)
    return () => document.removeEventListener('click', pressed)
  }, [router, openOutside])

  const faces = activity.people.slice(0, FACES)
  const more = activity.people.length - faces.length

  return (
    <div className="su-activity-shell">
      {hidesUnionBar(route) ? null : (
        <header className="su-activity-bar">
          {home ? null : (
            <Button
              back
              surface="instrument"
              variant="ghost"
              size="compact"
              onClick={() => {
                if (router.history.canGoBack()) router.history.back()
                else void router.navigate({ href: ACTIVITY_HOME })
              }}
            >
              {activityCopy('back')}
            </Button>
          )}
          <Button
            surface="instrument"
            variant="ghost"
            size="compact"
            onClick={() => void router.navigate({ href: ACTIVITY_HOME })}
          >
            {activityCopy('site')}
          </Button>
          <ul className="su-activity-faces" aria-label={activityCopy('atTheTable')}>
            {faces.map((person) => (
              <li key={person.id} className="su-activity-face" title={person.name}>
                <img src={person.avatarUrl} alt={person.name} />
              </li>
            ))}
            {more > 0 ? <li className="su-activity-face su-activity-more">+{more}</li> : null}
          </ul>
        </header>
      )}
      <div id="main-content" tabIndex={-1} className="su-activity-body">
        {children}
      </div>
    </div>
  )
}
