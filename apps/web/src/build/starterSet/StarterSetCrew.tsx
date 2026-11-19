/**
 * StarterSetCrew — the Starter Set's pre-generated crew as a signed-out front
 * door shows it (Build's and Play's): the section's Slab, whose crew it is,
 * then the crew as its one Ledger (`StarterCrewLedger`).
 */

import type { CSSProperties } from 'react'
import { Slab, Stack, tokens } from '../../components/index'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { StarterCrewLedger } from './StarterCrewLedger'

const CREDIT = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  margin: 0,
} satisfies CSSProperties

type StarterSetCrewProps = {
  /** The section's id: the pitch's "Meet the Starter crew" jumps to it. */
  id: string
  /** What a visitor can do with a sheet here, after whose crew it is. */
  note: string
}

export function StarterSetCrew({ id, note }: StarterSetCrewProps) {
  return (
    <Stack as="section" gap={12} aria-labelledby={id}>
      <Slab label={buildStarterSetCopy('starterSet2')} id={id} as="h2" />
      <p style={CREDIT}>
        {buildStarterSetCopy('thePreGeneratedCrewOf')} <em>{STARTER_SET_ADVENTURE}</em>
        {buildStarterSetCopy('byPublisher', { publisher: STARTER_SET_PUBLISHER })} {note}
      </p>
      <StarterCrewLedger />
    </Stack>
  )
}
