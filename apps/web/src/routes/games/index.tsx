/**
 * Your Games — /games/ (ADR-066)
 *
 * Where the header's Games tab lands: your Games (Play or Mediate) and the Discord channels play posts to, each one
 * tap from its Play screen (`PlayLanding`); in the Discord Activity, the
 * Activity's home (`ActivityHome`). The store and the Game list are
 * read in the component, never here (`.claude/rules/tanstack-router.md`).
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { ActivityHome } from '../../activity/ActivityHome'
import { useActivity } from '../../activity/activityStore'
import { areaTitle } from '../../lib/pageTitle'
import { PlayLanding } from '../../play/PlayLanding'

export const Route = createFileRoute('/games/')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.play) }] }),
  component: GamesRoute,
})

/** In the Discord Activity, the Activity's home: the same Games, as an Activity. */
function GamesRoute() {
  return useActivity() === null ? <PlayLanding /> : <ActivityHome />
}
