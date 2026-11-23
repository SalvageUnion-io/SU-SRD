/** The words of a Game's Safety Protocols: its page's Safety section and Play's Stop Sign (ADR-054). */

import { messages } from './define'

export const playSafetyCopy = messages({
  safety: 'Safety',
  stopSign: 'Stop Sign',
  showTheStopSign: 'Show the Stop Sign',
  stopHold: 'Stop · hold',
  holdToShow: 'Hold to show the Stop Sign',
  offlineSayAloud: 'You are offline. Say it aloud; the table will not see it.',
  stopSignMeans:
    'Anyone can show the Stop Sign at any time, from here or from Play, with no reason needed. On a phone, hold it to show it. It asks the table to pause, on every screen and without saying who; sheets stay usable. It posts to the Discord channel while one is bound.',
  pausedBody:
    'Someone has shown the Stop Sign: the table is asked to pause, step out of character and talk it through. Nobody needs to justify it. Sheets stay usable.',
  pausedYours: 'You showed the Stop Sign. The table sees it without your name.',
  resume: 'Resume play',
  liftedYours: 'The Mediator lifted your Stop Sign. Play resumes.',
  couldNotShow: 'The Stop Sign could not be shown. Say so out loud.',
  couldNotResume: 'Play could not be resumed. Try again.',
})
