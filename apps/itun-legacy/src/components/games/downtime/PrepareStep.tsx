import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from 'suref-react'
import type { CrawlerRow } from '../../../types/common'

type PrepareStepProps = {
  mode: 'player' | 'mediator'
  crawler: CrawlerRow
}

export function PrepareStep({ mode, crawler }: PrepareStepProps) {
  const mechName = useMemo(() => {
    const ref = SalvageUnionReference.get('crawlers', crawler.crawler_ref)
    return ref && 'name' in ref ? (ref.name as string) : (crawler.name ?? 'your crawler')
  }, [crawler.crawler_ref, crawler.name])

  if (mode === 'mediator') {
    return (
      <div className="flex flex-col gap-2">
        <Text variant="default" as="p" className="text-xs text-su-white/60">
          Your Command Bay allows <strong>{crawler.tech_level}</strong> question
          {crawler.tech_level !== 1 ? 's' : ''} about the next destination.
        </Text>
        <Text variant="default" as="p" className="text-xs text-su-white/40">
          Discuss the next salvage run with the group.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Text variant="default" as="p" className="text-xs text-su-white/60">
        Your mech is ready. Discuss your next destination with the group.
      </Text>
      <Text variant="default" as="span" className="text-[10px] text-su-white/40">
        Crawler: {crawler.name ?? mechName}
      </Text>
    </div>
  )
}
