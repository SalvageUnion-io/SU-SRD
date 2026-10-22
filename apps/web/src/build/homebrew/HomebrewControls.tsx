/**
 * HomebrewControls — what a shared pattern's own page offers about Homebrew
 * (ADR-059), in its corner beside Make a copy: Report for a signed-in reader
 * who did not make it, and a site admin's Hide or Put back. Nothing while it
 * is not homebrew (not shared by link), so a private page reads as before.
 */

import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Button, toast } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildHomebrewCopy } from '../../messages/build-homebrew'
import { ReportDialog } from './ReportDialog'

type HomebrewControlsProps = { appId: string; name: string }

export function HomebrewControls({ appId, name }: HomebrewControlsProps) {
  const status = useQuery(api.homebrew.status, { appId })
  const setHidden = useMutation(api.homebrew.setHidden)
  const [reporting, setReporting] = useState(false)
  const hide = useServerAction((hidden: boolean) => setHidden({ appId, hidden }), {
    failure: buildHomebrewCopy('didNotSave'),
    toastId: 'homebrew-hide',
  })

  if (status === undefined) return null
  const { listed, hidden, reported, mine, admin } = status

  async function moderate(next: boolean) {
    const result = await hide.run(next)
    if (!result.ok) return
    toast.success(buildHomebrewCopy(next ? 'hidFromHomebrew' : 'putBack', { name }))
  }

  return (
    <>
      {listed && !mine && (
        <Button
          className="su-page-action"
          onClick={() => setReporting(true)}
          aria-label={buildHomebrewCopy('reportName', { name })}
        >
          {reported ? buildHomebrewCopy('reported') : buildHomebrewCopy('report')}
        </Button>
      )}
      {admin && (listed || hidden) && (
        <Button
          className="su-page-action"
          disabled={hide.pending}
          onClick={() => void moderate(!hidden)}
        >
          {hidden ? buildHomebrewCopy('putBackInHomebrew') : buildHomebrewCopy('hideFromHomebrew')}
        </Button>
      )}
      <ReportDialog appId={appId} name={name} open={reporting} onOpenChange={setReporting} />
    </>
  )
}
