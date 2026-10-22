/** The words of apps/web/src/components/shared: the message catalogue (ADR-053). */

import { messages } from './define'

export const sharedCopy = messages({
  noPictureYet: 'No picture yet.',
  uploading: 'Uploading…',
  replace: 'Replace',
  uploadPhoto: 'Upload photo',
  removeSPhoto: "Remove {name}'s photo",
  removing: 'Removing…',
  remove: 'Remove',
  referenceData: 'reference data',
  notConnectedYourGamesAre: 'Not connected — your Games are read-only until the connection returns',
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
  readOnlySignInTo: 'Read-only — sign in to edit',
  readOnlyUpdating: 'Read-only — updating',
  readOnlyForNow: 'Read-only for now',
  viewInTheReference: 'View in the Reference',
  viewInTheReference2: 'View {entityName} in the Reference',
})
