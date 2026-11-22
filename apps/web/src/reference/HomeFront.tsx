// The home page: its slideshow (`HomeHero`), the site's name on an ink-deep
// cut-out under the header, over eight slides of the book's art: first the
// pitch with the two ways most visits go (build, look something up), then
// each a line and one action named for the slide, on a cut-out over the
// footer, then the tagline's slide. Every slide has a way forward. A
// signed-in reader also gets the doors to their own Training Bay and Games.
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { assetUrl } from 'salvageunion-reference'
import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import { Button, capsLabel, Toggle } from '../components/index'
import { Tagline } from '../components/Tagline'
import { iconSize } from '../design/tokens'
import { appPath } from '../lib/appBase'
import { cn } from '../lib/cn'
import { DISCORD_INSTALL_URL } from '../lib/constants'
import { BUY_HREF } from '../lib/docPages'
import { referenceCopy } from '../messages/reference'

type Slide = {
  key: string
  /** The slide's ground: a painting from the books. */
  art: { url: string } | undefined
} & (
  | {
      kind: 'action'
      title: string
      body: string
      href: string
      external?: boolean
    }
  /** The slide's words are the pitch, alone in its plate. */
  | { kind: 'pitch' }
  /** The slide's words are the tagline (`Tagline`), in its plate. */
  | { kind: 'quote' }
)

/**
 * A painting from the Workshop Manual's spreads, cropped clear of its printed
 * quote, in the art bucket at `hero/<name>.webp` (R2, ADR-033: artwork never
 * lives in git), at full size: the derivatives stop at 880px, a hero spans the
 * screen. It is the slide's background, so an image the bucket does not hold
 * yet draws nothing and the slide shows its ink ground under its words.
 */
const painting = (name: string) => ({ url: assetUrl(`hero/${name}.webp`) })

/** The slides: the pitch, what each part of the site is for over a piece of the book's art, then the tagline. */
function heroSlides(): Slide[] {
  return [
    // What the site is, first.
    { key: 'pitch', kind: 'pitch', art: painting('reference') },
    {
      key: 'reference',
      kind: 'action',
      title: referenceCopy('showReference'),
      body: referenceCopy('showReferenceBody'),
      href: '/reference/',
      art: painting('slide-city'),
    },
    {
      key: 'build',
      kind: 'action',
      title: referenceCopy('showBuild'),
      body: referenceCopy('showBuildBody'),
      href: appPath('/'),
      art: painting('build'),
    },
    {
      key: 'play',
      kind: 'action',
      title: referenceCopy('showPlay'),
      body: referenceCopy('showPlayBody'),
      href: appPath('/games/'),
      art: painting('slide-union'),
    },
    // The Mediator's side of Play: prep, then the table. On the ink ground
    // until its painting is in the bucket (`hero/slide-mediator.webp`).
    {
      key: 'mediate',
      kind: 'action',
      title: referenceCopy('showMediate'),
      body: referenceCopy('showMediateBody'),
      href: appPath('/games/'),
      art: undefined,
    },
    {
      key: 'buy',
      kind: 'action',
      title: referenceCopy('showBuy'),
      body: referenceCopy('showBuyBody'),
      href: BUY_HREF,
      external: true,
      art: painting('slide-everything'),
    },
    {
      key: 'discord',
      kind: 'action',
      title: referenceCopy('showDiscord'),
      body: referenceCopy('showDiscordBody'),
      href: DISCORD_INSTALL_URL,
      external: true,
      art: painting('slide-buggy'),
    },
    // The tagline every landing page says, last.
    { key: 'union', kind: 'quote', art: painting('play') },
  ]
}

/** The home's search band under the show: an ink ground of its own (chrome K1), its field the child. */
export function HomeSearchBand({ children }: { children: ReactNode }) {
  return (
    <div className="su-front__search su-grain--paper" data-ground="ink">
      {children}
    </div>
  )
}

/**
 * The home is its slideshow, edge to edge and the whole height between the
 * header and the footer. Each slide's art covers the ground. The site's name
 * stands on an ink-deep cut-out notched into the header; each slide's words
 * (the first's, the pitch) on one notched into the footer, in the same place
 * every time.
 * The show is CSS (the page is served without React): a slide out of its turn
 * is hidden, so only the one in view is seen, pressed or focused (chrome K3).
 * It holds while a slide's words or action are pointed at or focused, its Pause (`watchSlideshow`, the
 * page's script) stops it for good (WCAG 2.2.2), and Previous and Next turn it
 * by hand, the slide they land on starting its turn afresh. Under reduced motion it never
 * turns: the slides stand one under another, every action in view.
 */
export function HomeHero() {
  const slides = heroSlides()
  return (
    <section
      className="su-front__show"
      aria-label={referenceCopy('siteName')}
      style={{ '--su-show-count': slides.length } as CSSProperties}
    >
      <ul className="su-front__show-slides">
        {slides.map((slide, index) => (
          <li
            key={slide.key}
            className="su-front__show-slide"
            style={{ '--su-show-i': index } as CSSProperties}
          >
            {slide.art && (
              // An <img>, not a background, so a phone takes the 880px
              // derivative and the first slide (the page's LCP) loads first.
              <img
                className="su-front__show-art"
                src={slide.art.url}
                srcSet={`${assetDerivativeUrl(slide.art.url, 880)} 880w, ${slide.art.url} 2400w`}
                sizes="100vw"
                alt=""
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'low'}
                // Only the first slide is in view at load; the rest wait for
                // layout, so they never share the first one's bandwidth.
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            )}
            {/* The slide's words on an ink-deep cut-out at its lower right, speckled as the header, on the
                footer: its heading and line, then its action (named for the
                slide) at the plate's right. The pitch's and the tagline's
                slides have no action. */}
            <div className="su-front__show-copy">
              {slide.kind === 'pitch' ? (
                <div
                  className="su-front__show-plate su-front__show-plate--pitch su-grain--paper"
                  data-ground="ink"
                >
                  <p className="su-front__show-pitch">{referenceCopy('pitchValue')}</p>
                  {/* The two things a visit is for. "Look something up" opens
                      the Reference, as its link says: the search band is
                      already in view below. */}
                  <div className="su-front__show-acts">
                    <Button
                      href={appPath('/')}
                      linkAs="a"
                      variant="primary"
                      size="full"
                      className="su-front__show-act"
                    >
                      {referenceCopy('showStart')}
                    </Button>
                    <Button
                      href="/reference/"
                      linkAs="a"
                      variant="default"
                      size="full"
                      className="su-front__show-act"
                    >
                      {referenceCopy('showLookUp')}
                    </Button>
                  </div>
                </div>
              ) : slide.kind === 'quote' ? (
                <div className="su-front__show-plate su-front__show-plate--quote su-grain--paper">
                  <Tagline />
                  <Button
                    href={appPath('/')}
                    linkAs="a"
                    variant="primary"
                    size="full"
                    className="su-front__show-act"
                  >
                    {referenceCopy('showStart')}
                  </Button>
                </div>
              ) : (
                <div className="su-front__show-plate su-grain--paper">
                  <div className="su-front__show-words">
                    <p className="su-front__show-body">{slide.body}</p>
                  </div>
                  <Button
                    href={slide.href}
                    linkAs="a"
                    variant="primary"
                    size="full"
                    className="su-front__show-act"
                    target={slide.external ? '_blank' : undefined}
                    rel="noopener noreferrer"
                  >
                    {slide.title}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* The site's name on an ink-deep cut-out under the header, speckled as it is, the page's one
          h1. */}
      <div className="su-front__show-head">
        <div className="su-front__show-brand">
          <h1 className={cn('su-front__show-name su-grain--paper', capsLabel())}>
            {referenceCopy('siteName')}
          </h1>
        </div>
        {/* A returning reader's own doors, served hidden and shown while
            somebody is signed in (`html[data-srd-signed-in]`, as Sign in
            hides): the page is one HTML for every reader. */}
        <nav
          className="su-front__show-yours su-grain--paper"
          aria-label={referenceCopy('showWelcomeBack')}
          data-ground="ink"
        >
          <span className={cn('su-front__show-yours-label', capsLabel())}>
            {referenceCopy('showWelcomeBack')}
          </span>
          {/* The Game last opened, by name: served hidden, and filled where
              the device remembers one (`markLastGame`, the page's script). */}
          <Button
            href={appPath('/games/')}
            linkAs="a"
            variant="primary"
            size="compact"
            className="su-front__show-game"
            data-last-game=""
            hidden
          />
          <Button href={appPath('/')} linkAs="a" variant="default" size="compact">
            {referenceCopy('showTrainingBay')}
          </Button>
          <Button href={appPath('/games/')} linkAs="a" variant="default" size="compact">
            {referenceCopy('showGames')}
          </Button>
        </nav>
      </div>
      {/* The show's controls, bare icons at its lower left: Previous, Pause
          (WCAG 2.2.2; Pause at rest, Play once pressed), Next. Hidden until
          the page's script can press them. */}
      <div className="su-front__show-controls" data-show-controls="" hidden>
        <Button
          variant="default"
          size="full"
          className="su-front__show-control"
          aria-label={referenceCopy('showPrevious')}
          data-show-turn="-1"
        >
          <ChevronLeft size={iconSize.full} aria-hidden="true" />
        </Button>
        <Toggle
          pressed={false}
          size="full"
          className="su-front__show-control su-front__show-pause"
          aria-label={referenceCopy('showPause')}
          data-show-pause=""
        >
          <Pause size={iconSize.full} aria-hidden="true" className="su-front__show-pause-icon" />
          <Play size={iconSize.full} aria-hidden="true" className="su-front__show-play-icon" />
        </Toggle>
        <Button
          variant="default"
          size="full"
          className="su-front__show-control"
          aria-label={referenceCopy('showNext')}
          data-show-turn="1"
        >
          <ChevronRight size={iconSize.full} aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
