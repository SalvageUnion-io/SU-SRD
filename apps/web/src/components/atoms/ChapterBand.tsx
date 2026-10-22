import type { CSSProperties, ElementType, ReactNode } from 'react'
import { isValidElement, useContext, useId, useRef } from 'react'
import { foregroundOn } from '../../design/contrast'
import { color, font, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { Tagline } from '../Tagline'
import { ChapterBandTrail } from './ChapterBandTrail'
import { capsLabel } from './capsLabel'
import type { ChapterTone } from './chapterBandColor'
import { CHAPTER_BAND_COLOR } from './chapterBandColor'
import { ChipOverflowRow } from './chipOverflow'
import type { SpeckleGrain } from './Speckle'
import { Speckle } from './Speckle'
import { BAND_KEY_ATTRIBUTE, footerMatchCss, unionBarMatchCss } from './unionBarMatch'
import { useChipFill } from './useChipFill'
import { USER_MADE_HATCH } from './userMadeHatch'

/**
 * ChapterBand — the page title as the Workshop Manual sets it (ruleset, "The
 * source": the chapter band). A band in the section colour across the top of
 * the page, ink speckle behind it, and the title notched into the band's foot
 * on a cut-out of the page ground, **in ink**. Never a white knockout: paper on
 * pilot orange is 2.4 : 1.
 *
 * The band is the page's one `h1`; every section head below it is a `Slab`
 * (hard rule R1).
 *
 * ## Layout
 *
 * The band is full-bleed: it fills its
 * container, and as a `PageShell`'s first child it also cancels the shell's
 * gutters, out to the shell's edges and up to its top, so the band meets the
 * masthead the way it does on the SRD. Anywhere deeper in the shell it only
 * fills its container. `measure` caps the inner row so the
 * notch lines up with the column of content under it. The notch's bottom edge
 * IS the band's bottom edge, and it is painted in the page ground
 * (`--color-wk-bg`), so the title reads as cut out of the band rather than
 * stuck onto it.
 *
 * `lead` sits on the band LEFT of the notch, on its foot, in the title's type
 * and the band's foreground: an ability's level numeral, where its Compact sets
 * it. Nothing else goes there.
 *
 * `aside` sits at the right of the same row, on the band, bottom-aligned with
 * the notch. Below `sm` it stacks above the notch, where the band has room
 * for it. A show page passes `asideAt="notch"`, a page whose aside is its
 * controls (an index's search and filters, the app's Training Bay and Game
 * pages) `asideAt="controls"`: both fill the title's line from the band's
 * bottom right (ruleset §4.7, the head's bottom-right fill, `chipFill.ts`).
 * Every stamp and control is its own item: the last (the cost, the action)
 * takes the corner on the title's line, the earlier ones fill that line
 * leftward, and only what overfills it rises in lines above the title, each
 * from the right, into the band's top room before they grow the band. An
 * index's search is a line of its own on a phone, on top. The notch stays on
 * the band's foot. Pass the controls as a fragment or a strip that draws no
 * box (`.su-rail`): a wrapper would wrap as one piece.
 *
 * `action` is a show page's one button ("Build With This"), the cluster's
 * last item: the band's bottom-right corner.
 *
 * A band that leads the page (a `PageShell`'s first child) also colours the
 * Union bar above it and the site footer below: both take its colour, foreground and grain
 * (`unionBarMatch.ts`), so the site header and the band are one colour, in
 * every mode and on every page, front pages included.
 *
 * The page's breadcrumb trail (`ChapterBandTrail`, which a site's layout
 * provides) is the notch's kicker on a page band, at every width: a line of
 * small caps on the cut-out above the name (`SRD//CHASSIS//`), the cut-out
 * one plate around both.
 *
 * `corner` sits in the band's top-right corner, above the title row, at every
 * width: a page's own controls where they are not the entity's stamps (an
 * the app sheet's Read | Edit, Share and "⋯", the Starter Set's "Make a copy").
 *
 * ## Colour map
 *
 * `tone` is the book's colour map (ruleset, "The source"): `rules` is the
 * rules-blue band of Contents, Core Rules, Salvaging, Guides and Keywords;
 * `pilot`, `mech`, `crawler` and `adversary` (Denizens' brown) are the four
 * chapters; `denizen` is the navy of the NPC designer and Play's Scene. `ink` is the
 * dark band of a page that is the player's own (Build's Shelves): it
 * wears paper flecks instead of ink speckle (ruleset §3.5). `build` and `play`
 * are the app's two areas' own bands: the Training Bay's pilot orange and the
 * Cantina's deep crawler pink. Content in `aside` and `eyebrow` is ink on
 * `rules`, `pilot`, `mech`, `crawler` and `build`; the `adversary` brown and the `denizen` navy,
 * the `play` band deep pink and the `ink` band ink, and all three carry paper
 * text — the caller dresses it. A page that wants paper text on the crawler pink passes `fill`
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
 * (`OgCard`): the eyebrow at the top, the notch at the foot, the
 * whole band filling the height it is given, with nothing responsive about it.
 * A preview is a picture drawn at one size, so its padding is the card's, not
 * the page's. `fill` and `grain` let a preview wear an entity's own tone (a
 * tech-level blue, the adversary rust-brown, the ink of a thing you do), and
 * `titleSize` fits a long name to the notch.
 */

export type ChapterBandProps = {
  /** The page title. */
  children: ReactNode
  /** Which chapter of the book the page belongs to. Defaults to `rules`. */
  tone?: ChapterTone
  /** The heading element. Defaults to `h1`: the band is the page's title. */
  as?: ElementType
  /**
   * Left of the notch, on the band's foot, in the title's type: an ability
   * page's level numeral, as its Compact sets it left of its name.
   */
  lead?: ReactNode
  /** Right-hand content on the band, bottom-aligned with the notch. */
  aside?: ReactNode
  /**
   * Where `aside` sits: `end` (default), at the band's far end from `sm` and
   * above the notch on a phone; `notch` (a show page's stamps) and `controls`
   * (a page's controls), filling the title's line from the band's bottom
   * right, the overflow rising over the title (ruleset §4.7).
   */
  asideAt?: 'end' | 'notch' | 'controls'
  /**
   * With `asideAt="notch"`: the page's action, ending the cluster in the
   * band's bottom-right corner (chip-sized on a phone).
   */
  action?: ReactNode
  /** Controls in the band's top-right corner, above the title row. */
  corner?: ReactNode
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
   * front page's kicker. It stands in for the layout's trail. Never a show page's stamps or
   * controls: those are its `aside` (EDL E20).
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
  /**
   * Whether a page band colours the Union bar while it leads the page.
   * Defaults to `true`; only a band that never leads a page (a dialog's) passes `false`.
   */
  matchBar?: boolean
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

// Its padding is the stylesheet's (`.su-chapter-band__corner`): it changes at `sm`.
const CORNER = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  justifyContent: 'flex-end',
  marginInline: 'auto',
} satisfies CSSProperties

const EYEBROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  marginInline: 'auto',
} satisfies CSSProperties

// `align-items` is the stylesheet's: a show page's cluster (`asideAt="notch"`)
// changes it at `sm`.
const ASIDE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties

// The notch: the page ground, ink condensed caps, flush with the band's foot.
// Size and padding change at `sm`, so they are `.su-chapter-band__title`'s.
const TITLE = {
  backgroundColor: color.wkBg,
  color: color.ink,
  fontWeight: weight.extrabold,
  lineHeight: 0.92,
  margin: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
} satisfies CSSProperties
/** The notch's caps; its tracking stays the face's own, as the title has always set. */
const TITLE_CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

// The title of a band whose aside is controls: its line's free room is on its
// right, so the controls beside it sit at the band's right edge.
const BESIDE_CONTROLS = { margin: '0 auto 0 0' } satisfies CSSProperties

// The plate: the notch's cut-out around the trail and the title, so the two
// read as one label at the wider one's width. Its padding is the parts'.
const PLATE = {
  backgroundColor: color.wkBg,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '100%',
  minWidth: 0,
} satisfies CSSProperties

// The lead: the notch's type, on the band, its foot on the band's foot.
const LEAD = {
  flex: 'none',
  fontFamily: font.cond,
  fontWeight: weight.extrabold,
  lineHeight: 0.92,
} satisfies CSSProperties

export function ChapterBand({
  children,
  tone = 'rules',
  as: Tag = 'h1',
  lead,
  aside,
  asideAt = 'end',
  action,
  corner,
  measure,
  id,
  eyebrow,
  userMade = false,
  fill,
  grain,
  scale = 'page',
  titleSize,
  matchBar = true,
}: ChapterBandProps) {
  // A link preview is a picture at one size: it never bleeds.
  const bleed = scale === 'page'
  const context = useContext(ChapterBandTrail)
  // A page band carries the layout's trail, unless it brings its own eyebrow.
  const trail = bleed && !eyebrow ? context : null
  const dashes = userMade ? userMadeTitle(scale === 'og' ? OG_DASH : DASH) : undefined
  // With a trail the dashes frame the plate, around both.
  const titleStyle = {
    ...TITLE,
    ...(dashes && !trail ? dashes : {}),
    // Beside controls the title holds the left of its line; they keep the right.
    ...(aside && asideAt === 'controls' ? BESIDE_CONTROLS : {}),
  }
  const band = fill ?? CHAPTER_BAND_COLOR[tone]
  const speckle = grain ?? (tone === 'ink' ? 'paper' : 'ink')
  // The key the Union bar's rule matches this band by (`unionBarMatch.ts`),
  // in the characters an attribute selector takes unescaped.
  const key = useId().replace(/[^\w-]/g, '')
  // A show page's stamps or a page's controls fill the title's line from the
  // band's bottom right (`chipFill.ts`); a quote (the front door's) is no
  // chips, and keeps its place beside the title.
  const quote = isValidElement(aside) && (aside.type === 'figure' || aside.type === Tagline)
  const fills = scale === 'page' && asideAt !== 'end' && !quote && Boolean(aside || action)
  const rowRef = useRef<HTMLDivElement>(null)
  useChipFill(rowRef, fills)
  const lone = !lead
  // The title that is the fill's name holds its line's left, its free room on
  // its right (the fill's `margin-inline-end: auto`, which an inline `margin:
  // 0` beat would set a sheet's name at the right; R40: a name sits at the
  // left).
  const fillName = fills && lone && !trail
  const placed = fillName ? { ...titleStyle, ...BESIDE_CONTROLS } : titleStyle
  const title = (
    <Tag
      id={id}
      data-fill-name={fillName ? '' : undefined}
      className={cn('su-chapter-band__title', TITLE_CAPS)}
      style={titleSize ? { ...placed, fontSize: titleSize } : placed}
    >
      {children}
    </Tag>
  )
  const notch = trail ? (
    <div
      className="su-chapter-band__plate"
      data-fill-name={fills && lone ? '' : undefined}
      style={dashes ? { ...PLATE, ...dashes } : PLATE}
    >
      <div className="su-chapter-band__trail">{trail}</div>
      {title}
    </div>
  ) : (
    title
  )
  const root = (
    <div
      className="su-chapter-band"
      data-chip-overflow-owner={fills ? '' : undefined}
      data-user-made={userMade || undefined}
      data-scale={scale === 'og' ? 'og' : undefined}
      data-layout={bleed ? 'bleed' : undefined}
      data-measured={measure ? '' : undefined}
      data-aside={aside && asideAt !== 'end' ? asideAt : undefined}
      data-action={action ? '' : undefined}
      // The band is the frame: one that prints paper is an ink ground, and the
      // controls in its aside and eyebrow read it in CSS (chrome K1).
      data-ground={foregroundOn(band, 'ink') === 'paper' ? 'ink' : 'paper'}
      {...(bleed ? { [BAND_KEY_ATTRIBUTE]: key } : {})}
      style={{
        ...ROOT,
        ...(bleed ? {} : INSET),
        backgroundColor: band,
        ...(userMade ? { backgroundImage: USER_MADE_HATCH } : {}),
      }}
    >
      {bleed && matchBar && (
        <style>
          {unionBarMatchCss(key, band, foregroundOn(band, 'ink'), speckle) +
            footerMatchCss(key, band, foregroundOn(band, 'ink'), speckle)}
        </style>
      )}
      <Speckle grain={speckle} />
      {corner && (
        <div
          className="su-chapter-band__corner"
          style={measure ? { ...CORNER, maxWidth: measure } : CORNER}
        >
          {corner}
        </div>
      )}
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
      <div
        ref={rowRef}
        className="su-chapter-band__row"
        data-chip-fill={fills ? '' : undefined}
        style={measure ? { maxWidth: measure } : undefined}
      >
        {lead ? (
          <div className="su-chapter-band__heading" data-fill-name={fills ? '' : undefined}>
            <span
              className="su-chapter-band__lead"
              style={{
                ...LEAD,
                color: foregroundOn(band, 'ink') === 'ink' ? color.ink : color.paper,
              }}
            >
              {lead}
            </span>
            {notch}
          </div>
        ) : (
          notch
        )}
        {aside && (
          // As controls the aside is `display: contents` (the stylesheet's), so
          // each control is an item of the title's row.
          <div
            className="su-chapter-band__aside"
            style={fills || asideAt === 'controls' ? undefined : ASIDE}
          >
            {aside}
          </div>
        )}
        {action && <div className="su-chapter-band__action">{action}</div>}
      </div>
    </div>
  )
  if (!fills) return root
  // What of its stamps does not fit beside the title: the page's first row,
  // under the band (C2b). A controls band on a phone is laid by CSS alone,
  // so nothing goes there.
  return (
    <>
      {root}
      <ChipOverflowRow
        className="su-chapter-band__overflow"
        style={measure ? { maxWidth: measure } : undefined}
      />
    </>
  )
}
