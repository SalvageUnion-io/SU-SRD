/**
 * SharedSeparately — a pilot's share is the pilot's alone (r4 E18): the mech
 * they fly and the crawler they crew are sheets of their own, and read
 * "Mech · not shared" on the pilot's public page until they are.
 *
 * While the pilot is Public, one press shares the rest of the crew too (r5
 * C15): "Also share Old Dobbin and Tenacity" makes each one not yet shared
 * Public, as its own dialog would. It is the one way the dialog offers (r7
 * G9): the paragraph and the two links that said the same went. With nothing
 * left to share, it says nothing.
 */

import type { CSSProperties } from 'react'
import { FieldError } from '../../components/app'
import { Button, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useSharingAct, useSheetIsPublic } from '../../lib/sharing/reads'
import { buildSharingCopy } from '../../messages/build-sharing'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'

/** The one press that shares them all, and what it says if it fails. */
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
  const [first, second] = rest
  if (status !== 'live' || pilotPublic !== true || first === undefined) return null
  return (
    <section aria-label={buildSharingCopy('sharedSeparately')} style={SECTION}>
      <Button size="compact" disabled={shareRest.pending} onClick={() => void shareRest.run()}>
        {second === undefined
          ? buildSharingCopy('alsoShare', { names: first.name })
          : buildSharingCopy('alsoShare', {
              names: buildSharingCopy('andName', { first: first.name, second: second.name }),
            })}
      </Button>
      {shareRest.error !== null && <FieldError spaceAbove={8}>{shareRest.error}</FieldError>}
    </section>
  )
}
