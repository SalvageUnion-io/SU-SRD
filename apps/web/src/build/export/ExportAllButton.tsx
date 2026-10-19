import { Button, Message, Stack, toast } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'

/**
 * "Export all" and its failure line. On an ink band (Shelves, the Roster,
 * board S1) the band's `data-ground` makes the button the on-ink ghost and the
 * line paper, in CSS (chrome K1).
 */
export function ExportAllButton() {
  const exportAll = useServerAction(
    async () => {
      const bundle = await buildExportBundle(useEntityStore.getState())
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`salvageunion-backup-${date}.json`, bundle)
    },
    { failure: 'The backup could not be downloaded. Try again.' }
  )
  const { pending: busy, error } = exportAll

  async function handleExportAll() {
    const result = await exportAll.run()
    if (result.ok) toast.success('Backup downloaded.')
    else toast.error(result.error)
  }

  return (
    <Stack gap={4}>
      <Button size="compact" disabled={busy} onClick={() => void handleExportAll()}>
        {busy ? 'Exporting…' : 'Export all'}
      </Button>
      <Message tone="bad">{error}</Message>
    </Stack>
  )
}
