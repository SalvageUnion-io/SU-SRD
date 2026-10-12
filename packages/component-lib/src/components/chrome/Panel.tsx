import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'

type PanelProps = {
  children: ReactNode
  /** Faint border instead of ink */
  soft?: boolean
  className?: string
  /** Test hook forwarded to the root (e.g. a named callout the tests query). */
  'data-testid'?: string
}

const PANEL = {
  backgroundColor: color.paper,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
} satisfies CSSProperties

/**
 * App-chrome panel (design-spec §2.10 `.panel`): 1.5px border, 6px radius,
 * paper ground. `soft` swaps to the faint border.
 */
export function Panel({ children, soft = false, className, 'data-testid': testId }: PanelProps) {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{ ...PANEL, borderColor: soft ? color.wkFaint : color.ink }}
    >
      {children}
    </div>
  )
}

type RowProps = {
  /** Primary text (Barlow 500 15px) */
  name: ReactNode
  /** Muted caption — encodes cross-links ('"Wrench" · Engineer · ↳ Iron Fist') */
  meta?: ReactNode
  /** Trailing actions (e.g. a 'Sheet' Button) */
  actions?: ReactNode
  /**
   * Let the name and meta WRAP instead of truncating to one line.
   *
   * The default single-line clamp is right for a saved-build row, whose meta is
   * a short caption. It is wrong for a row whose meta is a provenance line —
   * an invite code reads `for Sam · Mediator seat · needs approval · 2 uses
   * left · 14 days left`, and every fact after the second one is exactly what
   * the reader opened the panel for. Truncating those is losing the content to
   * keep the geometry.
   */
  wrap?: boolean
  className?: string
}

const ROW = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  display: 'flex',
  gap: space[12],
  paddingBlock: space[10],
  paddingInline: space[12],
} satisfies CSSProperties

const ROW_TEXT = { minWidth: 0, flex: '1 1 0%' } satisfies CSSProperties

const TRUNCATE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const ROW_NAME = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.lede,
  fontWeight: weight.medium,
} satisfies CSSProperties

const ROW_META = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

const ROW_ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  flexWrap: 'wrap',
  gap: space[6],
} satisfies CSSProperties

/**
 * Saved-build row (design-spec §2.10 `.row`): 1.5px ink frame, name + muted
 * meta caption + trailing actions.
 */
export function Row({ name, meta, actions, wrap = false, className }: RowProps) {
  return (
    <div
      className={className}
      style={{
        ...ROW,
        // A wrapping row aligns its columns at the TOP: with two lines of meta,
        // centring pushes the trailing actions to the middle of the block.
        ...(wrap ? { flexWrap: 'wrap', alignItems: 'flex-start' } : { alignItems: 'center' }),
      }}
    >
      <div style={ROW_TEXT}>
        <div style={wrap ? ROW_NAME : { ...ROW_NAME, ...TRUNCATE }}>{name}</div>
        {meta && <div style={wrap ? ROW_META : { ...ROW_META, ...TRUNCATE }}>{meta}</div>}
      </div>
      {actions && <div style={ROW_ACTIONS}>{actions}</div>}
    </div>
  )
}
