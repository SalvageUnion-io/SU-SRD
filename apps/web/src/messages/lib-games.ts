/** The words of apps/web/src/lib/games: the message catalogue (ADR-054). */

import { messages } from './define'

export const libGamesCopy = messages({
  assignSelfFailed: '{name} could not be assigned to you. Try again.',
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
  unassignedFromYou:
    '{name} is no longer assigned to you: whoever runs the table unassigned it. You can still read it.',
  assignedToACrewmate: '{name} is now assigned to a crewmate. You can still read it.',
  assignedToYou: '{name} is now assigned to you.',

  thisGame: 'this Game',
  clearedPilot:
    'Their crawler assignment in {from} is cleared, and so is the Mech they fly there, if any.',
  clearedMech:
    'Its crawler assignment in {from} is cleared, and so is the Pilot flying it there, if any.',
  clearedNpc:
    "Their crew slot on a crawler in {from} is cleared, and that slot goes back to the book's crew line.",
  clearedCrawler: 'Everyone in {from} assigned to it is unassigned.',
  oneBuild: 'One build',
  stillInBay: '(still in your {bay})',
  crewLeaves: '{who} leaves its crew.',
  crewLeave: '{who} leave its crew.',
  pairingUnnamedTheir: 'Their pairing with a {kind} is cleared.',
  pairingUnnamedIts: 'Its pairing with a {kind} is cleared.',
  pairingNamedTheir: 'Their pairing with {name} {still} is cleared.',
  pairingNamedIts: 'Its pairing with {name} {still} is cleared.',
  theyLeaveTheirCrew: "They leave their crawler's crew.",
  itLeavesItsCrew: "It leaves its crawler's crew.",
  theyLeaveNamedCrew: "They leave {name}'s crew.",
  itLeavesNamedCrew: "It leaves {name}'s crew.",
  copyTitle: 'Make a copy of {name}?',
  copyBody:
    "This puts “{copy}” in your {bay}, in no Game. The copy is separate: changes to it won't sync back, and {name} is left as it is.",
  copyUndo: "Don't want it later? Delete the copy.",
  makeACopy: 'Make a copy',
  copyFailed: '{name} could not be copied. Try again.',
  deleteFromGameBody:
    'This cannot be undone. {name} will be removed from this Game for everyone, and from this browser.',
  deleteFromGameInstead:
    'Only leaving the table? “Unassign” hands them back instead: they stay in the Game for a crewmate to take with “Assign to me”.',
  deleteFailed: '{name} could not be deleted. Try again.',
  deleted: 'Deleted {name}.',
  deleteBuildBody: 'This action cannot be undone. {name} will be permanently removed.',
  deleteMechBody: '{name} will be removed. The notice that follows can undo it.',
  removeLeftoversOne: 'Remove {names}?',
  removeLeftoversMany: 'Remove {count} units?',
  removeLeftoversBody:
    'This cannot be undone. {names} will be removed from your Mediator’s Kit. The NPCs you designed are not touched.',
  removeLeftoversFailed: 'They could not all be removed. Try again.',
  deleteNpcBody: 'This cannot be undone. {name} will be removed from your Mediator’s Kit.',
  deleteNpcFromOne: '{name} is in {encounters}, and will be removed from it.',
  deleteNpcFromMany: '{name} is in {encounters}, and will be removed from them.',
  mechIsKept: 'Their Mech, {mech}, is kept, with no Pilot.',
  scrapBody: "This deletes {name} for everyone in the Game and can't be undone.",
  moveFailed: '{name} could not be moved. Try again.',
  moveOutTitle: 'Move {name} out of {from}?',
  moveOutBody:
    "{name} leaves the Game's roster and goes back to your {bay}, so the rest of the table won't see {it} any more.",
  moveBackIntoGame: 'You can move {it} back into the Game later.',
  moveToYourBay: 'Move to your {bay}',
  anotherGame: 'another Game',
  moveOnBody:
    "{name} leaves {from}'s roster and joins {to}'s, so {from}'s table won't see {it} any more.",
  moveBackLater: 'You can move {it} back later.',
  enterUndoOne:
    "You can move {them} back to your {bay} later, but you'll need to make that assignment again.",
  enterUndoMany:
    "You can move {them} back to your {bay} later, but you'll need to make those assignments again.",
  onlyMembersCanBring: 'Only members of this Game can bring builds into it.',
  unknownGame: 'Unknown Game',
  mediatorsKit: 'Mediator’s Kit',
  unionCrawler: 'Union Crawler',
})
