import { Slab } from 'component-lib'
import { fontSize, space, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { HOUSE_RULES } from 'salvageunion-reference/rules'

type HouseRulesProps = {
  className?: string
}

// Colour and face inherit from the page, so each app's About page sets them.
const ROOT = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: fontSize.sm,
  gap: space[12],
  lineHeight: 1.625,
} satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const TITLE = { fontWeight: weight.bold } satisfies CSSProperties

const CITE = { fontSize: fontSize.xs, fontStyle: 'normal', opacity: 0.75 } satisfies CSSProperties

/**
 * HouseRules — every place the tools depart from the book, listed from the
 * registry (`HOUSE_RULES`, salvageunion-reference), on the About page both tools share.
 *
 * Each entry names the rule, says what the tools do instead, and cites the
 * book's own rule by page. The stat provenance ledger labels a line a house
 * rule produced, and this list is where that label is explained.
 */
export function HouseRules({ className }: HouseRulesProps) {
  return (
    <section className={className} style={ROOT}>
      <Slab as="h2" variant="solid" label="House rules" style={{ marginBottom: 0 }} />
      <p>
        Where these tools deliberately depart from the book, the change is listed here, and a stat
        it affects is labelled “house rule” in its breakdown.
      </p>
      <ul style={LIST}>
        {HOUSE_RULES.map((rule) => (
          <li key={rule.id}>
            <p style={TITLE}>{rule.title}</p>
            <p>{rule.deviation}</p>
            <cite style={CITE}>{rule.cite}</cite>
          </li>
        ))}
      </ul>
    </section>
  )
}
