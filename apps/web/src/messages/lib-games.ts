/** The words of apps/web/src/lib/games: the message catalogue (ADR-054). */

import { messages } from './define'

export const libGamesCopy = messages({
  assignSelfTitle: 'Assign {name} to you?',
  assignSelfBody:
    '{name} is unassigned — the Mediator left them for somebody to take. Assigned to you, they are yours to edit in this Game, they open in this browser, and every change saves back to the Game. The rest of the crew can still read them.',
  assignSelfUndo: 'Changed your mind later? Hand them back with “Unassign”.',
  assignToMe: 'Assign to me',
  assigning: 'Assigning…',
  assignSelfFailed: '{name} could not be assigned to you. Try again.',
  assignToTitle: 'Assign {name} to {to}?',
  assignToFresh: '{to} will edit {name} in this Game; the rest of the crew can still read {them}.',
  assignToFrom: '{to} will edit {name} in this Game instead of {from}, who can still read {them}.',
  assignToUndo: 'Nothing on the sheet changes. You can reassign or unassign it again at any time.',
  assignTo: 'Assign to {to}',
  assignToFailed: '{name} could not be assigned to {to}. Try again.',
  unassignTitle: 'Unassign {name}?',
  unassignMine:
    "You'll stop editing {name}, and anyone in the Game can assign {them} to themselves.",
  unassignTheirs:
    'Its holder stops editing {name}, and anyone in the Game can assign {them} to themselves.',
  unassignUndoMine: 'You can take {them} back yourself, as long as nobody else has first.',
  unassignUndoTheirs: 'You can assign {them} to anyone again at any time.',
  unassign: 'Unassign',
  unassigning: 'Unassigning…',
  unassignFailed: '{name} could not be unassigned. Try again.',
})
