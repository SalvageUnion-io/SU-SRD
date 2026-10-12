/**
 * AboutScreen — the /about page for In the Union Now.
 *
 * Static content page: what ITUN is, its local-first stance, links to the SRD
 * and the official game, and the shared `Colophon` (author bio, special thanks,
 * LLM statement, Ko-fi support widget). Styled in the ITUN paper/ink Workshop-Manual idiom
 * (mirrors the Roster main layout) rather than the SRD reference-site look, so
 * it reads as part of this app.
 */

import { ChapterBand, Colophon, InlineRef, Slab } from 'component-lib'
import { borderWidth, color, font, fontSize, space, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

type AboutScreenProps = {
  /** The build the app is running: the deployed commit's short SHA (ADR-041).
   * Passed in so this stays app-agnostic. */
  build: string
  /** Raw `ABOUT_JRVS.md`, passed in for the same reason: the library reads no
   * files, so each app inlines the repo-root documents its own way. */
  aboutJrvs: string
  /** Raw `LLM_STATEMENT.md`, same contract as `aboutJrvs`. */
  llmStatement: string
  /** Raw `SPECIAL_THANKS.md`, same contract as `aboutJrvs`. */
  specialThanks: string
}

/*
 * Static styling is style objects; the page's padding steps up at `sm` and
 * `lg`, so it is `.info-screen` (`styles/screens.css`), resting value included.
 * The Colophon takes no `style`, so its rule and type are
 * `.about-screen__colophon` there too.
 */
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

const PROSE = {
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: font.body,
  fontSize: fontSize.sm,
  gap: space[12],
  lineHeight: 1.625,
} satisfies CSSProperties

const LINK = { fontWeight: weight.semibold } satisfies CSSProperties

const BUILD = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: '1rem',
} satisfies CSSProperties

export function AboutScreen({ build, aboutJrvs, llmStatement, specialThanks }: AboutScreenProps) {
  return (
    <main className="info-screen" style={PAGE}>
      <div style={COLUMN}>
        <header style={HEADER}>
          <ChapterBand>About</ChapterBand>
          <p style={LEDE}>
            In the Union Now — a character builder &amp; game manager for Salvage Union.
          </p>
        </header>

        <section style={PROSE}>
          <Slab as="h2" variant="solid" label="What is this?" style={{ marginBottom: 0 }} />
          <p>
            <strong>In the Union Now</strong> is an unofficial, community-built character builder
            and game manager for{' '}
            <InlineRef
              href="https://leyline.press/pages/salvage-union"
              target="_blank"
              rel="noopener noreferrer"
              style={LINK}
            >
              Salvage Union
            </InlineRef>
            , the post-apocalyptic mech tabletop RPG published by{' '}
            <InlineRef
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              style={LINK}
            >
              Leyline Press
            </InlineRef>
            . Build pilots, mechs, and crawlers, then run them at the table with live sheets you can
            share.
          </p>
          <p>
            It's <strong>local-first</strong>: everything you create is stored privately in your own
            browser. There's no account and no server — export a backup any time to move your builds
            between devices.
          </p>
          <p>
            Looking for the rules? Browse the full searchable reference at{' '}
            <InlineRef
              href="https://salvageunion.io"
              target="_blank"
              rel="noopener noreferrer"
              style={LINK}
            >
              salvageunion.io
            </InlineRef>
            .
          </p>
          <p>
            I am not the owner or publisher of this content. Salvage Union and all associated names,
            marks, characters, and artwork are the property of Leyline Press. Game text and
            mechanics are used under the{' '}
            <InlineRef
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
              style={LINK}
            >
              Salvage Union Open Game Licence 1.0b
            </InlineRef>
            . Artwork is not covered by that licence and is reproduced with the special permission
            of Leyline Press. This is an unofficial fan project, and is not affiliated with Leyline
            Press.
          </p>
        </section>

        <Colophon
          aboutMarkdown={aboutJrvs}
          llmMarkdown={llmStatement}
          specialThanksMarkdown={specialThanks}
          kofiCode="C3Z82382ZC"
          className="about-screen__colophon"
          footer={<p style={BUILD}>Build {build}</p>}
        />
      </div>
    </main>
  )
}
