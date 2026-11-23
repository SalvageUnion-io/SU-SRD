/** The words of apps/web/src/lib/sharing: the message catalogue (ADR-054). */

import { messages } from './define'

export const libSharingCopy = messages({
  onlyMe: 'Only me',
  myGamesCrew: 'My Game’s crew',
  publicLink: 'Public (anyone with the link)',
  itsGame: 'its Game',
  sheetPrivateInGame:
    'It is in {game}, so its crew can see it. Move it to your Training Bay to keep it to yourself.',
  sheetPrivateOnShelf: 'Kept in your Training Bay. Nobody else can open it.',
  sheetGameInGame: 'Everyone in {game} can see it, because it is there.',
  // An NPC in a Game is its Mediator's (r3 A3), on the field too: the Opposition
  // is never shown to players. The crew sees one that crews its crawler (r5 B12).
  onlyTheMediator: 'Only the Mediator',
  npcMediatorOnly:
    'It is in {game}. Only its Mediator can see it, on the field too: players never see the Opposition.',
  npcCrewLater: 'The crew sees an NPC once it crews the Game’s crawler.',
  sheetGameOnShelf: 'Move it into a Game to share it with that Game’s crew.',
  sheetLink:
    'One live, read-only page anyone can open with no account. It follows every edit, and everything on it goes too, bio and appearance text included.',
  patternPrivate: 'Kept in your Training Bay. Build Mechs from it any time.',
  patternNoGame: 'Join or start a Game to share with its crew.',
  patternGame: 'Everyone in {game} can see it and build from it.',
  patternLink: 'A public pattern page, like a reference page, that anyone can read and copy.',
  patternLinkCredited:
    'A public pattern page, like a reference page, that anyone can read and copy. It says it was made by you, by your display name.',
})
