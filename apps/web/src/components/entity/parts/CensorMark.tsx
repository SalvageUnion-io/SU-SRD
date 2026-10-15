import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import type { CensorMark as Mark } from './censor'
import { tornEdge } from './censor'

/**
 * CENSOR MARK — what fills an art-less tile's art place in a catalog that has
 * art, quoting how the Workshop Manual censors its systems and modules
 * (ruleset §1): a torn ink patch reading REDACTED over its page (`file`), a
 * torn strip laid askew (`row`) or a red REMOVED rubber stamp (`removed`),
 * over one of Rainmaker's chassis blueprints faded into the paper.
 *
 * Decoration (`aria-hidden`): the tile's name is its label. Layout is
 * `entity-art.css`'s `.su-missing-art*`.
 */
export function CensorMark({ mark }: { mark: Mark }) {
  const { variant, code, seed, backdrop } = mark
  const backdropImg = (
    <img
      className="su-missing-art__backdrop"
      src={assetDerivativeUrl(backdrop, 440)}
      alt=""
      loading="lazy"
      decoding="async"
    />
  )
  const shell = `su-missing-art su-missing-art--${variant}`

  if (variant === 'removed') {
    return (
      <span className={shell} data-missing-art={variant} aria-hidden="true">
        {backdropImg}
        <span className="su-missing-art__stamp">Removed</span>
      </span>
    )
  }

  if (variant === 'row') {
    return (
      <span className={shell} data-missing-art={variant} aria-hidden="true">
        {backdropImg}
        <span className="su-missing-art__strip">
          <span
            className="su-missing-art__ink"
            style={{ clipPath: tornEdge(seed, { depth: 22, steps: 16, sides: 'long' }) }}
          />
          <span className="su-missing-art__word">Redacted</span>
        </span>
      </span>
    )
  }

  return (
    <span className={shell} data-missing-art={variant} aria-hidden="true">
      {backdropImg}
      <span
        className="su-missing-art__ink su-missing-art__patch"
        style={{ clipPath: tornEdge(seed, { depth: 7, steps: 18, sides: 'all' }) }}
      />
      <span className="su-missing-art__words">
        <span className="su-missing-art__word">Redacted</span>
        <span className="su-missing-art__code">{code}</span>
      </span>
    </span>
  )
}
