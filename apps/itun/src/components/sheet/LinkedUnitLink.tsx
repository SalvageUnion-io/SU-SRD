/**
 * LinkedUnitLink — a linked unit in a sheet's read state (board 10, issue
 * 1255): one line, the listing card's anatomy at its smallest. The kind stamp
 * rides the top edge, the band is the unit's own tone with its name and its
 * first reading (`SP 9/9`), and the whole line opens that unit's sheet.
 *
 * Edit state keeps the full `EntityRow`, whose Assign and Unassign controls
 * are writes. Reading a sheet only needs to know what is linked and how it is
 * doing, so the line carries nothing else.
 */

import { Badge, Stat, tokens } from 'component-lib'
import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { SheetEntityKind } from '../../lib/schemas/entity'
import { AppLink } from '../shared/AppLink'

const TONE: Record<SheetEntityKind, string> = {
  pilot: tokens.color.sheetPilot,
  mech: tokens.color.sheetMech,
  crawler: tokens.color.sheetCrawler,
}

const LINE = {
  alignItems: 'center',
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.pill,
  color: tokens.color.ink,
  display: 'flex',
  gap: tokens.space[10],
  marginTop: tokens.space[10],
  minHeight: '48px',
  minWidth: 0,
  padding: `${tokens.space[10]} ${tokens.space[10]} ${tokens.space[6]} ${tokens.space[12]}`,
  position: 'relative',
  textDecoration: 'none',
} satisfies CSSProperties

const SEAM = {
  left: tokens.space[10],
  position: 'absolute',
  top: 0,
  transform: 'translateY(-50%)',
} satisfies CSSProperties

const NAME = {
  flex: '1 1 auto',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.extrabold,
  lineHeight: 1.1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const NO_SHRINK = { flexShrink: 0 } satisfies CSSProperties

type LinkedUnitLinkProps = {
  kind: SheetEntityKind
  name: string
  /** The unit's sheet; without one the line is not a link. */
  href: string | undefined
  /** Its readings; the first one shows. */
  stats: { label: string; value: string }[]
}

export function LinkedUnitLink({ kind, name, href, stats }: LinkedUnitLinkProps) {
  const reading = stats[0]
  const style = { ...LINE, backgroundColor: TONE[kind] }
  const body = (
    <>
      <span style={SEAM}>
        <Badge shape="stamp" size="mini">
          {kind}
        </Badge>
      </span>
      <span style={NAME}>{name}</span>
      {reading && (
        <span style={NO_SHRINK}>
          <Stat label={reading.label} value={reading.value} orientation="horizontal" size="mini" />
        </span>
      )}
      {href !== undefined && <ChevronRight size={18} aria-hidden="true" style={NO_SHRINK} />}
    </>
  )
  if (href === undefined) return <div style={style}>{body}</div>
  return (
    <AppLink href={href} aria-label={`View ${name}`} className="su-focus-ring" style={style}>
      {body}
    </AppLink>
  )
}
