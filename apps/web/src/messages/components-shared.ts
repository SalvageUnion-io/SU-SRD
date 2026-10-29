/** The words of apps/web/src/components/shared: the message catalogue (ADR-054). */

import { messages } from './define'

export const sharedCopy = messages({
  savedWorkOnAccount:
    'Everything saved to your account is stored on the server and is not affected.',
  savedWorkOnAnAccount: 'Anything saved to an account is stored on the server and is not affected.',
  savedWorkSignedOut: 'Nothing is built without an account, so reloading loses nothing.',
  savedWorkUnknown: 'Anything already saved is not affected.',
  noPictureYet: 'No picture yet.',
  uploading: 'Uploading…',
  replace: 'Replace',
  uploadPhoto: 'Upload photo',
  removeSPhoto: "Remove {name}'s photo",
  removing: 'Removing…',
  remove: 'Remove',
  referenceData: 'reference data',
  offline: 'Offline',
  offlineReadOnly: 'Offline · read-only',
  notConnectedYourGamesAre: 'Not connected — your Games are read-only until the connection returns',
  offlineChangeDeclined: 'A change made offline was not saved: {reason}',
  offlineGameGone: 'its Game has ended, or you are no longer in it',
  somethingWentWrong: 'Something went wrong',
  theAppHitAnUnexpected: 'The app hit an unexpected error. {savedWorkCopy}',
  tryAgain: 'Try again',
  thisPageHitAnError: 'This page hit an error',
  somethingOnThisPageDid: 'Something on this page did not load. {savedWorkCopy}',
  trainingBay: 'Training Bay',
  checkThisEdit: 'Check this edit?',
  advisoryRuleWarningsForThis: 'Advisory rule warnings for this edit. Saving is always allowed.',
  thisEditIsLegalTo:
    'This edit is legal to make — the rules just flag it. Save anyway, or go back and change it.',
  cancel: 'Cancel',
  saveAnyway: 'Save anyway',
  view: 'View',
  view2: 'View {name}',
  unassign: 'Unassign',
  unassign2: 'Unassign {name}',
  readOnlyUpdating: 'Read-only — updating',
  viewInTheReference: 'View in the Reference',
  viewInTheReference2: 'View {entityName} in the Reference',
})
