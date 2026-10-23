/** The words of apps/web/src/build/homebrew: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildHomebrewCopy = messages({
  didNotSave: 'That did not save. Try again.',
  hidFromHomebrew: 'Hid {name} from Homebrew.',
  putBack: 'Put {name} back.',
  reportName: 'Report {name}',
  reported: 'Reported',
  report: 'Report',
  putBackInHomebrew: 'Put back in Homebrew',
  hideFromHomebrew: 'Hide from Homebrew',
  reportedThankYou: 'Reported {name}. Thank you.',
  reportTitle: 'Report {name}?',
  reportHint:
    'A site admin reads every report and can take it off the Reference’s Homebrew. Its maker is not told who reported it.',
  whatIsWrong: 'What is wrong with it',
  reasonPlaceholder: 'Copied book text, offensive, spam…',
  reporting: 'Reporting…',
  sayWhatIsWrong: 'Say what is wrong with it first.',
  reportFailed: 'The report did not go through. Try again.',
  dismissedReportsOn: 'Dismissed the reports on {name}.',
  patternBy: 'Pattern by {name}',
  reportedSection: 'Reported',
  noOpenReports: 'No open reports.',
  whyReported: 'Why {name} was reported',
  hide: 'Hide',
  dismissOne: 'Dismiss report',
  dismissMany: 'Dismiss {count} reports',
  takenDown: 'Taken down',
  putBackButton: 'Put back',
  moderationTitle: 'Homebrew moderation',
  moderationLede:
    'Patterns readers reported, and the ones taken off the Reference. A hidden pattern stays hidden if its maker shares it again.',
  adminsOnly: 'Only a site admin can see this page.',
})
