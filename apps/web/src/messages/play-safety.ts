/** The words of a Game's Safety Protocols: its page's Safety section and Play's Stop Sign (ADR-054). */

import { messages } from './define'

export const playSafetyCopy = messages({
  safety: 'Safety',
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
