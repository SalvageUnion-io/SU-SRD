/**
 * RunningBriefing — the running encounter's briefing in the Mediator's side
 * column (ADR-059 §5): what the Pilots see, as the Mediator wrote it, and
 * Tell the table, which sends it to every player as an alert
 * (`proposals.broadcast`). Nothing reaches the players until it is pressed.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, SlabSection, toast, tokens } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'

const PROSE = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  lineHeight: 1.45,
  margin: 0,
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-line',
} satisfies CSSProperties

export function RunningBriefing({
  briefing,
  canWrite,
  onTell,
}: {
  briefing: string
  canWrite: boolean
  /** Resolves once sent; rejects with the server's refusal (already explained). */
  onTell: (message: string) => Promise<void>
}) {
  const [telling, setTelling] = useState(false)
  const tell = () => {
    setTelling(true)
    void onTell(briefing)
      .then(() => toast.success(mediatorCopy('briefingSent')))
      // The caller has already said why it failed.
      .catch(() => undefined)
      .finally(() => setTelling(false))
  }
  return (
    <SlabSection
      as="h2"
      id="mediate-briefing"
      title={mediatorCopy('briefing')}
      actions={
        <Button size="mini" disabled={!canWrite || telling} onClick={tell}>
          {mediatorCopy('tellTheTable')}
        </Button>
      }
    >
      <p style={PROSE}>{briefing}</p>
    </SlabSection>
  )
}
