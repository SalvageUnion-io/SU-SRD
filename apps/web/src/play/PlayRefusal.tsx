/**
 * PlayRefusal — the shell a play screen renders when it cannot open: the
 * page's name on the band, what is missing as the heading under it, and the
 * one way on. Play's gates (`PlayGate`, `PlayMediatorGate`) answer with it;
 * while the session or the Game has not answered yet, they wait on
 * `RoutePending`.
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { ChapterBand, PageShell, Text, tokens } from '../components/index'
import { WayOutLink } from '../components/shared/WayOutLink'

const BODY = { maxWidth: '36rem', textAlign: 'left' } satisfies CSSProperties

const REASON = { fontSize: tokens.fontSize.title, margin: 0 } satisfies CSSProperties

type PlayRefusalProps = {
  /** The page's name, the band's title: Play's, the Cantina, unless a screen says otherwise. */
  page?: string
  /** What is missing, as the heading under the band. */
  title: string
  body: string
  link: { href: string; label: string }
}

export function PlayRefusal({ page = PRODUCT.play, title, body, link }: PlayRefusalProps) {
  return (
    <PageShell>
      <ChapterBand tone="play">{page}</ChapterBand>
      <Text as="h2" style={REASON}>
        {title}
      </Text>
      <Text variant="hint" style={BODY}>
        {body}
      </Text>
      <div>
        <WayOutLink href={link.href} label={link.label} />
      </div>
    </PageShell>
  )
}
