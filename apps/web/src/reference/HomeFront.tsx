// The home page: its slideshow (`HomeHero`), the site's name on a paper
// cut-out over five slides of the book's art, each a line and one action.
import type { CSSProperties } from 'react'
import { assetUrl } from 'salvageunion-reference'
import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import { Button, capsLabel } from '../components/index'
import { appPath } from '../lib/appBase'
import { cn } from '../lib/cn'
import { DISCORD_INSTALL_URL } from '../lib/constants'
import { BUY_HREF } from '../lib/docPages'
import { referenceCopy } from '../messages/reference'

type Slide = {
  key: string
  title: string
  body: string
  action: string
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
      action: referenceCopy('showReferenceAction'),
      href: '/reference/',
      art: painting('reference'),
    },
    {
      key: 'build',
      title: referenceCopy('showBuild'),
      body: referenceCopy('showBuildBody'),
      action: referenceCopy('showBuildAction'),
      href: appPath('/'),
      art: painting('build'),
    },
    {
      key: 'play',
      title: referenceCopy('showPlay'),
      body: referenceCopy('showPlayBody'),
      action: referenceCopy('showPlayAction'),
      href: appPath('/games/'),
      art: painting('play'),
    },
    {
      key: 'buy',
      title: referenceCopy('showBuy'),
      body: referenceCopy('showBuyBody'),
      action: referenceCopy('showBuyAction'),
      href: BUY_HREF,
      external: true,
      art: painting('buy'),
    },
    {
      key: 'discord',
      title: referenceCopy('showDiscord'),
      body: referenceCopy('showDiscordBody'),
      action: referenceCopy('showDiscordAction'),
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
            <div className="su-front__show-copy">
              <h2 className="su-front__show-title">{slide.title}</h2>
              <div className="su-front__show-plate">
                <p className="su-front__show-body">{slide.body}</p>
                <div className="su-front__show-act">
                  <Button
                    href={slide.href}
                    linkAs="a"
                    variant="primary"
                    size="full"
                    target={slide.external ? '_blank' : undefined}
                    rel="noopener noreferrer"
                  >
                    {slide.action}
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {/* The site's name on a paper cut-out, the page's one h1, and the pitch
          flowing flush out of its foot. */}
      <div className="su-front__show-head">
        <h1 className={cn('su-front__show-name', capsLabel())}>{referenceCopy('siteName')}</h1>
        <p className="su-front__show-value">{referenceCopy('pitchValue')}</p>
      </div>
    </section>
  )
}
