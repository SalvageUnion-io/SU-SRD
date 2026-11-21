// The home page: its slideshow (`HomeHero`), the site's name and the pitch on
// an ink-deep cut-out under the header, over seven slides of the book's art, each
// (but the first) a line and one action named for the slide on a cut-out over
// the footer, then the tagline's slide.
import type { CSSProperties } from 'react'
import { assetUrl } from 'salvageunion-reference'
import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import { Button, capsLabel } from '../components/index'
import { Tagline } from '../components/Tagline'
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
      /** The line over the body, in the title's face; some slides have none. */
      heading?: string
      body: string
      href: string
      external?: boolean
    }
  /** The slide's words are the pitch, which stands under the site's name: the art alone. */
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
      heading: referenceCopy('showReferenceHeading'),
      body: referenceCopy('showReferenceBody'),
      href: '/reference/',
      art: painting('slide-city'),
    },
    {
      key: 'build',
      kind: 'action',
      title: referenceCopy('showBuild'),
      heading: referenceCopy('showBuildHeading'),
      body: referenceCopy('showBuildBody'),
      href: appPath('/'),
      art: painting('build'),
    },
    {
      key: 'play',
      kind: 'action',
      title: referenceCopy('showPlay'),
      heading: referenceCopy('showPlayHeading'),
      body: referenceCopy('showPlayBody'),
      href: appPath('/games/'),
      art: painting('slide-union'),
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

/**
 * The home is its slideshow, edge to edge and the whole height between the
 * header and the footer. Each slide's art covers the ground. The site's name
 * and the pitch stand on an ink-deep cut-out notched into the header; each
 * slide's words on one notched into the footer, in the same place every time.
 * The show is CSS (the page is served without React): a slide out of its turn
 * is hidden, so only the one in view is seen, pressed or focused (chrome K3).
 * It holds while an act is pointed at or focused. Under reduced motion it never
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
                slide) at the plate's right. The pitch's slide has none. */}
            {slide.kind !== 'pitch' && (
              <div className="su-front__show-copy">
                {slide.kind === 'quote' ? (
                  <div className="su-front__show-plate su-front__show-plate--quote su-grain--paper">
                    <Tagline />
                  </div>
                ) : (
                  <div className="su-front__show-plate su-grain--paper">
                    <div className="su-front__show-words">
                      {slide.heading && <p className="su-front__show-heading">{slide.heading}</p>}
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
            )}
          </li>
        ))}
      </ul>
      {/* The site's name on an ink-deep cut-out under the header, speckled as it is, the page's one
          h1, and the pitch tucked under it on cut-outs of its own, each line
          as wide as its words. */}
      <div className="su-front__show-head">
        <div className="su-front__show-brand">
          <h1 className={cn('su-front__show-name su-grain--paper', capsLabel())}>
            {referenceCopy('siteName')}
          </h1>
          <p className="su-front__show-pitch">
            <span className="su-front__show-pitch-line su-grain--paper">
              {referenceCopy('pitchValue')}
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
