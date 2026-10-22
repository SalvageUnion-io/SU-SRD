import type { CSSProperties, ReactNode } from 'react'
import type { Provenance } from 'salvageunion-reference'
import { citeLine, provenancePrintings } from 'salvageunion-reference'
import { color, fontSize, space, weight } from '../../../design/tokens'
import { cn } from '../../../lib/cn'
import type { Size } from '../../../styles/sizing'
import { capsLabel } from '../../atoms/capsLabel'
import type { CardColors } from './cardChrome'
import type { CardGrain } from './cardGrain'
import { grainClass } from './cardGrain'
import type { CardFootMeta } from './referenceEntityCardTypes'

type EntityCardIdentityFooterProps = {
  /**
   * Where it is printed (`resolveProvenance`): the book, booklet and page, and
   * its REPRINTS (`additionalSources`), cited after the book on the same line,
   * `//` between (`citeLine`): `Workshop Manual · p.65 // … (CR) · p.37`.
   */
  provenance: Provenance | undefined
  /** Write-layer: inline `[label value]` meta pairs (cost / SV) folded into the
   * footer, before the citation. */
  footMeta?: CardFootMeta[]
  /**
   * App-supplied cross-link (The app's "View in the Reference"), the entity
   * surface's `externalLink`. The card passes `undefined` inside a Peek and
   * for a user-made entity.
   */
  externalLink?: ReactNode
  size: Size
  /**
   * USER-MADE credit (ruleset §3.9): "Made by [user]", in the place a page
   * citation takes on a canon card. It replaces the citation: a homebrew card
   * has no page to cite, and the card passes no source with it.
   */
  credit?: string
  /**
   * The head band's colours (`resolveCardColors`): the foot wears the same
   * ground and foreground (ruleset Source 2), so a card and a Peek read as one
   * coloured plate top and bottom. Absent (a head left paper) ⇒ ink type on
   * the card's own paper.
   */
  band?: CardColors
  /** The head band's speckle, worn on the foot's band too. */
  grain?: CardGrain | undefined
}

const PAD_X: Record<Size, string> = { full: space[14], compact: space[12], mini: space[8] }

const TYPE_CAPS = {
  lineHeight: 1,
} satisfies CSSProperties
const TYPE_LABEL = capsLabel()

const truncate = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/**
 * EntityCardIdentityFooter — the card's FOOTER (depth-0 / full cards only), in
 * the head band's colour, grain and foreground (ruleset Source 2): ink-2 type
 * on paper only where the head is paper, with no rule along its top.
 *
 * ONE line, right-aligned, and no kind (E9): every printing, the book first,
 * then each reprint, `//` between (`citeLine`) — "Workshop Manual · p.80 //
 * Salvage Union Starter Set (PH) · p.38". A user-made card puts its `credit`
 * ("Made by alxjrvs") where the citation goes.
 */
const CITE = { display: 'inline-block', overflowWrap: 'break-word' } satisfies CSSProperties

const CUTOUT = {
  backgroundColor: 'var(--color-paper)',
  color: 'var(--color-ink)',
  marginTop: `calc(-1 * ${space[8]})`,
  padding: `${space[4]} ${space[8]} ${space[6]}`,
  textAlign: 'left',
} satisfies CSSProperties

export function EntityCardIdentityFooter({
  provenance,
  footMeta,
  externalLink,
  size,
  credit,
  band,
  grain,
}: EntityCardIdentityFooterProps) {
  const citation = credit ?? (provenance ? citeLine(provenancePrintings(provenance)) : undefined)
  // Foot extras force the footer even without source/page data — they are
  // affordances, not source chrome.
  const hasFootExtras = (footMeta?.length ?? 0) > 0 || !!externalLink

  if (!citation && !hasFootExtras) return null
  const onBand = !!band?.bandColor

  return (
    <div
      // A foot band is text, never chips (hard rule R4): `chip-strips.e2e.ts` reads it.
      data-foot-band=""
      // The head's speckle, on the band only (never on paper, R10).
      data-grain={onBand ? grain : undefined}
      className={cn(onBand && grainClass(grain))}
      style={{
        // No ink rule over a card's foot, a user-made one's too.
        background: band?.bandColor,
        color: onBand ? `var(--color-${band?.onBand})` : color.ink2,
        alignItems: 'baseline',
        display: 'flex',
        fontSize: fontSize.caption,
        gap: space[8],
        justifyContent: 'flex-end',
        marginTop: 'auto',
        padding: `${space[8]} ${PAD_X[size]}`,
        width: '100%',
      }}
    >
      {/* Foot extras — inline meta pairs (cost / SV) folded into the row, then
          the citation on the far right. */}
      {footMeta?.map(({ label, value }, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static per-render list; index disambiguates repeated labels
          key={`${label}-${i}`}
          style={{
            alignItems: 'baseline',
            display: 'inline-flex',
            flexShrink: 0,
            gap: space[4],
          }}
        >
          <span className={TYPE_LABEL} style={TYPE_CAPS}>
            {label}
          </span>
          <span style={{ fontWeight: weight.bold, lineHeight: 1 }}>{value}</span>
        </span>
      ))}
      {/* `contain: inline-size`: a long citation adds nothing to the card's
          min-content, so it WRAPS in the narrow column instead of widening
          the page. The citation is a readout: it never clips, so every page
          number shows. */}
      {citation && (
        <span style={{ contain: 'inline-size', flex: '1 1 0', minWidth: 0, textAlign: 'right' }}>
          {/* On a band the source sits on its own cut-out: the card's paper
              hanging from the band's top edge, ink on it, the head's notch
              mirrored at the foot. */}
          <span style={onBand ? { ...CITE, ...CUTOUT } : CITE}>{citation}</span>
        </span>
      )}
      {externalLink && <span style={{ ...truncate, flexShrink: 0 }}>{externalLink}</span>}
    </div>
  )
}
