/** The words of apps/web/src/lib/sharing: the message catalogue (ADR-054). */

import { messages } from './define'

export const libSharingCopy = messages({
  onlyMe: 'Only me',
  myGamesCrew: 'My Game’s crew',
  itsGame: 'its Game',
  sheetPrivateInGame:
    'It is in {game}, so its crew can see it. Move it to your Training Bay to keep it to yourself.',
  sheetPrivateOnShelf: 'Kept in your Training Bay. Nobody else can open it.',
  sheetGameInGame: 'Everyone in {game} can see it, because it is there.',
  // An NPC in a Game is its Mediator's (r3 A3): the dialog says what the Kit's list says (MD4-02).
  onlyTheMediator: 'Only the Mediator',
  npcMediatorOnly: 'It is in {game}. Only its Mediator can see it, until it is put on the field.',
  npcCrewLater: 'The crew sees an NPC once it is put on the field.',
  sheetGameOnShelf: 'Move it into a Game to share it with that Game’s crew.',
  sheetLink:
    'One live, read-only page anyone can open with no account. It follows every edit, and everything on it goes too, bio and appearance text included.',
  patternPrivate: 'Kept in your Training Bay. Build Mechs from it any time.',
  patternNoGame: 'Join or start a Game to share with its crew.',
  patternGame: 'Everyone in {game} can see it and build from it.',
  patternLink: 'A public pattern page, like a reference page, that anyone can read and copy.',
})
