/**
 * CrewPatterns — the patterns crewmates have shared with your Games ("My
 * Game's crew"), under your own on the patterns page.
 *
 * Each opens its pattern page, where the crew reads it and builds from it.
 * Signed out there is no crew, so there is nothing to show — and nothing to
 * ask the server.
 */

import { MechPatternSchema } from 'game-domain/schemas/pattern'
import type { CSSProperties } from 'react'
import { Entity, quotePatternName, SlabSection, tokens } from '../../../components/index'
import { AppLink } from '../../../components/shared/AppLink'
import { asReferencePattern, patternChassis, patternHref } from '../../../lib/patterns/patterns'
import { useCrewPatterns } from '../../../lib/sharing/reads'
import { mechCopy } from '../../../messages/build-mech'
import { useSync } from '../../../replica/syncContext'

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
  const { status } = useSync()
  const shared = useCrewPatterns(status === 'live')

  const rows = (shared ?? []).flatMap((row) => {
    const parsed = MechPatternSchema.safeParse(row.body)
    if (!parsed.success) return []
    const chassis = patternChassis(parsed.data)
    return chassis ? [{ ...row, pattern: parsed.data, chassis }] : []
  })
  if (rows.length === 0) return null

  return (
    <SlabSection id="crew-patterns" title={mechCopy('sharedByYourCrew')}>
      <ul style={LIST}>
        {rows.map(({ appId, pattern, chassis, madeBy, gameName }) => (
          <li key={appId}>
            <AppLink
              href={patternHref(appId)}
              style={LINK}
              aria-label={mechCopy('madeBySharedIn', { name: pattern.name, madeBy, gameName })}
            >
              <Entity
                size="compact"
                entity={chassis}
                pattern={asReferencePattern(pattern)}
                instance={{ title: quotePatternName(pattern.name), userMade: true }}
                lead
              />
            </AppLink>
          </li>
        ))}
      </ul>
    </SlabSection>
  )
}
