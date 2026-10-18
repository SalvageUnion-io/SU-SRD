/**
 * Play landing — /play/
 *
 * Where the Union bar's Play tab lands: your Games (Play or Mediate), your
 * shelf's pilots (Play solo) and the Discord channels play posts to, each one
 * tap from its Play screen (`PlayLanding`). The store and the Game list are
 * read in the component, never here (`.claude/rules/tanstack-router.md`).
 */

import { createFileRoute } from '@tanstack/react-router'
import { pageTitle } from '../../lib/pageTitle'
import { PlayLanding } from '../../play/PlayLanding'

export const Route = createFileRoute('/play/')({
  head: () => ({ meta: [{ title: pageTitle('Play') }] }),
  component: PlayLanding,
})
