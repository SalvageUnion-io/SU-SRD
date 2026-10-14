import { color } from '../../design/tokens'
import { textBand } from '../referenceEntity/referenceEntityHelpers'

/**
 * The words and sizes of an `OgCard`: its props, the canvas, and
 * what its unfurl says beside the image — `og:title` (the name),
 * `og:description` (the kicker and byline, never the body) and `theme-color`
 * (the band's tone). A module of its own so a page's `<head>` can read them
 * without the component, and so `OgCard.tsx` exports only the component.
 */

/** The canvas: the size every unfurl draws a "large" card at. */
export const OG_CARD_WIDTH = 1200
export const OG_CARD_HEIGHT = 630

/**
 * One chip, label first, as the page's horizontal `Stat` draws it: `TL | 1`,
 * a bare "Turn Action", a trait `[Burn | 2]`.
 */
export type OgCardStat = { label: string; value?: string }

type OgCardBase = {
  /**
   * The kind, "Chassis", "Pilot · Engineer": printed on the card's foot line
   * before its cite or byline, as a Page's foot names its kind (EDL E9), never
   * above the title (E20).
   */
  kicker: string
  /** The notched title: the thing's name. */
  title: string
  /**
   * The address the foot prints. ITUN prints host and path; the SRD prints the
   * bare path (`/chassis/scrapper`), since its wordmark already names the host
   * (see `ogReferenceAddressFits`).
   */
  address: string
}

export type OgCardProps =
  | (OgCardBase & {
      kind: 'thing'
      /** The band colour: the entity's tone, any CSS colour. */
      tone: string
      /** Its chips in E17's order: action type, facts (TL first), traits. */
      stats: OgCardStat[]
      /** The cost as the book's pointy box prints it, last: "2 EP". */
      cost?: string
      /** The page cite: "Workshop Manual · p.104". */
      cite?: string
    })
  | (OgCardBase & {
      kind: 'do'
      /** An ability's tier tone (any CSS colour); without one, the ink band. */
      tone?: string
      /** The book's tier numeral, for an ability: left of the name on the band. */
      tier?: string
      /** Its chips in E17's order: action type, facts, traits. */
      stats: OgCardStat[]
      /** The cost as the book's pointy box prints it, last: "2 AP". */
      cost?: string
      /** The rules text, clamped to two lines. */
      rules?: string
      cite?: string
    })
  | (OgCardBase & {
      kind: 'sheet'
      tone: string
      stats: OgCardStat[]
      /** "Rosa's pilot · Reclamation of the Wastes". */
      byline: string
    })
  | (OgCardBase & {
      kind: 'userMade'
      tone: string
      stats: OgCardStat[]
      /** The maker's name; the byline reads "Made by [user]" and nothing else. */
      madeBy: string
      /**
       * Whether the notch prints the name in curly quotes. A pattern is quoted
       * ("TOW RIG", board PV1); an NPC is a person and reads bare. Default true.
       */
      quoted?: boolean
    })
  | (OgCardBase & {
      kind: 'invite'
      tone: string
      /** "Mediated by alxjrvs. …" — what the invite tells its bearer, no more. */
      summary: string
      /** "Link expires 15 Oct · the Mediator lets you in". */
      terms?: string
    })
  | { kind: 'private'; address: string }

export type OgCardKind = OgCardProps['kind']

/** The kinds the SRD renders; every other kind is ITUN's. */
export const REFERENCE_KINDS: ReadonlySet<OgCardKind> = new Set(['thing', 'do'])

/**
 * The band's colour for a card — the entity's tone, an ability's tier tone
 * (as its page band and Discord stripe wear it), the ink of any other thing
 * you do, or the ink-deep of a private card. Also the page's `theme-color`, so
 * Discord's side bar matches the band: see `ogCardThemeColor`. An ability's
 * numeral sits on the band, so a tone that carries no text paints its deeper band
 * (ruleset §3.8), as an entity card's header does: crawler pink → the
 * crawler band.
 */
export function bandColor(props: OgCardProps): string {
  if (props.kind === 'private' || (props.kind === 'do' && !props.tone)) return color.inkDeep
  const tone = props.tone ?? color.inkDeep
  return textBand(tone) ?? tone
}

/**
 * The card's `theme-color`: the band's colour as a literal. A `var(--color-x)`
 * tone resolves to its token, since a `<meta>` cannot read a custom property.
 */
export function ogCardThemeColor(props: OgCardProps): string {
  const band = bandColor(props)
  const variable = band.match(/^var\(--color-([a-z0-9-]+)\)$/)
  if (!variable) return band
  const key = (variable[1] ?? '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  return (color as Record<string, string>)[key] ?? band
}

/**
 * The foot line under the body: the kind, then the cite, the byline or "Made
 * by [user]", as a Page's foot names its kind and its printing.
 */
export function footLineOf(props: OgCardProps): string | undefined {
  if (props.kind === 'private') return bylineOf(props)
  const byline = bylineOf(props)
  return joinLine([props.kicker, byline]) || undefined
}

function joinLine(parts: (string | undefined)[]): string {
  return parts.filter((part) => part && part.length > 0).join(' · ')
}

/** What the card says of where it comes from: the cite, the byline, or "Made by [user]". */
function bylineOf(props: OgCardProps): string | undefined {
  switch (props.kind) {
    case 'thing':
    case 'do':
      return props.cite
    case 'sheet':
      return props.byline
    case 'userMade':
      return `Made by ${props.madeBy}`
    case 'invite':
      return props.terms
    case 'private':
      return PRIVATE_LINE
  }
}

/** The `og:title`: the thing's name, or "Private". */
export function ogCardTitle(props: OgCardProps): string {
  return props.kind === 'private' ? PRIVATE_TITLE : props.title
}

/**
 * The `og:description`: the kicker and the byline, never the body (issue
 * 1280). An invite's summary is its byline: it is what the invite says.
 */
export function ogCardDescription(props: OgCardProps): string {
  if (props.kind === 'private') return PRIVATE_LINE
  const byline = props.kind === 'invite' ? props.summary : bylineOf(props)
  return joinLine([props.kicker, byline])
}

const PRIVATE_TITLE = 'Private'
const PRIVATE_LINE = "Its owner hasn't shared this."

/** The string the notch prints: the name, in curly quotes for a quoted user-made card. */
export function ogCardPrintedTitle(props: OgCardProps): string {
  const title = ogCardTitle(props)
  return props.kind === 'userMade' && props.quoted !== false ? `\u201C${title}\u201D` : title
}

/** The notch's room for text, in px: the card less its gutters and the notch's padding. */
const NOTCH_ROOM = 1028
/** The display size, and the source floor (34px at 1200 is 11px at 400). */
const TITLE_MAX = 120
const TITLE_MIN = 34
/**
 * Barlow Semi Condensed caps advance 0.55 to 0.7em a character (W, M, O wide;
 * I, J narrow). 0.62 is the smallest step that held every SRD name, bare and
 * quoted, inside the notch when measured in the real face (0.52 let 11 spill),
 * while keeping all but a handful at their widest fit. The notch also
 * ellipsizes, so a wrong guess costs a smaller title, never a second line.
 */
const TITLE_ADVANCE = 0.62

/**
 * The notch's font size for the string it prints (quotes included, see
 * `ogCardPrintedTitle`): 120px when it fits, stepping down so it stays on one
 * line, never under the 34px source floor. A name still too long at the floor
 * is ellipsized by the notch (`.su-chapter-band[data-scale='og']`).
 */
export function ogTitleSize(printed: string): number {
  const fit = Math.floor(NOTCH_ROOM / (TITLE_ADVANCE * Math.max(printed.length, 1)))
  return Math.max(TITLE_MIN, Math.min(TITLE_MAX, fit))
}

/**
 * The reference foot's room for the address, in px: the card less its gutters,
 * the mark, the `PRODUCT.wordmark` and the gap, measured in the real
 * face. ITUN's shorter wordmark leaves it more.
 */
const REFERENCE_ADDRESS_ROOM = 672
/** The foot's address size: the 34px source floor. */
const ADDRESS_SIZE = 34
/**
 * Barlow Semi Condensed semibold advances about 0.42em a character over SRD
 * paths (lowercase, digits, hyphens and slashes) when measured; 0.45 leaves
 * room for the wide letters (m, w).
 */
const ADDRESS_ADVANCE = 0.45

/**
 * Whether an address fits the reference foot on one line. The foot is a
 * readout of where the link goes, so it is never clipped: the SRD picks the
 * longest form of the page's path that fits (`apps/srd/src/lib/ogCard.ts`).
 */
export function ogReferenceAddressFits(address: string): boolean {
  return address.length * ADDRESS_ADVANCE * ADDRESS_SIZE <= REFERENCE_ADDRESS_ROOM
}
