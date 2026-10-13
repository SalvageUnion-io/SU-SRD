/**
 * How a form PAINTS its band from the model's tone token (E12): the token as
 * `--color-<tone>`, the foreground that passes contrast on the band actually
 * painted, and the speckle when the surface wears it.
 *
 * The form passes the token: a "have" entity's own tone, an ability's tier
 * tone in a Row, `ink` for any other "do" entity. A condition that is down
 * greys the band, whatever its tone.
 */

import { GREY_HEADER } from '../../components/referenceEntity/card/cardChrome'
import type { CardGrain } from '../../components/referenceEntity/card/cardGrain'
import { textBand } from '../../components/referenceEntity/referenceEntityHelpers'
import { bandCarriesText, foregroundOn } from '../../design/contrast'

export type Paint = {
  background: string
  color: string
  grain?: CardGrain
  /** An ink band (a thing you do): its stamps go inverse. */
  ink: boolean
  /**
   * The name sits on a PAPER chip only where neither ink nor paper reaches
   * 4.5:1 on the band (ruleset §3.8). No tone band is such a band since TL3
   * and Nanite were retoned (ink on TL3 at 4.6:1, paper on Nanite at 4.6:1);
   * a damaged band's grey is measured the same way. Every tone prints the name
   * in the foreground that passes (ink on TL1 at 8.6:1, paper on TL4 at 5.7:1).
   */
  nameOnPaper: boolean
}

/** The name on its paper chip, line by line (`box-decoration-break`). */
export const PAPER_NAME = {
  backgroundColor: 'var(--color-paper)',
  boxDecorationBreak: 'clone',
  color: 'var(--color-ink)',
  padding: '0 var(--space-4)',
  WebkitBoxDecorationBreak: 'clone',
} as const

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
      nameOnPaper: !bandCarriesText(GREY_HEADER),
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
    nameOnPaper: !bandCarriesText(band),
    ...(texture ? { grain: ink ? ('paper' as const) : ('ink' as const) } : {}),
  }
}
