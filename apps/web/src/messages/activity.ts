/** The words of apps/web/src/activity, the Discord Activity: the message catalogue (ADR-054). */

import { messages } from './define'

export const activityCopy = messages({
  site: 'SalvageUnion.io',
  outside: 'Open this from Discord: start SalvageUnion.io from the App Launcher.',
  signingIn: 'Signing you in with Discord…',
  signedInAs: 'Signed in as {name}.',
  unset: 'Sign-in is not set up on this site.',
  refused: 'Discord would not sign you in. Try again.',
  wentWrong: 'Something went wrong.',
  atTheTable: 'At the table',
  toGames: 'Open your Games',
  layoutFocused: 'Full view',
  layoutPip: 'Picture-in-picture',
  layoutGrid: 'Grid tile',
})
