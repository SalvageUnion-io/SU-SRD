// The home page: its slideshow (`HomeHero`), the site's name on a cream
// cut-out and the pitch over five slides of the book's art, each a line and
// one action named for the slide, then the tagline's slide.
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
  /** The slide's ground: a painting from the books, or a cut-out drawing. */
  art: { url: string; cutout?: boolean } | undefined
} & (
  | { kind: 'action'; title: string; body: string; href: string; external?: boolean }
  /** The slide's words are the pitch, in the title's face. */
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

/** An entity's drawing, cut out on white, from the same bucket its Page uses. */
const drawing = (key: string) => ({ url: assetUrl(`${key}.webp`), cutout: true })

/** The slides: the pitch, what each part of the site is for over a piece of the book's art, then the tagline. */
function heroSlides(): Slide[] {
  return [
    // What the site is, over a bio-titan rising on a mech.
    { key: 'pitch', kind: 'pitch', art: drawing('bio-titans/typhon') },
    {
      key: 'reference',
      kind: 'action',
      title: referenceCopy('showReference'),
      body: referenceCopy('showReferenceBody'),
      href: '/reference/',
      art: painting('reference'),
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
      art: painting('play'),
    },
    {
      key: 'buy',
      kind: 'action',
      title: referenceCopy('showBuy'),
      body: referenceCopy('showBuyBody'),
      href: BUY_HREF,
      external: true,
      art: painting('buy'),
    },
    {
      key: 'discord',
      kind: 'action',
      title: referenceCopy('showDiscord'),
      body: referenceCopy('showDiscordBody'),
      href: DISCORD_INSTALL_URL,
      external: true,
      art: painting('discord'),
    },
    // The tagline every landing page says, last, over a Union salvager.
    { key: 'union', kind: 'quote', art: drawing('classes/salvager') },
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
                className={cn(
                  'su-front__show-art',
                  slide.art.cutout && 'su-front__show-art--cutout'
                )}
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
              {slide.kind === 'quote' ? (
                <div className="su-front__show-plate su-front__show-plate--quote">
                  <Tagline />
                </div>
              ) : slide.kind === 'pitch' ? (
                <div className="su-front__show-plate">
                  <p className="su-front__show-pitch">{referenceCopy('pitchValue')}</p>
                </div>
              ) : (
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
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* The site's name on a cream cut-out, the page's one h1. */}
      <div className="su-front__show-head">
        <div className="su-front__show-brand">
          <h1 className={cn('su-front__show-name', capsLabel())}>{referenceCopy('siteName')}</h1>
        </div>
      </div>
    </section>
  )
}
