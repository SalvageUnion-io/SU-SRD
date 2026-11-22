/** The words of apps/web/src/build/sharing: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildSharingCopy = messages({
  qrCodeLinkingToThis: 'QR code linking to this sheet',
  whichGame: 'Which Game',
  copyPublicLink: 'Copy public link',
  scanToOpenOnAnother: 'Scan to open on another device.',
  shareStatus: 'Share status',
  chooseWhoCanSee: 'Choose who can see {name}.',
  whoeverCanSeeGetsA:
    'Whoever can see {name} gets a read-only view of it that keeps up with every change.',
  sharingNeedsAnAccountThe:
    'Sharing needs an account: the public page is served from what your account saves. No account is needed to read it.',
  sharingSettingsNeedALive:
    'Sharing settings need a live connection to your account. Try again once you are connected.',
  whoCanSeeIt: 'Who can see it',
  sharedSeparately: 'Shared separately',
  mechAndCrawlerSeparate:
    'This shares the Pilot alone. Their Mech and their crawler are shared separately, each from its own sheet, and read “Not shared” on the Pilot’s page until they are.',
  mechSeparate:
    'This shares the Pilot alone. Their Mech is shared separately, from its own sheet, and reads “Not shared” on the Pilot’s page until it is.',
  crawlerSeparate:
    'This shares the Pilot alone. Their crawler is shared separately, from its own sheet, and reads “Not shared” on the Pilot’s page until it is.',
  shareThe: 'Open {name} to share it',
  alsoShare: 'Also share {names}',
  andName: '{first} and {second}',
  shareOnReference: 'Share on the Reference',
  shareOnReferenceHint:
    'Shows it on its chassis’s page, in a Homebrew section beneath the book’s patterns, and on the Homebrew page, credited to you.',
  shareNotSaved: 'That could not be saved. Try again.',
  couldNotCopy: 'Could not copy. Select the link and copy it manually.',
})
