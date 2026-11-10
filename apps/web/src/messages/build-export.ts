/** The words of apps/web/src/build/export: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildExportCopy = messages({
  backupDownloaded: 'Backup downloaded.',
  exportAll: 'Export all',
  exported: 'Exported {name}.',
  export: 'Export',
  exportedToFoundry: 'Exported {name}. In Foundry, make an empty {kind} and choose Import Data.',
  exportToFoundry: 'Export to Foundry',
  import: 'Import…',
  importFailed: 'That backup could not be imported. Try again.',
  backupFailed: 'The backup could not be downloaded. Try again.',
  importCompleteOne: 'Import complete — {count} entity created.',
  importCompleteMany: 'Import complete — {count} entities created.',
  backups: 'Backups: import and export',
})
