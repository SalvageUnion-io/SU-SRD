/**
 * How a form PAINTS its band from the model's tone token (E12): the token as
 * `--color-<tone>`, the foreground that passes contrast on the band actually
 * painted, and the speckle when the surface wears it.
 *
 * The model already chose the token by kind: a "have" entity's own tone, an
 * ability's tier tone, `ink` for an action. A condition that is down greys the
 * band, whatever its tone.
 */

import { GREY_HEADER } from '../../components/referenceEntity/card/cardChrome'
import type { CardGrain } from '../../components/referenceEntity/card/cardGrain'
import { textBand } from '../../components/referenceEntity/referenceEntityHelpers'
import { foregroundOn } from '../../design/contrast'

export type Paint = {
  background: string
  color: string
  grain?: CardGrain
  /** An ink band (a thing you do): its stamps go inverse. */
  ink: boolean
}

const FOREGROUND = { ink: 'var(--color-ink)', paper: 'var(--color-paper)' } as const

export function paintFor(
  tone: string,
  { down, texture }: { down?: boolean; texture: boolean }
): Paint {
  if (down) {
    return {
      background: GREY_HEADER,
      color: FOREGROUND[foregroundOn(GREY_HEADER, 'ink')],
      ink: false,
    }
  }
  const ink = tone === 'ink'
  // A tone that carries neither foreground at 4.5:1 paints its deeper text
  // band (ruleset §3.8): crawler pink becomes the crawler band.
  const band = textBand(`var(--color-${tone})`) ?? 'var(--color-ink)'
  return {
    background: band,
    color: FOREGROUND[foregroundOn(band, 'paper')],
    ink,
    ...(texture ? { grain: ink ? ('paper' as const) : ('ink' as const) } : {}),
  }
}
