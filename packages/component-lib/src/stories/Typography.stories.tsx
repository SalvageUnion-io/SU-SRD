import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking } from '../design/tokens'
import themeCss from '../styles/theme.css?raw'
import { FoundationPage, RulesetRef, TokenLabel } from './_foundations'
import type { Story } from './_harness'
import { Caption } from './_harness'
import type { ThemeToken } from './_themeTokens'
import { parseThemeTokens, tokensIn } from './_themeTokens'

export default {
  title: 'Foundations/Typography',
}

// Every specimen is generated from theme.css's own source (`_themeTokens.ts`),
// set in real SRD copy (preloaded by catalog.tsx). What a rung is FOR is the
// ruleset's, linked rather than restated. The text roles are Atoms/Text's page.
const tokens = parseThemeTokens(themeCss)

const specimenName = (SalvageUnionReference.Chassis.all()[0]?.name ?? 'Iron Mongrel').toUpperCase()

const rowStyle = {
  alignItems: 'baseline',
  borderTop: `1px solid ${color.ink12}`,
  columnGap: space[24],
  display: 'flex',
  flexWrap: 'wrap',
  paddingBlock: space[12],
  rowGap: space[4],
} satisfies CSSProperties

const capsStyle = {
  color: color.ink,
  fontFamily: font.cond,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A specimen row: the token's label, then the live rendering. */
function Row({ token, children }: { token: ThemeToken; children: ReactNode }) {
  return (
    <div style={rowStyle}>
      <span style={{ width: '16rem' }}>
        <TokenLabel token={token} />
      </span>
      <div style={{ flex: 1, minWidth: '16rem' }}>{children}</div>
    </div>
  )
}

/**
 * The type scale, each rung at true size. The semantic ladder is declared in
 * px; the rem rungs are inherited from the first port and stay in theme.css,
 * so they are listed apart rather than specimened as a choice.
 */
export const Scale: Story = () => {
  const rungs = tokensIn(tokens, '--text-')
  const inherited = rungs.filter((t) => t.value.endsWith('rem'))
  return (
    <FoundationPage
      title="Type scale"
      blurb={
        <>
          Every <code>--text-*</code> in theme.css, at true size. Nothing renders under the floor:{' '}
          <RulesetRef section="4.6" />.
        </>
      }
    >
      <div>
        {rungs
          .filter((t) => !inherited.includes(t))
          .map((t) => (
            <Row key={t.name} token={t}>
              <span style={{ ...capsStyle, fontSize: t.value }}>{specimenName}</span>
            </Row>
          ))}
      </div>
      <Caption>Inherited rem rungs — prefer a rung above</Caption>
      <div>
        {inherited.map((t) => (
          <Row key={t.name} token={t}>
            <span style={{ ...capsStyle, fontSize: t.value }}>{specimenName}</span>
          </Row>
        ))}
      </div>
    </FoundationPage>
  )
}

/** The font families and the weights in use. */
export const Fonts: Story = () => (
  <FoundationPage
    title="Font families &amp; weights"
    blurb={
      <>
        Every <code>--font-*</code> in theme.css: two faces, no aliases.
      </>
    }
  >
    <div>
      {tokensIn(tokens, '--font-')
        .filter((t) => !t.name.startsWith('--font-weight-'))
        .map((t) => (
          <Row key={t.name} token={t}>
            <span style={{ color: color.ink, fontFamily: t.value, fontSize: fontSize.lede }}>
              {specimenName} · {specimenName.toLowerCase()}
            </span>
          </Row>
        ))}
      {tokensIn(tokens, '--font-weight-').map((t) => (
        <Row key={t.name} token={t}>
          <span style={{ ...capsStyle, fontSize: fontSize.lede, fontWeight: Number(t.value) }}>
            {specimenName}
          </span>
        </Row>
      ))}
    </div>
  </FoundationPage>
)

/** The caps tracking ladder, on real uppercase label text. */
export const Tracking: Story = () => (
  <FoundationPage
    title="Tracking — the caps ladder"
    blurb={
      <>
        Every <code>--tracking-*</code> in theme.css. When to reach up the ladder:{' '}
        <RulesetRef section="4.2" />.
      </>
    }
  >
    <div>
      {tokensIn(tokens, '--tracking-').map((t) => (
        <Row key={t.name} token={t}>
          <span style={{ ...capsStyle, fontSize: fontSize.lede, letterSpacing: t.value }}>
            {specimenName}
          </span>
        </Row>
      ))}
    </div>
  </FoundationPage>
)
