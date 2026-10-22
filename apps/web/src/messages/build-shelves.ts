/** The words of apps/web/src/build/shelves: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildShelvesCopy = messages({
  movedTo: 'Moved {name} to {label}.',
  move: 'Move {name}',
  move2: 'Move',
  whereTo: 'Where to',
  aCrawlerGoesOnlyInto: 'A crawler goes only into a Game you run. Start one with “+ New Game”.',
  youAreInNoGame:
    'You are in no Game to move it to. Start one with “+ New Game”, or join one from an invite link.',
  moreFor: 'More for {name}',
  starterSet: 'Starter Set',
})
