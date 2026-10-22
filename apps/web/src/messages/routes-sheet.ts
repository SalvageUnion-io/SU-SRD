/** The words of apps/web/src/routes/sheet: the message catalogue (ADR-053). */

import { messages } from './define'

export const routesSheetCopy = messages({
  sheetNotFound: 'Sheet not found',
  isNotASheetType:
    '“{kind}” is not a sheet type. Sheets exist for pilots, mechs, crawlers and NPCs.',
})
