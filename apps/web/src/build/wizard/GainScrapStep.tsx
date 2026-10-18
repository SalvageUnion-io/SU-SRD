import type { CSSProperties } from 'react'
import { MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { Stat, tokens } from '../index'

const rowStyle = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[16],
} satisfies CSSProperties

const briefStyle = {
  alignSelf: 'center',
  color: 'currentcolor',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.625,
  margin: 0,
  maxWidth: '52ch',
} satisfies CSSProperties

/**
 * Step 1 · Gain Scrap (Mech Workshop p.94) — display-only briefing step. You
 * start with 20 Tech 1 Scrap; the whole build debits this one pool, so the
 * SCRAP tracker makes its first appearance here (and rides in the action
 * pill for the rest of the wizard). Nothing to choose — Next always enabled.
 */
export function GainScrapStep() {
  return (
    <div style={rowStyle}>
      <Stat
        orientation="horizontal"
        label="SCRAP"
        value={MECH_CREATION_SCRAP_CAP}
        max={MECH_CREATION_SCRAP_CAP}
      />
      <p style={briefStyle}>
        Every purchase in this workshop — the Chassis, each System, each Module — debits this one
        pool. Whatever is left over banks to your Union Crawler when the build is done.
      </p>
    </div>
  )
}
