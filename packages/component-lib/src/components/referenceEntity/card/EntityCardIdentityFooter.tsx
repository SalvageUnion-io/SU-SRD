import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../../design/tokens'
import type { CardFootMeta } from '../../shared/Card'
import type { CardSize } from '../../shared/displayMode'
import type { AdditionalSource } from './provenance'
import { formatProvenance } from './provenance'

type EntityCardIdentityFooterProps = {
  /** Entity TYPE (e.g. "Chassis") — the caps label on the LEFT of the row. */
  typeLabel: string | undefined
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
  /**
   * REPRINTS — the other books this entity also appears in (`additionalSources`
   * in the dataset). A SECOND line under the primary source, labelled so it
   * reads as an additional printing rather than a competing provenance. Absent
   * or empty ⇒ no line at all (most records have none). The card gates this to
   * the roomy footer; see the call site.
   */
  additionalSources?: AdditionalSource[]
  /** Write-layer: inline `[label value]` meta pairs (cost / SV) folded into the
   * footer's right side, before the source/page. */
  footMeta?: CardFootMeta[]
  /**
   * App-supplied cross-link (ITUN's "View in SRD →"), sourced from
   * `EntityExternalLinkProvider`. Full extent only — the card passes
   * `undefined` for head/catalog so listings stay uncluttered.
   */
  externalLink?: ReactNode
  size: CardSize
  /** USER-MADE (ruleset §3.9): the footer rule is dashed. */
  dashed?: boolean
}

const PAD_X: Record<CardSize, string> = { large: space[14], medium: space[10], small: space[8] }

const capsLabel: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  textTransform: 'uppercase',
}

const truncate: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/**
 * EntityCardIdentityFooter — the card's FOOTER (depth-0 / full cards only):
 * ink-2 type on the card's own paper, under a 1.5px ink rule (dashed on a
 * user-made card). It used to be a band in the tone's deep shade; the frame,
 * the "//" line and the footer are ink on paper now, so the tone lives in the
 * header alone (board E1).
 *
 * ONE row: the entity TYPE on the LEFT, provenance (source · page) on the
 * RIGHT — "Chassis … Salvage Union Workshop Manual · p.128". A SECOND,
 * right-aligned line follows when the entity carries reprints
 * (`additionalSources`) — "Also in  Salvage Union Starter Set (PH) · p.38".
 */
export function EntityCardIdentityFooter({
  typeLabel,
  source,
  booklet,
  page,
  additionalSources,
  footMeta,
  externalLink,
  size,
  dashed = false,
}: EntityCardIdentityFooterProps) {
  const primary = formatProvenance(source, booklet, page)
  const reprints = (additionalSources ?? [])
    .map((entry) => formatProvenance(entry.source, entry.booklet, entry.page))
    .filter((line): line is string => !!line)
  // Foot extras force the footer even without source/page data — they are
  // affordances, not source chrome.
  const hasFootExtras = (footMeta?.length ?? 0) > 0 || !!externalLink

  if (!typeLabel && !primary && reprints.length === 0 && !hasFootExtras) return null

  return (
    <div
      style={{
        borderTopColor: 'var(--color-ink)',
        borderTopStyle: dashed ? 'dashed' : 'solid',
        borderTopWidth: 'var(--bw-chrome)',
        color: color.ink2,
        display: 'flex',
        flexDirection: 'column',
        fontSize: fontSize.caption,
        gap: space[4],
        marginTop: 'auto',
        padding: `${space[8]} ${PAD_X[size]}`,
        width: '100%',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          gap: space[12],
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <span style={{ ...capsLabel, ...truncate }}>{typeLabel ?? ''}</span>
        {/* Foot extras — inline meta pairs (cost / SV) folded into the row, then
          the source/page on the far right. */}
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: space[8],
            justifyContent: 'flex-end',
            minWidth: 0,
          }}
        >
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
              <span style={capsLabel}>{label}</span>
              <span style={{ fontWeight: weight.bold, lineHeight: 1 }}>{value}</span>
            </span>
          ))}
          {primary && <span style={truncate}>{primary}</span>}
          {externalLink && <span style={{ ...truncate, flexShrink: 0 }}>{externalLink}</span>}
        </div>
      </div>
      {/* REPRINTS — the additional-printings line. Right-aligned under the
          primary source it extends; wraps rather than truncating, since a second
          printing is a whole book title and a clipped one names nothing. */}
      {reprints.length > 0 && (
        <div
          style={{
            alignItems: 'baseline',
            columnGap: space[8],
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            rowGap: space[2],
            width: '100%',
          }}
        >
          <span style={capsLabel}>Also in</span>
          <span>{reprints.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
