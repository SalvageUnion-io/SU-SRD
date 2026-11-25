/** The words of apps/web/src/activity, the Discord Activity: the message catalogue (ADR-054). */

import { messages } from './define'

export const activityCopy = messages({
  site: 'SalvageUnion.io',
  signingIn: 'Signing you in with Discord…',
  unset: 'Sign-in is not set up on this site.',
  refused: 'Discord would not sign you in. Try again.',
  wentWrong: 'Something went wrong.',
  atTheTable: 'At the table',
  back: 'Back',
  games: 'Games',
  thisGame: 'This Game',
  manageOnWeb: 'Manage on the web',
  noGames: 'You are in no Game yet. Make one, or join with an invite, on the web.',
  notInGame: 'You are not in this Game.',
})
