/**
 * CrewPatterns — the patterns crewmates have shared with your Games (issue 1276:
 * "My Game's crew"), under your own on the patterns page.
 *
 * Each opens its pattern page, where the crew reads it and builds from it.
 * Signed out there is no crew, so there is nothing to show — and nothing to
 * ask the server.
 */

import { ReferenceEntityCard, Slab, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../../convex/_generated/api'
import { useConnection } from '../../../lib/connection/connectionContext'
import { asReferencePattern, patternChassis, patternHref } from '../../../lib/patterns/patterns'
import { MechPatternSchema } from '../../../lib/schemas/pattern'
import { AppLink } from '../../shared/AppLink'

const LIST = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LINK = { color: 'inherit', display: 'block', textDecoration: 'none' } satisfies CSSProperties

export function CrewPatterns() {
  const { mode } = useConnection()
  const shared = useQuery(api.shelf.crewPatterns, mode === 'connected' ? {} : 'skip')

  const rows = (shared ?? []).flatMap((row) => {
    const parsed = MechPatternSchema.safeParse(row.body)
    if (!parsed.success) return []
    const chassis = patternChassis(parsed.data)
    return chassis ? [{ ...row, pattern: parsed.data, chassis }] : []
  })
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="crew-patterns">
      <Slab
        variant="solid"
        id="crew-patterns"
        label="Shared by your crew"
        count={`${rows.length} ${rows.length === 1 ? 'pattern' : 'patterns'}`}
      />
      <ul style={LIST}>
        {rows.map(({ appId, pattern, chassis, madeBy, gameName }) => (
          <li key={appId}>
            <AppLink
              href={patternHref(appId)}
              style={LINK}
              aria-label={`${pattern.name}, made by ${madeBy}, shared in ${gameName}`}
            >
              <ReferenceEntityCard
                data={chassis}
                pattern={asReferencePattern(pattern)}
                size="medium"
                extent="head"
                userMade
                madeBy={madeBy}
                cardClickable
              />
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
