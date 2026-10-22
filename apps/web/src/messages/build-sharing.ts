/** The words of apps/web/src/build/sharing: the message catalogue (ADR-053). */

import { messages } from './define'

export const buildSharingCopy = messages({
  theQrCode: 'the QR code',
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
})
