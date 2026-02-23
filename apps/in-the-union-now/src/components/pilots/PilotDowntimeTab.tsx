import { DowntimeGuideView } from '../games/downtime/DowntimeGuideView'
import type { CrawlerRow, DowntimeRecordRow } from '../../types/common'

type PilotDowntimeTabProps = {
  mechId?: string
  crawlerId?: string
  crawler?: CrawlerRow | null
  activeDowntime?: DowntimeRecordRow | null
  headerBgColor?: string
}

export function PilotDowntimeTab({
  mechId,
  crawlerId,
  crawler,
  activeDowntime,
}: PilotDowntimeTabProps) {
  // Need all props to render the step flow
  if (!mechId || !crawlerId || !crawler || !activeDowntime) {
    return null
  }

  return (
    <DowntimeGuideView
      mode="player"
      mechId={mechId}
      crawlerId={crawlerId}
      crawler={crawler}
      activeDowntime={activeDowntime}
      compact
    />
  )
}
