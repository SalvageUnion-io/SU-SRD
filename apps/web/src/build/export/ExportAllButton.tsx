import { useServerAction } from '../../lib/connection/useServerAction'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { useEntityStore } from '../../stores/entityStore'
import { Button, Message, Stack, toast } from '../../components/index'

type ExportAllButtonProps = {
  /**
   * The ground it sits on: `ink` on an ink band (Shelves, the Roster, board
   * S1), where the button is the on-ink ghost and its failure line reads in paper.
   */
  ground?: 'paper' | 'ink'
}

export function ExportAllButton({ ground = 'paper' }: ExportAllButtonProps = {}) {
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
      <Button
        variant={ground === 'ink' ? 'ghost' : 'default'}
        surface={ground}
        size="compact"
        disabled={busy}
        onClick={() => void handleExportAll()}
      >
        {busy ? 'Exporting…' : 'Export all'}
      </Button>
      <Message tone="bad" ground={ground}>
        {error}
      </Message>
    </Stack>
  )
}
