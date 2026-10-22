/**
 * LibraryPageControls — what a listed pattern's or NPC's own page offers about
 * the Homebrew library (ADR-056), in its corner beside Make a copy: Report…
 * for a signed-in reader who did not make it, and a site admin's Hide or Put
 * back. Nothing while it is not listed (and not taken down), so an unlisted
 * share link reads exactly as before.
 */

import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Button, toast } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import type { LibraryKind } from '../../lib/library/library'
import { ReportDialog } from './ReportDialog'

type LibraryPageControlsProps = { kind: LibraryKind; appId: string; name: string }

export function LibraryPageControls({ kind, appId, name }: LibraryPageControlsProps) {
  const status = useQuery(api.library.status, { kind, appId })
  const setHidden = useMutation(api.library.setHidden)
  const [reporting, setReporting] = useState(false)
  const hide = useServerAction((hidden: boolean) => setHidden({ kind, appId, hidden }), {
    failure: 'That did not save. Try again.',
    toastId: 'library-hide',
  })

  if (status === undefined) return null
  const { listed, hidden, reported, mine, admin } = status

  async function moderate(next: boolean) {
    const result = await hide.run(next)
    if (result.ok) toast.success(next ? `Hid ${name} from the library.` : `Put ${name} back.`)
  }

  return (
    <>
      {listed && !mine && (
        <Button
          className="su-page-action"
          onClick={() => setReporting(true)}
          aria-label={`Report ${name}`}
        >
          {reported ? 'Reported' : 'Report'}
        </Button>
      )}
      {admin && (listed || hidden) && (
        <Button
          className="su-page-action"
          disabled={hide.pending}
          onClick={() => void moderate(!hidden)}
        >
          {hidden ? 'Put back in library' : 'Hide from library'}
        </Button>
      )}
      <ReportDialog
        kind={kind}
        appId={appId}
        name={name}
        open={reporting}
        onOpenChange={setReporting}
      />
    </>
  )
}
