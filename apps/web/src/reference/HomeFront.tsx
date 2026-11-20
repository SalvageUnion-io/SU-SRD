// The home page: its slideshow (`HomeHero`), the site's name on a paper
// cut-out over five slides of the book's art, each a line and one action
// named for the slide.
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
  title: string
  body: string
  href: string
  external?: boolean
  /** The slide's ground: a painting from the books. */
  art: { url: string } | undefined
}

/**
 * A painting from the Workshop Manual's spreads, cropped clear of its printed
 * quote, in the art bucket at `hero/<name>.webp` (R2, ADR-033: artwork never
 * lives in git), at full size: the derivatives stop at 880px, a hero spans the
 * screen. It is the slide's background, so an image the bucket does not hold
 * yet draws nothing and the slide shows its ink ground under its words.
 */
const painting = (name: string) => ({ url: assetUrl(`hero/${name}.webp`) })

/** The five slides: what each part of the site is for, over a piece of the book's art. */
function heroSlides(): Slide[] {
  return [
    {
      key: 'reference',
      title: referenceCopy('showReference'),
      body: referenceCopy('showReferenceBody'),
      href: '/reference/',
      art: painting('reference'),
    },
    {
      key: 'build',
      title: referenceCopy('showBuild'),
      body: referenceCopy('showBuildBody'),
      href: appPath('/'),
      art: painting('build'),
    },
    {
      key: 'play',
      title: referenceCopy('showPlay'),
      body: referenceCopy('showPlayBody'),
      href: appPath('/games/'),
      art: painting('play'),
    },
    {
      key: 'buy',
      title: referenceCopy('showBuy'),
      body: referenceCopy('showBuyBody'),
      href: BUY_HREF,
      external: true,
      art: painting('buy'),
    },
    {
      key: 'discord',
      title: referenceCopy('showDiscord'),
      body: referenceCopy('showDiscordBody'),
      href: DISCORD_INSTALL_URL,
      external: true,
      art: painting('discord'),
    },
  ]
}

/**
 * The home is its slideshow, edge to edge and the whole height between the
 * header and the footer. Each slide's art covers the ground. The site's name
 * stands on a paper cut-out at the top with the pitch under it; each slide's
 * words stand on the art itself, in the same place every time, over a soft
 * scrim. CSS only (the page is served without React); under reduced motion
 * the first slide stands still.
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
            {/* The slide's words on a paper plate at its lower left: its
                action (named for the slide, which has no heading) first, the
                line beside it. */}
            <div className="su-front__show-copy">
              <div className="su-front__show-plate">
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
                <p className="su-front__show-body">{slide.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {/* The site's name on a paper cut-out, the page's one h1, and the pitch
          flowing flush out of its foot. */}
      <div className="su-front__show-head">
        <div className="su-front__show-brand">
          <h1 className={cn('su-front__show-name', capsLabel())}>{referenceCopy('siteName')}</h1>
          {/* The pitch's paper hugs each line it breaks to. */}
          <p className="su-front__show-value">
            <span className="su-front__show-lines">{referenceCopy('pitchValue')}</span>
          </p>
        </div>
        {/* The tagline every landing page says, in its hand, level with the
            site's name. */}
        <div className="su-front__show-quote">
          <Tagline />
        </div>
      </div>
    </section>
  )
}
