/**
 * How a form PAINTS its band from the model's tone token (E12): the token as
 * `--color-<tone>`, the foreground that passes contrast on the band actually
 * painted, and the speckle when the surface wears it.
 *
 * The form passes the token: a "have" entity's own tone, an ability's tier
 * tone in a Compact, `ink` for any other "do" entity. A damaged entity dulls that
 * band toward grey (`dullBand`): still its colour, at a distance. A destroyed
 * one is grey, whatever its tone.
 */

import type { CSSProperties } from 'react'
import { foregroundOn } from '../../../design/contrast'
import type { Down } from '../../referenceEntity/card/cardChrome'
import { downBand } from '../../referenceEntity/card/cardChrome'
import type { CardGrain } from '../../referenceEntity/card/cardGrain'
import { textBand } from '../../referenceEntity/referenceEntityHelpers'

export type Paint = {
  background: string
  color: string
  grain?: CardGrain
  /** An ink band (a thing you do): its stamps go inverse. */
  ink: boolean
}

const FOREGROUND = { ink: 'var(--color-ink)', paper: 'var(--color-paper)' } as const

/**
 * The frame's colour, the band's (R38): `--su-band` on the frame, read by its
 * border after `--su-compact-frame` (a tree's tier, a pattern's colour). With
 * no band (`initial`), the frame keeps the subtle ink-40 and never inherits an
 * outer frame's band.
 */
export const bandFrame = (band: string | undefined): CSSProperties =>
  ({ '--su-band': band ?? 'initial' }) as CSSProperties

export function paintFor(
  tone: string,
  { down, texture }: { down?: Down; texture: boolean }
): Paint {
  const ink = tone === 'ink'
  // A tone that carries neither foreground at 4.5:1 paints its deeper text
  // band (ruleset §3.8): crawler pink becomes the crawler band.
  const band = textBand(`var(--color-${tone})`) ?? 'var(--color-ink)'
  if (down) {
    const dulled = downBand(band, down)
    return {
      background: dulled,
      color: FOREGROUND[foregroundOn(dulled, 'ink')],
      ink,
    }
  }
  return {
    background: band,
    color: FOREGROUND[foregroundOn(band, 'paper')],
    ink,
    ...(texture ? { grain: ink ? ('paper' as const) : ('ink' as const) } : {}),
  }
}
