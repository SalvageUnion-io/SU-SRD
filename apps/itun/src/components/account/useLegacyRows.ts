import { useEffect, useState } from 'react'
import type { LegacyLocalData as LegacyRows } from '../../lib/db/legacyLocalData'
import { probeLegacyLocalData, readLegacyLocalData } from '../../lib/db/legacyLocalData'
import { captureException } from '../../lib/observability'

/**
 * The rows this browser is holding, or `null` when it holds none.
 *
 * Probes rather than reading `legacyLocalDataState()` directly: the probe is
 * asynchronous and resolves after mount, and the connection context does not
 * re-render on its completion, so a component that read the cached answer once
 * would decide "nothing here" before the answer existed. `probeLegacyLocalData`
 * caches its own result, so awaiting it again costs nothing — which is what
 * lets both root banners call this without doubling the work.
 */
export function useLegacyRows(): LegacyRows | null {
  const [rows, setRows] = useState<LegacyRows | null>(null)

  useEffect(() => {
    let cancelled = false
    void probeLegacyLocalData()
      .then(async (state) => {
        if (state !== 'present' || cancelled) return
        const local = await readLegacyLocalData()
        if (!cancelled) setRows(local)
      })
      .catch((err: unknown) => {
        // A browser that will not read is not a browser holding a roster this
        // app can migrate. Report it and render nothing rather than blocking.
        captureException(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return rows
}

export function countLegacyRows(rows: LegacyRows): number {
  return rows.pilots.length + rows.mechs.length + rows.crawlers.length + rows.mechPatterns.length
}
