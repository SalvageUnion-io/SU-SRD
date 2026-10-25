/** The words of a Game's Safety Protocols: its page's Safety section and Play's Stop Sign (ADR-054). */

import { messages } from './define'

export const playSafetyCopy = messages({
  safety: 'Safety',
  outOfBounds: 'Out of Bounds',
  offCamera: 'Off Camera',
  outOfBoundsMeans: 'Not used in the game at all, and not brought up during it.',
  offCameraMeans: 'May happen, but only indirectly or in the background, never in detail.',
  nothingYet: 'Nothing yet.',
  add: 'Add',
  addTo: 'Add to {list}',
  boundary: 'Boundary',
  remove: 'Take off {text}',
  anyoneCanAdd:
    'Anyone at the table can add a boundary, and nobody is named beside one. Tell the table before you play, and whenever something comes up.',
  couldNotAdd: 'That boundary could not be added. Try again.',
  couldNotRemove: 'That boundary could not be taken off. Try again.',
  stopSign: 'Stop Sign',
  stop: 'Stop',
  showTheStopSign: 'Show the Stop Sign',
  stopSignMeans:
    'Anyone can show the Stop Sign at any time, from here or from Play, with no reason needed. The game pauses on every screen, without saying who.',
  postToChannel: 'Post it to the Discord channel',
  paused: 'Stop Sign: the game is paused',
  pausedBody:
    'Someone has shown the Stop Sign. Step out of character and talk it through. Nobody needs to justify it.',
  pausedYours: 'You showed the Stop Sign. The table sees it without your name.',
  resume: 'Resume play',
  couldNotChange: 'That could not be changed. Try again.',
  couldNotShow: 'The Stop Sign could not be shown. Say so out loud.',
  couldNotResume: 'Play could not be resumed. Try again.',
})
