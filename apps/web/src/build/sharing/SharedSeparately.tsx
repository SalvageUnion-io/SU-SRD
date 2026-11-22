/**
 * SharedSeparately — a pilot's Share dialog says what the share leaves out (r4
 * E18): the mech they fly and the crawler they crew are sheets of their own,
 * each shared from its own page, and read "Not shared" on the pilot's public
 * page until they are. It names and links each, so the next dialog is a press
 * away. A pilot with neither says nothing.
 *
 * While the pilot is Public, one press shares the rest of the crew too (r5
 * C15): "Also share Old Dobbin and Tenacity" makes each one not yet shared
 * Public, as its own dialog would.
 */

import type { CSSProperties } from 'react'
import { FieldError } from '../../components/app'
import { Button, InlineRef, Text, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useSharingAct, useSheetIsPublic } from '../../lib/sharing/reads'
import { buildSharingCopy } from '../../messages/build-sharing'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'

const LIST = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${tokens.space[4]} ${tokens.space[16]}`,
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** The note, its links, then the one press that shares them all. */
const SECTION = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

export function SharedSeparately({
  pilotId,
  gameId = null,
}: {
  pilotId: string
  /** The Game the crew is in, or null on the shelf: whose room shares them. */
  gameId?: string | null
}) {
  const mech = useUnits((s) => {
    const link = s.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === pilotId)
    return link ? s.mechs.find((m) => m.id === link.from.id) : undefined
  })
  const crawler = useUnits((s) => {
    const link = s.softLinks.find((l) => l.type === 'pilot-to-crawler' && l.from.id === pilotId)
    return link ? s.crawlers.find((c) => c.id === link.to.id) : undefined
  })
  const { status } = useSync()
  const pilotPublic = useSheetIsPublic(pilotId, gameId)
  const mechPublic = useSheetIsPublic(mech?.id ?? '', gameId)
  const crawlerPublic = useSheetIsPublic(crawler?.id ?? '', gameId)
  const setPublic = useSharingAct<{ kind: string; appId: string; isPublic: boolean }>(
    'publicSheet.setPublic',
    gameId
  )
  // The crew still unshared, shared as the pilot is: one write each.
  const rest = [
    ...(mech && mechPublic === false ? [{ kind: 'mech', id: mech.id, name: mech.name }] : []),
    ...(crawler && crawlerPublic === false
      ? [{ kind: 'crawler', id: crawler.id, name: crawler.name }]
      : []),
  ]
  const shareRest = useServerAction(
    async () => {
      for (const unit of rest) await setPublic({ kind: unit.kind, appId: unit.id, isPublic: true })
    },
    { failure: buildSharingCopy('shareNotSaved') }
  )
  if (!mech && !crawler) return null
  const [first, second] = rest
  const said = mech
    ? crawler
      ? buildSharingCopy('mechAndCrawlerSeparate')
      : buildSharingCopy('mechSeparate')
    : buildSharingCopy('crawlerSeparate')
  return (
    <section aria-label={buildSharingCopy('sharedSeparately')} style={SECTION}>
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
      {status === 'live' && pilotPublic === true && first !== undefined && (
        <Button size="compact" disabled={shareRest.pending} onClick={() => void shareRest.run()}>
          {second === undefined
            ? buildSharingCopy('alsoShare', { names: first.name })
            : buildSharingCopy('alsoShare', {
                names: buildSharingCopy('andName', { first: first.name, second: second.name }),
              })}
        </Button>
      )}
      {shareRest.error !== null && <FieldError spaceAbove={8}>{shareRest.error}</FieldError>}
    </section>
  )
}
