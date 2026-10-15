/**
 * `/about` — the about page.
 *
 * Three build details worth knowing:
 *
 * 1. The shared markdown files are read from disk **at build time**.
 *    This module only ever runs in the build (and in `ssg/dev.ts`, which is the
 *    same render path), so a `node:fs` read here costs the browser nothing.
 *    The path is resolved from `import.meta.url` rather than `process.cwd()`
 *    so it does not depend on where the build was invoked from.
 * 2. The lightbox is a plain script, `public/about-lightbox.js`, loaded by
 *    URL: srd emits no executable inline script, so its CSP `script-src`
 *    stays a literal (`public/_headers`). Every navigation is a real document
 *    load, so it runs on every visit.
 * 3. The Eldridge Coast map is a build-emitted, content-hashed asset rather
 *    than an unhashed file in `public/`. The emit and the address are split — `src/runtime/assets.entry.ts` makes
 *    Vite emit it, and `builtAssetUrl` reads the hashed url back out of the
 *    build manifest. See `BuiltAssets` in `ssg/types.ts`.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buttonVariants, cn, InlineRef, Slab } from 'component-lib'
import { color, font, fontSize, space, tracking, weight } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import { X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import type { PageModule, PageResult, RouteContext } from '../../ssg/types'
import { DocPage } from '../components/DocPage'
import { ColophonIsland } from '../components/islands/ColophonIsland'
import { builtAssetUrl, ELDRIDGE_COAST_MAP } from '../lib/builtAssets'
import { CANTINA_PATH, SITE_URL, TITLE_SUFFIX } from '../lib/constants'
import { BOLD, PROSE } from '../lib/docPageStyles'
import { Island } from '../runtime/Island'

/** Repo root, relative to this module — `apps/web/src/pages` -> four levels up. */
const repoRootFile = (name: string): string =>
  fileURLToPath(new URL(`../../../../${name}`, import.meta.url))

// The shared colophon prose, read at build time from the repo root. This page
// is the About page of both tools: The Cantina links here and keeps no copy.
const aboutJrvsMd = readFileSync(repoRootFile('ABOUT_JRVS.md'), 'utf8')
const llmStatementMd = readFileSync(repoRootFile('LLM_STATEMENT.md'), 'utf8')
const specialThanksMd = readFileSync(repoRootFile('SPECIAL_THANKS.md'), 'utf8')

const TITLE = `About${TITLE_SUFFIX}`
const DESCRIPTION = `About salvageunion.io, an open-source System Reference Document for the Salvage Union TTRPG by Leyline Press, and ${PRODUCT.name}, its character builder.`

const imageAltText = 'Map of The Eldridge Coast, created using Shmeppy.com'

/** The riveted plate's padding; `.pilot-panel` (global.css) is the plate. */
const PANEL = {
  paddingBlock: space[32],
  paddingInline: space[40],
  position: 'relative',
} satisfies CSSProperties

/** The plate's engraved lines, above its metal and rivets. */
const PANEL_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  position: 'relative',
  zIndex: 1,
} satisfies CSSProperties

/** An engraved caps line — `.engraved-text` (global.css) is the paint. */
const ENGRAVED_LINE = {
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.medium,
  letterSpacing: tracking.capsSnug,
  lineHeight: 'calc(1.25 / 0.875)',
  textAlign: 'center',
  textTransform: 'uppercase',
} satisfies CSSProperties

const INSPIRATION = { ...ENGRAVED_LINE, lineHeight: 1.625 } satisfies CSSProperties

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
  fontFamily: font.cond,
  fontSize: fontSize.xl,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.75 / 1.25)',
  textTransform: 'uppercase',
} satisfies CSSProperties

const FRIENDS = {
  ...ENGRAVED_LINE,
  fontSize: fontSize.lg,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.75 / 1.125)',
} satisfies CSSProperties

const PARAGRAPH = { marginBottom: space[8] } satisfies CSSProperties

const HIDDEN = { display: 'none' } satisfies CSSProperties

/** The map lightbox, a native `<dialog>`; its scrim is `.srd-about-lightbox`. */
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
  zIndex: 10,
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

/** The credit link; its hover underline is `.srd-about-lightbox__credit`. */
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
        name: 'About the Salvage Union SRD',
        description:
          'About salvageunion.io, an open-source System Reference Document for the Salvage Union TTRPG by Leyline Press.',
        url: `${SITE_URL}/about/`,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Salvage Union System Reference Document',
          url: `${SITE_URL}/`,
        },
      },
    },
    children: (
      <>
        <DocPage title="About the Salvage Union SRD" measure="64rem" gap={space[32]}>
          {/* Riveted scrap metal panel */}
          <div className="pilot-panel-shadow">
            <div className="pilot-panel" style={PANEL}>
              {/* Top edge rivets — inset from clipped edges */}
              <div
                className="rivet rivet-green"
                style={{ top: '16px', left: '24px', width: '13px', height: '13px' }}
              />
              <div
                className="rivet rivet-worn"
                style={{ top: '14px', left: '22%', width: '10px', height: '10px' }}
              />
              <div
                className="rivet"
                style={{
                  top: '15px',
                  left: '48%',
                  width: '11px',
                  height: '11px',
                  transform: 'rotate(15deg)',
                }}
              />
              <div
                className="rivet rivet-flush"
                style={{ top: '13px', left: '71%', width: '14px', height: '14px' }}
              />
              <div
                className="rivet rivet-green"
                style={{ top: '15px', right: '24px', width: '11px', height: '11px' }}
              />
              {/* Left edge rivets */}
              <div
                className="rivet"
                style={{
                  top: '28%',
                  left: '16px',
                  width: '12px',
                  height: '12px',
                  transform: 'rotate(-8deg)',
                }}
              />
              <div className="rivet-hole" style={{ top: '55%', left: '18px' }} />
              {/* Right edge rivets */}
              <div
                className="rivet rivet-green"
                style={{ top: '32%', right: '18px', width: '10px', height: '10px' }}
              />
              <div
                className="rivet"
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
                className="rivet rivet-worn"
                style={{ bottom: '16px', left: '28px', width: '12px', height: '12px' }}
              />
              <div
                className="rivet rivet-flush"
                style={{
                  bottom: '14px',
                  left: '28%',
                  width: '11px',
                  height: '11px',
                  transform: 'rotate(-12deg)',
                }}
              />
              <div className="rivet-hole" style={{ bottom: '15px', left: '53%' }} />
              <div
                className="rivet rivet-green"
                style={{ bottom: '14px', left: '73%', width: '13px', height: '13px' }}
              />
              <div
                className="rivet rivet-worn"
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
                <div className="engraved-text" style={INSPIRATION}>
                  <p>Inspired by the pilots of</p>
                  <p style={INSPIRATION_NAME}>#812 Haven</p>
                  <p>of</p>
                  <p style={INSPIRATION_NAME}>
                    {/* biome-ignore lint/a11y/useValidAnchor: the lightbox script preventDefaults this href and opens the <dialog> */}
                    <a href="#" id="map-link" style={POINTER}>
                      The Eldridge Coast
                    </a>
                  </p>
                </div>

                <hr className="metal-separator" />

                {/* Pilot names */}
                <div style={PILOTS}>
                  {pilots.map((name, i) => (
                    <Fragment key={name}>
                      {i > 0 && (
                        <span className="engraved-text" style={PILOT_GAP}>
                          &ensp;&ensp;
                        </span>
                      )}
                      <span className="engraved-text" style={PILOT}>
                        {name}
                      </span>
                    </Fragment>
                  ))}
                </div>

                <hr className="metal-separator" />

                <p className="engraved-text" style={ENGRAVED_LINE}>
                  And union crawlers everywhere
                </p>

                <hr className="metal-separator" />

                {/* Friends text */}
                <p className="engraved-text" style={FRIENDS}>
                  "We get by with a little help from our friends"
                </p>
              </div>
            </div>
          </div>

          {/* What is this? */}
          <section style={PROSE}>
            <Slab as="h2" variant="solid" label="What is this?" />
            <p style={PARAGRAPH}>
              This is an unofficial, community-built System Reference Document (SRD) for{' '}
              <InlineRef
                href="https://leyline.press/pages/salvage-union"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                Salvage Union
              </InlineRef>
              , a post-apocalyptic mech tabletop RPG published by{' '}
              <InlineRef
                href="https://leyline.press"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                Leyline Press
              </InlineRef>
              . It provides a searchable, browsable reference for all game content released under
              the Salvage Union OGL.
            </p>
            <p style={PARAGRAPH}>
              <InlineRef href={CANTINA_PATH} style={BOLD}>
                {PRODUCT.name}
              </InlineRef>{' '}
              is its character builder and game manager: build pilots, mechs, and crawlers, then run
              them at the table with live sheets you can share. Reading needs no account: the
              Starter Set and any sheet shared by link open signed out. Sign in with Discord to
              build, and everything you make saves to your account.
            </p>
            <p style={PARAGRAPH}>Both are open source and contributions are welcome.</p>
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
                Salvage Union Open Game Licence 1.0b
              </InlineRef>
              . Artwork is not covered by that licence and is reproduced with the special permission
              of Leyline Press. This is an unofficial fan project, and is not affiliated with
              Leyline Press.
            </p>
          </section>

          {/* Colophon: About the Dev + support + Special Thanks | LLM Statement.
                `ssr` per DESIGN.md's per-island table — the prose is worth indexing. */}
          <Island
            name="ColophonIsland"
            client="visible"
            ssr
            props={{
              aboutMarkdown: aboutJrvsMd,
              llmMarkdown: llmStatementMd,
              specialThanksMarkdown: specialThanksMd,
            }}
          >
            <ColophonIsland
              aboutMarkdown={aboutJrvsMd}
              llmMarkdown={llmStatementMd}
              specialThanksMarkdown={specialThanksMd}
            />
          </Island>
        </DocPage>

        {/* SVG filter for peeling paint text effect */}
        <svg style={HIDDEN} aria-hidden="true">
          <defs>
            {/* Worn paint on engraved text */}
            <filter id="paint-peel" x="-10%" y="-10%" width="120%" height="120%">
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
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.75 3.1"
                result="mask"
              />
              <feComposite in="SourceGraphic" in2="mask" operator="in" />
            </filter>
            {/* Subtle grain / texture overlay (no dirt coloring) */}
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
          className="srd-about-lightbox"
          style={LIGHTBOX}
          aria-label="Eldridge Coast Map"
        >
          <div style={RELATIVE}>
            <button
              type="button"
              className={cn(buttonVariants({ variant: 'ink', size: 'iconOnly' }), 'srd-print-ink')}
              style={LIGHTBOX_CLOSE}
              id="close-modal"
              aria-label="Close"
            >
              <X aria-hidden="true" size={20} />
            </button>
            <div style={LIGHTBOX_BODY}>
              {/* Vite does not transcode images, so the webp is pre-encoded
                  once at 1800px and checked in beside the PNG; Vite still
                  hashes and emits it, and the url comes from the build
                  manifest (see `BuiltAssets`). One size: the image only ever
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
              <p className="srd-print-ink" style={MAP_CREDIT}>
                Created using{' '}
                <a
                  href="https://shmeppy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="srd-about-lightbox__credit"
                  style={MAP_CREDIT_LINK}
                >
                  Shmeppy.com
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
