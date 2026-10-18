import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useContext, useId } from 'react'
import { foregroundOn } from '../../design/contrast'
import { color, font, space, weight } from '../../design/tokens'
import { ChapterBandTrail } from './ChapterBandTrail'
import type { ChapterTone } from './chapterBandColor'
import { CHAPTER_BAND_COLOR } from './chapterBandColor'
import type { SpeckleGrain } from './Speckle'
import { Speckle } from './Speckle'
import { BAND_KEY_ATTRIBUTE, unionBarMatchCss } from './unionBarMatch'
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
 * and the band's foreground: an ability's level numeral, where its Row sets
 * it. Nothing else goes there.
 *
 * `aside` sits at the right of the same row, on the band, bottom-aligned with
 * the notch. Below `sm` it stacks above the notch, where the band has room
 * for it. A show page passes `asideAt="notch"` (EDL E20: nothing above
 * a show page's title): its stamps and controls are one cluster beside the
 * title from `sm`, its last line on the title's baseline (a wrap grows up the
 * band) and after it in reading order as in
 * the DOM, each child of `aside` a right-aligned line that wraps; on a phone
 * the cluster follows the title, below the band on the page ground. The
 * notch stays on the band's foot either way.
 *
 * A page whose aside is its action buttons (the Cantina's Hangar and Game
 * pages) passes `asideAt="controls"`: each control is its own item on the
 * title's line, right-aligned on the band's foot beside the name, and the
 * ones that do not fit there wrap onto lines ABOVE it, right-aligned, into
 * the band's top room before they grow the band (owner's rule, 2026-10-17).
 * Pass the controls as a fragment: a wrapper would wrap as one piece.
 *
 * `action` is a show page's one button ("Build With This"), after the cluster
 * from `sm` and on its last line. On a phone it is chip-sized and always
 * shares the title's line: right of the title, centred on the notch, the title
 * wrapping in the room it leaves.
 *
 * A band that leads the page (a `PageShell`'s first child) also colours the
 * Union bar above it: the bar takes its colour, foreground and grain
 * (`unionBarMatch.ts`), so the site header and the band are one colour. A
 * front page (the SRD's home, Build's `/build`) sets `matchBar={false}`
 * and keeps the bar it has. The app's bar never matches: it wears its area's
 * colour on every route (`unionBarMatch.ts`).
 *
 * The page's breadcrumb trail (`ChapterBandTrail`, which a site's layout
 * provides) is the notch's kicker on a page band, at every width: a line of
 * small caps on the cut-out above the name (`SRD//CHASSIS//`), the cut-out
 * one plate around both (owner's rule, 2026-10-16).
 *
 * `corner` sits in the band's top-right corner, above the title row, at every
 * width: a page's own controls where they are not the entity's stamps (an
 * The Cantina sheet's Read | Edit, Share and "⋯", the Starter Set's "Make a copy").
 *
 * ## Colour map
 *
 * `tone` is the book's colour map (ruleset, "The source"): `rules` is the
 * rules-blue band of Contents, Core Rules, Salvaging, Guides and Keywords;
 * `pilot`, `mech`, `crawler` and `denizen` are the four chapters. `ink` is the
 * dark band of a page that is the player's own (Build's Shelves, board S1): it
 * wears paper flecks instead of ink speckle (ruleset §3.5). `build` and `play`
 * are the app's two areas' own bands: the Training Bay's pilot orange and the
 * Cantina's deep crawler pink. Content in `aside` and `eyebrow` is ink on
 * `rules`, `pilot`, `mech`, `crawler` and `build`; the `denizen` band is navy,
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
   * page's level numeral, as its Row sets it left of its name.
   */
  lead?: ReactNode
  /** Right-hand content on the band, bottom-aligned with the notch. */
  aside?: ReactNode
  /**
   * Where `aside` sits: `end` (default), at the band's far end from `sm` and
   * above the notch on a phone; `notch`, a show page's cluster beside the
   * title from `sm` (each child a right-aligned line) and below it on a phone;
   * `controls`, a page's action buttons, each beside the title on the band's
   * foot while it fits and wrapping upward over the name when it does not.
   */
  asideAt?: 'end' | 'notch' | 'controls'
  /**
   * With `asideAt="notch"`: the page's action, ending the cluster from `sm`
   * and on the band beside the title, chip-sized, on a phone.
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
   * Defaults to `true`; a front page passes `false` to keep the ink bar.
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
  fontFamily: font.cond,
  fontWeight: weight.extrabold,
  lineHeight: 0.92,
  margin: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  textTransform: 'uppercase',
} satisfies CSSProperties

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
  const title = (
    <Tag
      id={id}
      className="su-chapter-band__title"
      style={titleSize ? { ...titleStyle, fontSize: titleSize } : titleStyle}
    >
      {children}
    </Tag>
  )
  const notch = trail ? (
    <div className="su-chapter-band__plate" style={dashes ? { ...PLATE, ...dashes } : PLATE}>
      <div className="su-chapter-band__trail">{trail}</div>
      {title}
    </div>
  ) : (
    title
  )
  return (
    <div
      className="su-chapter-band"
      data-user-made={userMade || undefined}
      data-scale={scale === 'og' ? 'og' : undefined}
      data-layout={bleed ? 'bleed' : undefined}
      data-measured={measure ? '' : undefined}
      data-aside={aside && asideAt !== 'end' ? asideAt : undefined}
      data-action={action ? '' : undefined}
      {...(bleed ? { [BAND_KEY_ATTRIBUTE]: key } : {})}
      style={{
        ...ROOT,
        ...(bleed ? {} : INSET),
        backgroundColor: band,
        ...(userMade ? { backgroundImage: USER_MADE_HATCH } : {}),
      }}
    >
      {bleed && matchBar && (
        <style>{unionBarMatchCss(key, band, foregroundOn(band, 'ink'), speckle)}</style>
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
      <div className="su-chapter-band__row" style={measure ? { maxWidth: measure } : undefined}>
        {lead ? (
          <div className="su-chapter-band__heading">
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
            style={asideAt === 'controls' ? undefined : ASIDE}
          >
            {aside}
          </div>
        )}
        {action && <div className="su-chapter-band__action">{action}</div>}
      </div>
    </div>
  )
}
