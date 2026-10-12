import type { CSSProperties, ElementType, ReactNode } from 'react'
import { color, font, space, weight } from '../../design/tokens'
import type { ChapterTone } from './chapterBandColor'
import { CHAPTER_BAND_COLOR } from './chapterBandColor'
import type { SpeckleGrain } from './Speckle'
import { Speckle } from './Speckle'
import { USER_MADE_HATCH } from './userMadeHatch'

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
 * The band is full-bleed by default (`layout="bleed"`): it fills its
 * container, and as a `PageShell`'s first child it also cancels the shell's
 * gutters, out to the shell's edges and up to its top, so the band meets the
 * masthead the way it does on the SRD. Anywhere deeper in the shell it only
 * fills its container. `layout="inset"` keeps even a leading band inside the
 * shell's gutters. `measure` caps the inner row so the
 * notch lines up with the column of content under it. The notch's bottom edge
 * IS the band's bottom edge, and it is painted in the page ground
 * (`--color-wk-bg`), so the title reads as cut out of the band rather than
 * stuck onto it.
 *
 * `aside` sits at the right of the same row, on the band, bottom-aligned with
 * the notch (a sheet's Read | Edit). Below `sm` it stacks above the notch,
 * where the band has room for it. `asideAt="notch"` instead keeps it on the
 * notch's row at every width, at the row's far end and after the title in
 * reading order as in the DOM (an entity's type stamps, refit B4); when a long
 * name leaves no room there it wraps above the notch, still at the end, and
 * the notch stays on the band's foot.
 *
 * ## Colour map
 *
 * `tone` is the book's colour map (ruleset, "The source"): `rules` is the
 * rules-blue band of Contents, Core Rules, Salvaging, Guides and Keywords;
 * `pilot`, `mech`, `crawler` and `denizen` are the four chapters. `ink` is the
 * dark band of a page that is the player's own (ITUN's Shelves, board S1): it
 * wears paper flecks instead of ink speckle (ruleset §3.5). Content in `aside`
 * and `eyebrow` is ink on `rules`, `pilot`, `mech` and `crawler`; the `denizen`
 * band is navy and the `ink` band ink, and both carry paper text — the caller
 * dresses it. A page that wants paper text on the crawler pink passes `fill`
 * the deeper `crawlerBand`, which carries it (the book's crawler pink carries
 * neither ink nor paper at 4.5 : 1).
 *
 * ## User-made
 *
 * A full page a player made that could pass for the book (a shared mech
 * pattern) sets `userMade` (ruleset §3.9): the band is **hatched** in ink over
 * its chapter colour (`USER_MADE_HATCH`, a hard-stop pattern) and the notched
 * title is framed in dashes. Canon pages never set it.
 *
 * ## The link-preview scale
 *
 * `scale="og"` sets the band at the fixed size of a 1200 × 630 link preview
 * (`OgCard`, issue 1280): the eyebrow at the top, the notch at the foot, the
 * whole band filling the height it is given, with nothing responsive about it.
 * A preview is a picture drawn at one size, so its padding is the card's, not
 * the page's. `fill` and `grain` let a preview wear an entity's own tone (a
 * tech-level blue, the adversary rust-brown, the ink of a thing you do), and
 * `titleSize` fits a long name to the notch.
 */

export type { ChapterTone } from './chapterBandColor'

export type ChapterBandProps = {
  /** The page title. */
  children: ReactNode
  /** Which chapter of the book the page belongs to. Defaults to `rules`. */
  tone?: ChapterTone
  /** The heading element. Defaults to `h1`: the band is the page's title. */
  as?: ElementType
  /**
   * `bleed` (default): full-bleed, cancelling a `PageShell`'s gutters when it
   * is the shell's first child. `inset`: inside its container's box.
   */
  layout?: 'bleed' | 'inset'
  /** Right-hand content on the band, bottom-aligned with the notch. */
  aside?: ReactNode
  /**
   * Where `aside` sits: `end` (default), at the band's far end from `sm` and
   * above the notch on a phone; `notch`, on the notch's row at every width
   * (at its far end, wrapping above the notch when a long name fills it).
   */
  asideAt?: 'end' | 'notch'
  /**
   * The inner row's max inline size — the width of the content column under
   * the band, so the notch starts where the text does. Unset, the row spans
   * the band.
   */
  measure?: string
  /** For a region that names itself by the title (`aria-labelledby`). */
  id?: string
  /**
   * Content on the band ABOVE the title row, left-aligned with the notch: a
   * breadcrumb, or a page's stamps when they lead the title rather than trail
   * it.
   */
  eyebrow?: ReactNode
  /**
   * USER-MADE (ruleset §3.9): a hatched band and a dashed frame around the
   * notched title. For a player's page that could pass for the book.
   */
  userMade?: boolean
  /**
   * The band colour, for a tone outside the chapter map (an entity's own tone
   * on a link preview). Overrides `tone`'s colour.
   */
  fill?: string
  /** The speckle: `ink` grain on a colour band, `paper` flecks on ink (default follows `tone`). */
  grain?: SpeckleGrain
  /** `page` (default) or `og`, the fixed 1200 × 630 link-preview scale. */
  scale?: 'page' | 'og'
  /** The notched title's font size, when the scale's own does not fit the name. */
  titleSize?: string
}

const ROOT = {
  isolation: 'isolate',
  position: 'relative',
} satisfies CSSProperties

// A bleed band's width is the stylesheet's (`.su-chapter-band[data-layout]`):
// leading a page shell it widens by the shell's gutters, which a style object
// cannot read per breakpoint.
const INSET = { width: '100%' } satisfies CSSProperties

// The user-made notch: the same cut-out, framed in dashes on three sides — the
// fourth is the band's foot, which the notch sits flush on.
// Longhands only, so no side's shorthand can reset another's.
// At the og scale the dash is 4px: a 1.5px dash on a 1200px card is a dotted
// hairline once Discord draws it at 400px, and it is one of the user-made cues.
const DASH = 'var(--bw-chrome)'
const OG_DASH = '4px'
const userMadeTitle = (dash: string) =>
  ({
    borderBottomWidth: 0,
    borderLeftColor: color.ink,
    borderLeftStyle: 'dashed',
    borderLeftWidth: dash,
    borderRightColor: color.ink,
    borderRightStyle: 'dashed',
    borderRightWidth: dash,
    borderTopColor: color.ink,
    borderTopStyle: 'dashed',
    borderTopWidth: dash,
  }) satisfies CSSProperties

const EYEBROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  marginInline: 'auto',
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
  layout = 'bleed',
  aside,
  asideAt = 'end',
  measure,
  id,
  eyebrow,
  userMade = false,
  fill,
  grain,
  scale = 'page',
  titleSize,
}: ChapterBandProps) {
  // A link preview is a picture at one size: it never bleeds.
  const bleed = layout === 'bleed' && scale === 'page'
  const titleStyle = userMade
    ? { ...TITLE, ...userMadeTitle(scale === 'og' ? OG_DASH : DASH) }
    : TITLE
  return (
    <div
      className="su-chapter-band"
      data-user-made={userMade || undefined}
      data-scale={scale === 'og' ? 'og' : undefined}
      data-layout={bleed ? 'bleed' : undefined}
      data-aside={aside && asideAt === 'notch' ? 'notch' : undefined}
      style={{
        ...ROOT,
        ...(bleed ? {} : INSET),
        backgroundColor: fill ?? CHAPTER_BAND_COLOR[tone],
        ...(userMade ? { backgroundImage: USER_MADE_HATCH } : {}),
      }}
    >
      <Speckle grain={grain ?? (tone === 'ink' ? 'paper' : 'ink')} />
      {eyebrow && (
        <div
          className="su-chapter-band__eyebrow"
          style={{
            ...EYEBROW,
            ...(measure ? { maxWidth: measure } : {}),
            // In the og band's column flexbox an auto margin would shrink the
            // eyebrow to its content and centre it.
            ...(scale === 'og' ? { marginInline: 0 } : {}),
          }}
        >
          {eyebrow}
        </div>
      )}
      <div className="su-chapter-band__row" style={measure ? { maxWidth: measure } : undefined}>
        <Tag
          id={id}
          className="su-chapter-band__title"
          style={titleSize ? { ...titleStyle, fontSize: titleSize } : titleStyle}
        >
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
