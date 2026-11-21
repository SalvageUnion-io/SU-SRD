/** The words of apps/web/src/routes: the message catalogue (ADR-054). */

import { messages } from './define'

/** The routes' page titles, the part before the area and site names (`pageTitle`, `areaTitle`). */
export const routesCopy = messages({
  metrics: 'Metrics',
  signIn: 'Sign in',
  signOut: 'Sign out',
  settings: 'Settings',
  linkPreview: 'Link preview',
  sharedSheet: 'Shared sheet',
  pattern: 'Pattern',
  retiredLink: 'Retired link',
  encounter: 'Encounter',
  designAnNpc: 'Design an NPC',
  editDesign: 'Edit design',
  /** The area an NPC's and an encounter's pages are titled with (ADR-067 §5). */
  mediatorsKit: 'Mediator’s Kit',
  newPilot: 'New Pilot',
  newMech: 'New Mech',
  newCrawler: 'New Crawler',
  play: 'Play',
  game: 'Game',
  mediate: 'Mediate',
  prep: 'Prep',
  joinAGame: 'Join a Game',
})
