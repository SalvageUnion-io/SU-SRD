/**
 * `/about` — the about page. Port of `about.astro`.
 *
 * Three things carried over from the Astro original:
 *
 * 1. The two shared markdown files are still read from disk **at build time**.
 *    This module only ever runs in the build (and in `ssg/dev.ts`, which is the
 *    same render path), so a `node:fs` read here costs the browser nothing.
 *    The path is resolved from `import.meta.url` rather than `process.cwd()`
 *    so it does not depend on where the build was invoked from.
 * 2. The lightbox behaviour that Astro shipped as `<script is:inline
 *    data-astro-rerun>` is now a plain inline script. `data-astro-rerun` only
 *    ever meant "run me again after a ClientRouter swap"; with real document
 *    navigations the script runs on every page load, so the attribute has no
 *    meaning and is deliberately dropped (same reasoning as `BaseLayout`'s
 *    `js`-class script).
 * 3. The Eldridge Coast map is still a build-emitted, content-hashed asset
 *    rather than an unhashed file in `public/`. `astro:assets` did that; here
 *    the emit and the address are split — `src/runtime/assets.entry.ts` makes
 *    Vite emit it, and `builtAssetUrl` reads the hashed url back out of the
 *    build manifest. See `BuiltAssets` in `ssg/types.ts`.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PageHeading, Slab } from 'component-lib'
import { Fragment } from 'react'
import type { PageModule, PageResult, RouteContext } from '../../ssg/types'
import { ColophonIsland } from '../components/islands/ColophonIsland'
import { builtAssetUrl, ELDRIDGE_COAST_MAP } from '../lib/builtAssets'
import { SITE_URL } from '../lib/constants'
import { Island } from '../runtime/Island'

/** Repo root, relative to this module — `apps/srd/src/pages` -> four levels up. */
const repoRootFile = (name: string): string =>
  fileURLToPath(new URL(`../../../../${name}`, import.meta.url))

// The shared colophon prose, read at build time from the repo root so both this
// site and ITUN render the same words.
const aboutJrvsMd = readFileSync(repoRootFile('ABOUT_JRVS.md'), 'utf8')
const llmStatementMd = readFileSync(repoRootFile('LLM_STATEMENT.md'), 'utf8')
const specialThanksMd = readFileSync(repoRootFile('SPECIAL_THANKS.md'), 'utf8')

const TITLE = 'About - Salvage Union System Reference Document'
const DESCRIPTION =
  'About salvageunion.io, an open-source System Reference Document for the Salvage Union TTRPG by Leyline Press. Community-built reference tool.'

const imageAltText = 'Map of The Eldridge Coast, created using Shmeppy.com'

const pilots = ['STUMPY', 'ROACH BOY', 'NELL', 'PART', 'PARCÈL', 'CALI']

/**
 * Opens/closes the Eldridge Coast lightbox. Identical behaviour to the Astro
 * original: the map link opens the native `<dialog>`, the close button and a
 * backdrop click close it and return focus to the link.
 */
const MAP_MODAL_SCRIPT = `
    const mapLink = document.getElementById('map-link')
    const modal = document.getElementById('image-modal')
    const closeBtn = document.getElementById('close-modal')

    mapLink?.addEventListener('click', (e) => {
      e.preventDefault()
      modal?.showModal()
    })
    closeBtn?.addEventListener('click', () => {
      modal?.close()
      mapLink?.focus()
    })
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.close()
        mapLink?.focus()
      }
    })
  `

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
        <div className="flex w-full flex-1 flex-col justify-center py-12">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6">
            {/* Riveted scrap metal panel */}
            <div className="pilot-panel-shadow">
              <div className="pilot-panel relative px-10 py-8">
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

                <div className="relative z-[1] flex flex-col gap-3">
                  {/* Inspiration text */}
                  <div className="engraved-text text-center font-cond text-sm font-medium uppercase tracking-caps-snug leading-relaxed">
                    <p>Inspired by the pilots of</p>
                    <p className="font-bold text-lg">#812 Haven</p>
                    <p>of</p>
                    <p className="font-bold text-lg">
                      {/* biome-ignore lint/a11y/useValidAnchor: kept verbatim from about.astro — the lightbox script preventDefaults this href and opens the <dialog> */}
                      <a href="#" id="map-link" className="cursor-pointer">
                        The Eldridge Coast
                      </a>
                    </p>
                  </div>

                  <hr className="metal-separator" />

                  {/* Pilot names */}
                  <div className="flex flex-wrap items-center justify-center">
                    {pilots.map((name, i) => (
                      <Fragment key={name}>
                        {i > 0 && <span className="engraved-text text-base">&ensp;&ensp;</span>}
                        <span className="engraved-text font-cond text-xl font-bold uppercase">
                          {name}
                        </span>
                      </Fragment>
                    ))}
                  </div>

                  <hr className="metal-separator" />

                  <p className="engraved-text text-center font-cond text-sm font-medium uppercase tracking-caps-snug">
                    And union crawlers everywhere
                  </p>

                  <hr className="metal-separator" />

                  {/* Friends text */}
                  <p className="engraved-text text-center font-cond text-lg font-bold uppercase tracking-caps-snug">
                    "We get by with a little help from our friends"
                  </p>
                </div>
              </div>
            </div>

            <PageHeading className="text-center">About the Salvage Union SRD</PageHeading>

            {/* What is this? */}
            <section className="text-sm leading-relaxed">
              <Slab as="h2" variant="solid" label="What is this?" />
              <p className="mb-2">
                This is an unofficial, community-built System Reference Document (SRD) for{' '}
                <a
                  href="https://leyline.press/pages/salvage-union"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-rust hover:underline"
                >
                  Salvage Union
                </a>
                , a post-apocalyptic mech tabletop RPG published by{' '}
                <a
                  href="https://leyline.press"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-rust hover:underline"
                >
                  Leyline Press
                </a>
                . It provides a searchable, browsable reference for all game content released under
                the Salvage Union OGL.
              </p>
              <p className="mb-2">The site is open source and contributions are welcome.</p>
              <p>
                I am not the owner or publisher of this content. Salvage Union and all associated
                names, marks, characters, and artwork are the property of Leyline Press. Game text
                and mechanics are used under the{' '}
                <a
                  href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-rust hover:underline"
                >
                  Salvage Union Open Game Licence 1.0b
                </a>
                . Artwork is not covered by that licence and is reproduced with the special
                permission of Leyline Press. This is an unofficial fan project, and is not
                affiliated with Leyline Press.
              </p>
            </section>

            {/* Colophon: About the Dev + Special Thanks + support | LLM Statement
                (shared with ITUN).
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
          </div>
        </div>

        {/* SVG filter for peeling paint text effect */}
        <svg className="hidden" aria-hidden="true">
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
          className="bg-transparent backdrop:bg-ink/70 p-0 max-w-[90vw] m-auto"
          aria-label="Eldridge Coast Map"
        >
          <div className="relative">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-panel bg-ink px-3 py-1 text-2xl font-bold text-paper hover:bg-rust"
              id="close-modal"
              aria-label="Close"
            >
              &times;
            </button>
            <div className="flex flex-col items-stretch gap-4">
              {/* Astro's `<Image>` transcoded the source PNG into three hashed
                  webp variants under `_astro/` and emitted a srcset. Vite does
                  not transcode, so the webp is pre-encoded once at 1800px and
                  checked in beside the PNG; Vite still hashes and emits it, and
                  the url comes from the build manifest (see `BuiltAssets`).
                  One size instead of two: the image only ever appears in a
                  full-viewport lightbox, so the 1200w variant had no viewport
                  that selected it. */}
              <img
                src={eldridgeCoastMapUrl}
                alt={imageAltText}
                width={1800}
                height={1215}
                loading="lazy"
                decoding="async"
                className="h-auto max-h-[85vh] w-full object-contain"
              />
              <p className="text-center text-sm text-paper">
                Created using{' '}
                <a
                  href="https://shmeppy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-pilot-light hover:underline"
                >
                  Shmeppy.com
                </a>
              </p>
            </div>
          </div>
        </dialog>

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed inline script literal, no interpolation */}
        <script dangerouslySetInnerHTML={{ __html: MAP_MODAL_SCRIPT }} />
      </>
    ),
  }
}

export const aboutPage: PageModule = {
  pattern: '/about',
  page,
}
