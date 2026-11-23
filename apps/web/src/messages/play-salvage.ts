/** The words of a wreck's salvage as the crew answers it (r7 D8): the strip's Change and its dialog. */

import { messages } from './define'

export const playSalvageCopy = messages({
  change: 'Change',
  change2: 'Change the pick: {text}',
  changeTitle: 'Pick from the wreck',
  changeBody: 'Take what the roll allows instead, Damaged. Everything else is destroyed.',
  takeThese: 'Take these',
  pickNone: 'Pick a part to take, or decline the offer.',
  part: '{name} · T{tl} · {sv} Slots',
  partOne: '{name} · T{tl} · 1 Slot',
})
