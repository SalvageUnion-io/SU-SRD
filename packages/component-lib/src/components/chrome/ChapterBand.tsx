import type { CSSProperties, ElementType, ReactNode } from 'react'
import { color, font, space, weight } from '../../design/tokens'
import { Speckle } from './Speckle'

/**
 * ChapterBand — the page title as the Workshop Manual sets it (ruleset, "The
 * source": the chapter band). A band in the section colour across the top of
 * the page, ink speckle behind it, and the title notched into the band's foot
 * on a cut-out of the page ground, **in ink**. Never a white knockout: paper on
 * pilot orange is 2.4 : 1.
 *
 * It replaced `PageHeading`'s ink-stamp page heading. The band is the page's
 * one `h1`; the quieter rungs below it stay `PageHeading`'s (`subheading`,
 * `section`) and the section dividers are `Slab`.
 *
 * ## Layout
 *
 * The band fills its container's width. Set it as the first child of a
 * full-width region and it is full-bleed; `measure` caps the inner row so the
 * notch lines up with the column of content under it. The notch's bottom edge
 * IS the band's bottom edge, and it is painted in the page ground
 * (`--color-wk-bg`), so the title reads as cut out of the band rather than
 * stuck onto it.
 *
 * `aside` sits at the right of the same row, on the band, bottom-aligned with
 * the notch (an entity's type stamps, a sheet's Read | Edit). Below `sm` it
 * stacks above the notch, where the band has room for it.
 *
 * ## Colour map
 *
 * `tone` is the book's colour map (ruleset, "The source"): `rules` is the
 * rules-blue band of Contents, Core Rules, Salvaging, Guides and Keywords;
 * `pilot`, `mech`, `crawler` and `denizen` are the four chapters. Content in
 * `aside` is ink on every band but `denizen`, whose navy carries paper text —
 * the caller dresses it.
 */

export type ChapterTone = 'rules' | 'pilot' | 'mech' | 'crawler' | 'denizen'

export type ChapterBandProps = {
  /** The page title. */
  children: ReactNode
  /** Which chapter of the book the page belongs to. Defaults to `rules`. */
  tone?: ChapterTone
  /** The heading element. Defaults to `h1`: the band is the page's title. */
  as?: ElementType
  /** Right-hand content on the band, bottom-aligned with the notch. */
  aside?: ReactNode
  /**
   * The inner row's max inline size — the width of the content column under
   * the band, so the notch starts where the text does. Unset, the row spans
   * the band.
   */
  measure?: string
  /** For a region that names itself by the title (`aria-labelledby`). */
  id?: string
}

const BAND: Record<ChapterTone, string> = {
  rules: color.wkLine,
  pilot: color.pilot,
  mech: color.mech,
  crawler: color.crawler,
  denizen: color.denizenBand,
}

const ROOT = {
  isolation: 'isolate',
  position: 'relative',
  width: '100%',
} satisfies CSSProperties

const ASIDE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties

// The notch: the page ground, ink condensed caps, flush with the band's foot.
// Size and padding change at `sm`, so they are `.su-chapter-band__title`'s.
const TITLE = {
  backgroundColor: color.wkBg,
  color: color.ink,
  fontFamily: font.cond,
  fontWeight: weight.extrabold,
  lineHeight: 0.92,
  margin: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  textTransform: 'uppercase',
} satisfies CSSProperties

export function ChapterBand({
  children,
  tone = 'rules',
  as: Tag = 'h1',
  aside,
  measure,
  id,
}: ChapterBandProps) {
  return (
    <div className="su-chapter-band" style={{ ...ROOT, backgroundColor: BAND[tone] }}>
      <Speckle grain="ink" />
      <div className="su-chapter-band__row" style={measure ? { maxWidth: measure } : undefined}>
        <Tag id={id} className="su-chapter-band__title" style={TITLE}>
          {children}
        </Tag>
        {aside && (
          <div className="su-chapter-band__aside" style={ASIDE}>
            {aside}
          </div>
        )}
      </div>
    </div>
  )
}
