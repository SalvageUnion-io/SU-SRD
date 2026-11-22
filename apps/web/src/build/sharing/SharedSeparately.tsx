/**
 * SharedSeparately — a pilot's Share dialog says what the share leaves out (r4
 * E18): the mech they fly and the crawler they crew are sheets of their own,
 * each shared from its own page, and read "Not shared" on the pilot's public
 * page until they are. It names and links each, so the next dialog is a press
 * away. A pilot with neither says nothing.
 */

import type { CSSProperties } from 'react'
import { InlineRef, Text, tokens } from '../../components/index'
import { buildSharingCopy } from '../../messages/build-sharing'
import { useUnits } from '../../replica/units'

const LIST = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${tokens.space[4]} ${tokens.space[16]}`,
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

export function SharedSeparately({ pilotId }: { pilotId: string }) {
  const mech = useUnits((s) => {
    const link = s.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)
    return link ? s.mechs.find((m) => m.id === link.from.id) : undefined
  })
  const crawler = useUnits((s) => {
    const link = s.softLinks.find((l) => l.type === 'pilot-to-crawler' && l.from.id === pilotId)
    return link ? s.crawlers.find((c) => c.id === link.to.id) : undefined
  })
  if (!mech && !crawler) return null
  const said = mech
    ? crawler
      ? buildSharingCopy('mechAndCrawlerSeparate')
      : buildSharingCopy('mechSeparate')
    : buildSharingCopy('crawlerSeparate')
  return (
    <section aria-label={buildSharingCopy('sharedSeparately')}>
      <Text variant="note">{said}</Text>
      <ul style={LIST}>
        {mech && (
          <li>
            <InlineRef href={`/mechs/${mech.id}`}>
              {buildSharingCopy('shareThe', { name: mech.name })}
            </InlineRef>
          </li>
        )}
        {crawler && (
          <li>
            <InlineRef href={`/crawlers/${crawler.id}`}>
              {buildSharingCopy('shareThe', { name: crawler.name })}
            </InlineRef>
          </li>
        )}
      </ul>
    </section>
  )
}
