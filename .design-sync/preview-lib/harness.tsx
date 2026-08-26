/*
 * Shared layout helpers for the authored preview cards.
 *
 * The repo's Ladle stories import an equivalent from
 * `packages/component-lib/src/stories/_harness.tsx`. That file is not reused
 * here on purpose: it is story-catalog furniture, and a preview importing it
 * would tie the uploaded design system to a file whose job is decorating
 * Ladle. These are the same two primitives, restated so previews own them.
 *
 * Nothing here is a component-lib component — it is caption and spacing glue
 * only, so it never competes with the real API in a card.
 */
import type { CSSProperties, ReactNode } from 'react'

const captionStyle: CSSProperties = {
  color: 'var(--color-wk-muted, #6b6257)',
  fontFamily: "var(--font-cond, 'Barlow Semi Condensed', system-ui, sans-serif)",
  fontSize: '0.6875rem',
  letterSpacing: '0.08em',
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
}

/** A small-caps label above a cluster of examples. */
export function Caption({ children }: { children: ReactNode }) {
  return <div style={captionStyle}>{children}</div>
}

/** A wrapping horizontal cluster — the default way to show a variant sweep. */
export function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.75rem' }}>
      {children}
    </div>
  )
}

/** A vertical stack of captioned clusters — the standard cell body. */
export function Stack({ children, gap = '1rem' }: { children: ReactNode; gap?: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
}

/** One captioned cluster. */
export function Group({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Caption>{caption}</Caption>
      {children}
    </div>
  )
}

/**
 * The dashboard instrument stage — a port of
 * `packages/component-lib/src/stories/_dashboardStage.tsx`.
 *
 * `.pc-root` is NOT decoration: it is the token scope that
 * `DashboardCanvas.css` / `DashboardGrid.css` / `instruments.css` key every
 * `.pc-*` rule off, so an instrument rendered outside it is unstyled. The
 * story-side version also imports those three stylesheets for Vite's benefit;
 * here they are compiled into the shipped stylesheet instead (the converter
 * compiles `.css` imports to empty), so only the scope and the frame are needed.
 *
 * `data-mount` picks the ontology tint — mech green / pilot orange / crawler
 * pink.
 */
export function InstrumentStage({
  children,
  width = 340,
  mount = 'mech',
}: {
  children: ReactNode
  width?: number
  mount?: 'mech' | 'pilot' | 'crawler'
}) {
  return (
    <div
      className="pc-root"
      data-mount={mount}
      style={{
        background: 'var(--color-paper)',
        padding: '1rem',
        borderRadius: 'var(--radius-panel)',
        maxWidth: width,
      }}
    >
      {children}
    </div>
  )
}
