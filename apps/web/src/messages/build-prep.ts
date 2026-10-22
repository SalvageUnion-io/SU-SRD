/** The words of apps/web/src/build/prep and its shelf: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildPrepCopy = messages({
  notFound: 'Encounter not found',
  notFoundBody: "This encounter may have been deleted, or it is on another account's shelf.",
  backToTheTrainingBay: 'Back to the Training Bay',
  delete: 'Delete',
  lede: "Build it before the session; run it from your Game's Play when the fight starts. Running it copies the opposition in at full HP, so this stays as you built it.",
  name: 'Name',
  needsAName: 'An encounter needs a name.',
  opposition: 'Opposition',
  addOppositionFromTheReference: 'Add opposition from the reference',
  add: '+ Add',
  noOpposition: 'No opposition yet. Add NPCs, Mechs, Squads and Creatures from the reference.',
  moreFor: 'More for {name}',
  notes: 'Notes',
  onlyYou: 'Only you',
  yourNotes: 'Your notes',
  notesPlaceholder: 'What you want in front of you when it starts. Players never see this.',
  tablesToHand: 'Tables to hand',
  pinATablePlaceholder: 'Pin a table…',
  pinATable: 'Pin a table',
  tablesFound: 'Tables found',
  noTables:
    "No tables pinned. Play already pins the Scene's core tables; pin what this fight needs.",
  pinnedTables: 'Pinned tables',
  unpin: 'Unpin {name}',
  newEncounter: 'New encounter',
  makeACopy: 'Make a copy',
  encounters: 'Encounters',
  shelfNote: 'Your prep, ready to run in a Game you mediate.',
  addEncounter: '+ New encounter',
  noEncounters: 'No encounters yet. Prep one before the session.',
})
