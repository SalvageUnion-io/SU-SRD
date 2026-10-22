/** The words of apps/web/src/build/export: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildExportCopy = messages({
  backupDownloaded: 'Backup downloaded.',
  exporting: 'Exporting…',
  exportAll: 'Export all',
  exported: 'Exported {name}.',
  export: 'Export',
  exportedToFoundry: 'Exported {name}. In Foundry, make an empty {kind} and choose Import Data.',
  exportToFoundryLabel: 'Export this {kind} to Foundry VTT',
  exportToFoundry: 'Export to Foundry',
  importing: 'Importing…',
  import: 'Import',
})
