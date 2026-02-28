import { DowntimeGuideView } from '../games/downtime/DowntimeGuideView'
import type { CrawlerRow, DowntimeRecordRow } from '../../types/common'

type PilotDowntimeTabProps = {
  pilotId?: string
  mechId?: string
  crawlerId?: string
  crawler?: CrawlerRow | null
  activeDowntime?: DowntimeRecordRow | null
  headerBgColor?: string
}

export function PilotDowntimeTab({
  pilotId,
  mechId,
  crawlerId,
  crawler,
  activeDowntime,
}: PilotDowntimeTabProps) {
  // Need all props to render the step flow
  if (!pilotId || !mechId || !crawlerId || !crawler || !activeDowntime) {
    return null
  }

  return (
    <DowntimeGuideView
      mode="player"
      pilotId={pilotId}
      mechId={mechId}
      crawlerId={crawlerId}
      crawler={crawler}
      activeDowntime={activeDowntime}
      compact
    />
  )
}
