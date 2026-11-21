/** The words of apps/web/src/lib/cargo: the message catalogue (ADR-054). */

import { messages } from './define'

export const libCargoCopy = messages({
  lotNotInMechHold: 'Cargo lot "{id}" is not in the Mech hold.',
  lotNotInStorageBay: 'Cargo lot "{id}" is not in the crawler Storage Bay.',
  lotNotInCrawlerHold: 'Cargo lot "{id}" is not in the crawler hold.',
  mechHoldHasNoFreeSlots: 'The Mech hold has no free cargo slots.',
  needsSlots: '"{name}" needs {units} slots but only {free} are free.',
  needsSlotsPerUnit: '"{name}" needs {per} slots per unit but only {free} are free.',
  notAScrapTechLevel: '"{tl}" is not a scrap Tech Level (1–6).',
  nothingToWithdraw: 'Nothing to withdraw.',
  scrapBucketIsEmpty: 'The Tech {tl} scrap bucket is empty.',
  mediatorKeepsTheCrawler: 'The Mediator keeps the crawler. Ask at the table.',
  changeNotSaved: 'That change could not be saved. Try again.',
  sheetIsReadOnly: 'This sheet is read-only.',
  noMechToTransfer: 'No Mech is assigned — nothing to transfer to or from.',
  noCrawlerToTransfer: 'No crawler is assigned — nothing to transfer to or from.',
  noMechToStoreCargoIn: 'No Mech is assigned — nothing to store cargo in.',
  noCrawlerToStoreCargoIn: 'No crawler is assigned — nothing to store cargo in.',
})
