import { createFileRoute } from '@tanstack/react-router'
import { Changelog, ChapterBand } from 'component-lib'
import { borderWidth, color, font, fontSize, space } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import type { CSSProperties } from 'react'
import { pageTitle } from '../lib/pageTitle'

export const Route = createFileRoute('/changelog')({
  head: () => ({ meta: [{ title: pageTitle('Changelog') }] }),
  component: ChangelogPage,
})

// The About page's frame (`AboutScreen`): the padding steps up at `sm` and `lg`,
// so it is `.info-screen` (`styles/screens.css`); the rest is static.
const PAGE = {
  backgroundColor: color.wkBg,
  minHeight: '100vh',
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[32],
  marginInline: 'auto',
  maxWidth: '48rem',
  width: '100%',
} satisfies CSSProperties

const HEADER = {
  borderBottomColor: color.ink,
  borderBottomStyle: 'solid',
  borderBottomWidth: borderWidth.pill,
  paddingBottom: space[20],
} satisfies CSSProperties

const LEDE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  marginTop: space[8],
} satisfies CSSProperties

function ChangelogPage() {
  return (
    <main className="info-screen" style={PAGE}>
      <div style={COLUMN}>
        <header style={HEADER}>
          <ChapterBand>Changelog</ChapterBand>
          <p style={LEDE}>What's new in {PRODUCT.name}.</p>
        </header>

        <Changelog entries={__ITUN_CHANGELOG__} />
      </div>
    </main>
  )
}
