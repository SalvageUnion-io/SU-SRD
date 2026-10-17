import { useServerAction } from '../../lib/connection/useServerAction'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'
import { Button, Message, Stack, toast } from '../index'

type ExportAllButtonProps = {
  /** Extra classes for the button (the Shelves band's on-ink outline). */
  className?: string
  /** It sits on the ink band (Shelves, board S1): its failure line reads in paper. */
  onInk?: boolean
}

export function ExportAllButton({ className, onInk = false }: ExportAllButtonProps = {}) {
  const exportAll = useServerAction(
    async () => {
      const bundle = await buildExportBundle(useEntityStore.getState())
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`cantina-backup-${date}.json`, bundle)
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
      <Button
        size="compact"
        disabled={busy}
        onClick={() => void handleExportAll()}
        className={className}
      >
        {busy ? 'Exporting…' : 'Export all'}
      </Button>
      <Message tone="bad" ground={onInk ? 'ink' : 'paper'}>
        {error}
      </Message>
    </Stack>
  )
}
