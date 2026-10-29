/**
 * `/about` — the about page.
 *
 * Three build details worth knowing:
 *
 * 1. The shared markdown files are read from disk **at build time**.
 *    This module only ever runs in the build (and in `astro dev`, which is the
 *    same render path), so a `node:fs` read here costs the browser nothing.
 *    Each is found by walking up from this module rather than from
 *    `process.cwd()`, so it does not depend on where the build was invoked
 *    from, nor on where the bundler put this module.
 * 2. The lightbox is a plain script, `public/about-lightbox.js`, loaded by
 *    URL: the reference site emits no executable inline script, so its CSP `script-src`
 *    stays a literal (`public/_headers`). Every navigation is a real document
 *    load, so it runs on every visit.
 * 3. The Eldridge Coast map is a build-emitted, content-hashed asset rather
 *    than an unhashed file in `public/`. The emit and the address are split — `astro/lib/assets.ts` makes
 *    Vite emit it, and `builtAssetUrl` reads the hashed url back out of
 *    `RouteContext.builtAssets`. See `BuiltAssets` in `src/reference/types.ts`.
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRODUCT } from 'game-domain/product'
import { X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { Colophon } from '../../components/Colophon'
import { Button, capsLabel, cn, InlineRef, SlabSection } from '../../components/index'
import { KofiIsland } from '../../components/islands/KofiIsland'
import { color, fontSize, iconSize, space, weight } from '../../design/tokens'
import { appPath } from '../../lib/appBase'
import { builtAssetUrl, ELDRIDGE_COAST_MAP } from '../../lib/builtAssets'
import { SITE_URL, WEBSITE } from '../../lib/constants'
import { BOLD, PROSE } from '../../lib/docPageStyles'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { Island } from '../../runtime/Island'
import { DocPage } from '../DocPage'
import type { PageModule, PageResult, RouteContext } from '../types'

/** A file at the repo root: the nearest `name` above this module. */
function repoRootFile(name: string): string {
  for (let dir = new URL('.', import.meta.url); ; dir = new URL('..', dir)) {
    const file = fileURLToPath(new URL(name, dir))
    if (existsSync(file)) return file
    if (dir.pathname === '/') throw new Error(`[build] no ${name} above ${import.meta.url}`)
  }
}

// The shared colophon prose, read at build time from the repo root. This page
// is the About page of both tools: the app links here and keeps no copy.
const aboutJrvsMd = readFileSync(repoRootFile('ABOUT_JRVS.md'), 'utf8')
const llmStatementMd = readFileSync(repoRootFile('LLM_STATEMENT.md'), 'utf8')
const specialThanksMd = readFileSync(repoRootFile('SPECIAL_THANKS.md'), 'utf8')

/** The `<code>` in `ko-fi.com/<code>`. */
const KOFI_CODE = 'C3Z82382ZC'

const TITLE = pageTitle(pagesCopy('about'))
const DESCRIPTION = `About salvageunion.io, an open-source System Reference Document for the Salvage Union TTRPG by Leyline Press, and its app: the ${PRODUCT.build}, where you build characters, and ${PRODUCT.play}, where you play them.`

const imageAltText = 'Map of The Eldridge Coast, created using Shmeppy.com'

/** The junk slab's padding; `.su-pilot-panel` (global.css) is the torn hull panel. */
const PANEL = {
  paddingBlock: space[32],
  paddingInline: space[40],
  position: 'relative',
} satisfies CSSProperties

/** The slab's carved lines, above its paint, rust and rivets. */
const PANEL_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  position: 'relative',
  zIndex: 2,
} satisfies CSSProperties

/** A carved caps line — `.su-carved-text` (global.css) is the cut. */
const CARVED_LINE = {
  fontSize: fontSize.sm,
  fontWeight: weight.medium,
  lineHeight: 'calc(1.25 / 0.875)',
  textAlign: 'center',
} satisfies CSSProperties
/** The carved caps lines: the cut is `.su-carved-text`, the caps the recipe's. */
const CARVED = cn('su-carved-text', capsLabel({ weight: 'inherit', tracking: 'snug' }))

const INSPIRATION = { ...CARVED_LINE, lineHeight: 1.625 } satisfies CSSProperties

const INSPIRATION_NAME = {
  fontSize: fontSize.lg,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.75 / 1.125)',
} satisfies CSSProperties

const POINTER = { cursor: 'pointer' } satisfies CSSProperties

const PILOTS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
} satisfies CSSProperties

const PILOT_GAP = { fontSize: fontSize.base, lineHeight: 1.5 } satisfies CSSProperties

const PILOT = {
  fontSize: fontSize.xl,
  lineHeight: 'calc(1.75 / 1.25)',
} satisfies CSSProperties
const PILOT_CAPS = capsLabel()

const FRIENDS = {
  ...CARVED_LINE,
  fontSize: fontSize.lg,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.75 / 1.125)',
} satisfies CSSProperties

const PARAGRAPH = { marginBottom: space[8] } satisfies CSSProperties

const HIDDEN = { display: 'none' } satisfies CSSProperties

/** The map lightbox, a native `<dialog>`; its scrim is `.su-about-lightbox`. */
const LIGHTBOX = {
  backgroundColor: 'transparent',
  margin: 'auto',
  maxWidth: '90vw',
  padding: 0,
} satisfies CSSProperties

const RELATIVE = { position: 'relative' } satisfies CSSProperties

/** The close button: Button's ink icon square, pinned to the image's corner. */
const LIGHTBOX_CLOSE = {
  fontSize: fontSize['2xl'],
  position: 'absolute',
  right: space[8],
  top: space[8],
  zIndex: 2,
} satisfies CSSProperties

const LIGHTBOX_BODY = {
  alignItems: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties

const MAP = {
  height: 'auto',
  maxHeight: '85vh',
  objectFit: 'contain',
  width: '100%',
} satisfies CSSProperties

const MAP_CREDIT = {
  color: color.paper,
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  textAlign: 'center',
} satisfies CSSProperties

/** The credit link; its hover underline is `.su-about-lightbox__credit`. */
const MAP_CREDIT_LINK = { color: color.pilotLight, fontWeight: weight.bold } satisfies CSSProperties

const pilots = ['STUMPY', 'ROACH BOY', 'NELL', 'PART', 'PARCÈL', 'CALI']

function page({ builtAssets }: RouteContext<Record<string, string>, unknown>): PageResult {
  const eldridgeCoastMapUrl = builtAssetUrl(builtAssets, ELDRIDGE_COAST_MAP)

  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: TITLE,
        description: pagesCopy('aboutSalvageunionIoAnOpen'),
        url: `${SITE_URL}/about/`,
        isPartOf: WEBSITE,
      },
    },
    children: (
      <>
        <DocPage title={pagesCopy('aboutTheSalvageUnionSrd')} measure="64rem" gap={space[32]}>
          {/* The dedication, carved into a torn-off hull panel */}
          <div className="su-pilot-panel-shadow">
            <div className="su-pilot-panel" style={PANEL}>
              <div className="su-pilot-panel-chips" />
              <div className="su-pilot-panel-stencil" />
              {/* Top edge rivets — inset from clipped edges */}
              <div
                className="su-rivet su-rivet-green"
                style={{ top: '16px', left: '24px', width: '13px', height: '13px' }}
              />
              <div
                className="su-rivet su-rivet-worn"
                style={{ top: '14px', left: '22%', width: '10px', height: '10px' }}
              />
              <div
                className="su-rivet"
                style={{
                  top: '15px',
                  left: '48%',
                  width: '11px',
                  height: '11px',
                  transform: 'rotate(15deg)',
                }}
              />
              <div
                className="su-rivet su-rivet-flush"
                style={{ top: '13px', left: '71%', width: '14px', height: '14px' }}
              />
              <div
                className="su-rivet su-rivet-green"
                style={{ top: '15px', right: '24px', width: '11px', height: '11px' }}
              />
              {/* Left edge rivets */}
              <div
                className="su-rivet"
                style={{
                  top: '28%',
                  left: '16px',
                  width: '12px',
                  height: '12px',
                  transform: 'rotate(-8deg)',
                }}
              />
              <div className="su-rivet-hole" style={{ top: '55%', left: '18px' }} />
              {/* Right edge rivets */}
              <div
                className="su-rivet su-rivet-green"
                style={{ top: '32%', right: '18px', width: '10px', height: '10px' }}
              />
              <div
                className="su-rivet"
                style={{
                  top: '62%',
                  right: '16px',
                  width: '13px',
                  height: '13px',
                  transform: 'rotate(5deg)',
                }}
              />
              {/* Bottom edge rivets — one missing, uneven */}
              <div
                className="su-rivet su-rivet-worn"
                style={{ bottom: '16px', left: '28px', width: '12px', height: '12px' }}
              />
              <div
                className="su-rivet su-rivet-flush"
                style={{
                  bottom: '14px',
                  left: '28%',
                  width: '11px',
                  height: '11px',
                  transform: 'rotate(-12deg)',
                }}
              />
              <div className="su-rivet-hole" style={{ bottom: '15px', left: '53%' }} />
              <div
                className="su-rivet su-rivet-green"
                style={{ bottom: '14px', left: '73%', width: '13px', height: '13px' }}
              />
              <div
                className="su-rivet su-rivet-worn"
                style={{
                  bottom: '16px',
                  right: '24px',
                  width: '10px',
                  height: '10px',
                  transform: 'rotate(7deg)',
                }}
              />

              <div style={PANEL_BODY}>
                {/* Inspiration text */}
                <div style={INSPIRATION}>
                  <p className={CARVED}>{pagesCopy('inspiredByThePilotsOf')}</p>
                  <p className={CARVED} style={INSPIRATION_NAME}>
                    {pagesCopy('n812Haven')}
                  </p>
                  <p className={CARVED}>{pagesCopy('of')}</p>
                  <p className={CARVED} style={INSPIRATION_NAME}>
                    {/* biome-ignore lint/a11y/useValidAnchor: the lightbox script preventDefaults this href and opens the <dialog> */}
                    <a href="#" id="map-link" style={POINTER}>
                      {pagesCopy('theEldridgeCoast')}
                    </a>
                  </p>
                </div>

                <hr className="su-carved-rule" />

                {/* Pilot names */}
                <div style={PILOTS}>
                  {pilots.map((name, i) => (
                    <Fragment key={name}>
                      {i > 0 && (
                        <span className="su-carved-text" style={PILOT_GAP}>
                          &ensp;&ensp;
                        </span>
                      )}
                      <span className={cn('su-carved-text', PILOT_CAPS)} style={PILOT}>
                        {name}
                      </span>
                    </Fragment>
                  ))}
                </div>

                <hr className="su-carved-rule" />

                <p className={CARVED} style={CARVED_LINE}>
                  {pagesCopy('andUnionCrawlersEverywhere')}
                </p>

                <hr className="su-carved-rule" />

                {/* Friends text */}
                <p className={CARVED} style={FRIENDS}>
                  {pagesCopy('weGetByWithA')}
                </p>
              </div>
            </div>
          </div>

          {/* What is this? */}
          <SlabSection as="h2" title={pagesCopy('whatIsThis')} bodyStyle={PROSE} page>
            <p style={PARAGRAPH}>
              This is an unofficial, community-built System Reference Document (SRD) for{' '}
              <InlineRef
                href="https://leyline.press/pages/salvage-union"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                {pagesCopy('salvageUnion')}
              </InlineRef>
              , a post-apocalyptic mech tabletop RPG published by{' '}
              <InlineRef
                href="https://leyline.press"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                {pagesCopy('leylinePress')}
              </InlineRef>
              . It provides a searchable, browsable reference for all game content released under
              the Salvage Union OGL.
            </p>
            <p style={PARAGRAPH}>
              Its app is the character builder and game manager: build pilots, mechs, and crawlers
              in the{' '}
              <InlineRef href={appPath('/')} style={BOLD}>
                {PRODUCT.build}
              </InlineRef>
              , then run them at the table in{' '}
              <InlineRef href={appPath('/play/')} style={BOLD}>
                {PRODUCT.play}
              </InlineRef>
              , with live sheets you can share. Reading needs no account: the Starter Set and any
              sheet shared by link open signed out. Sign in with Discord to build, and everything
              you make saves to your account.
            </p>
            <p style={PARAGRAPH}>{pagesCopy('bothAreOpenSourceAnd')}</p>
            <p>
              I am not the owner or publisher of this content. Salvage Union and all associated
              names, marks, characters, and artwork are the property of Leyline Press. Game text and
              mechanics are used under the{' '}
              <InlineRef
                href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                {pagesCopy('salvageUnionOpenGameLicence')}
              </InlineRef>
              . Artwork is not covered by that licence and is reproduced with the special permission
              of Leyline Press. This is an unofficial fan project, and is not affiliated with
              Leyline Press.
            </p>
          </SlabSection>

          {/* Colophon: About the Dev + support + Special Thanks | LLM Statement.
                Static prose; the Ko-fi button is the island (DESIGN.md's table). */}
          <Colophon
            aboutMarkdown={aboutJrvsMd}
            llmMarkdown={llmStatementMd}
            specialThanksMarkdown={specialThanksMd}
            support={
              <Island name="KofiIsland" client="visible" ssr props={{ code: KOFI_CODE }}>
                <KofiIsland code={KOFI_CODE} />
              </Island>
            }
          />
        </DocPage>

        {/* The junk slab's SVG filters (global.css names them) */}
        <svg style={HIDDEN} aria-hidden="true">
          <defs>
            {/* Hand-cut edges: the carving's strokes waver where the blade skipped */}
            <filter id="carve-rough" x="-5%" y="-20%" width="110%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves="2"
                seed="4"
                result="wobble"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="wobble"
                scale="1.6"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            {/* Paint chipped back to rust: keeps the rust ground only in the noise's peaks */}
            <filter id="paint-chips" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.035 0.05"
                numOctaves="4"
                seed="23"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -10 4.2"
                result="mask"
              />
              <feComposite in="SourceGraphic" in2="mask" operator="in" />
            </filter>
            {/* Worn paint: the hazard stencil, mostly scraped away */}
            <filter id="paint-peel" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.1"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -5 3.4"
                result="mask"
              />
              <feComposite in="SourceGraphic" in2="mask" operator="in" />
            </filter>
            {/* Subtle grain over the paint (no dirt colouring) */}
            <filter id="plate-damage" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.7"
                numOctaves="3"
                seed="19"
                result="grain"
              />
              <feColorMatrix
                in="grain"
                type="matrix"
                values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.3 0"
                result="noise"
              />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="noise" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Image lightbox with native dialog */}
        <dialog
          id="image-modal"
          className="su-about-lightbox"
          style={LIGHTBOX}
          aria-label={pagesCopy('eldridgeCoastMap')}
        >
          <div style={RELATIVE}>
            <Button
              variant="ink"
              size="iconOnly"
              className="su-print-ink"
              style={LIGHTBOX_CLOSE}
              id="close-modal"
              aria-label={pagesCopy('close')}
            >
              <X aria-hidden="true" size={iconSize.compact} />
            </Button>
            <div style={LIGHTBOX_BODY}>
              {/* Vite does not transcode images, so the webp is pre-encoded
                  once at 1800px and checked in beside the PNG; Vite still
                  hashes and emits it, and the url comes from
                  `builtAssets` (see `BuiltAssets`). One size: the image only ever
                  appears in a full-viewport lightbox. */}
              <img
                src={eldridgeCoastMapUrl}
                alt={imageAltText}
                width={1800}
                height={1215}
                loading="lazy"
                decoding="async"
                style={MAP}
              />
              <p className="su-print-ink" style={MAP_CREDIT}>
                Created using{' '}
                <a
                  href="https://shmeppy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="su-about-lightbox__credit"
                  style={MAP_CREDIT_LINK}
                >
                  {pagesCopy('shmeppyCom')}
                </a>
              </p>
            </div>
          </div>
        </dialog>

        <script src="/about-lightbox.js" />
      </>
    ),
  }
}

export const aboutPage: PageModule = {
  pattern: '/about',
  page,
}
