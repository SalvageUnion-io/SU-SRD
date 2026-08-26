import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { CARD_IMAGE_CONTAINER_WIDTH, cardImageSizes } from './cardImageSizes'

type CardImageProps = {
  url?: string
  /**
   * Width-constrained candidates, from `getAssetSrcSet`.
   *
   * Optional: a caller with only a URL still renders, it just fetches the
   * master. The `sizes` that pairs with it is set here rather than by the
   * caller, because the width it describes is THIS component's container —
   * a caller cannot know it, and a wrong `sizes` silently picks the wrong
   * candidate rather than failing.
   */
  srcSet?: string
  alt: string
  compact?: boolean
  /**
   * ASIDE mode: the image is a flex-row sibling of the body prose rather than a
   * float, so the text sits centred beside it instead of wrapping around it.
   * Used by cards whose trailing section (`afterExtraContent`) owns the full
   * width beneath — see `ReferenceEntityCard`'s aside lead.
   */
  aside?: boolean
}

/**
 * CardImage — the entity illustration that the card body floats text around.
 *
 * Read-only by design. An `editable` surface (hover overlay, file input,
 * Change / Remove / Add Image buttons, upload spinner, and a placeholder SVG —
 * about 100 of this file's 182 lines) was removed after measuring zero callers:
 * the single production call site passes `url`/`alt`/`compact` and nothing else.
 * Its `width`/`height` props were dead alongside it.
 *
 * Deleting it also removed a real defect for free: the Remove button was painted
 * in what is now `--color-adversary`, i.e. an ONTOLOGY hue doing a destructive
 * action's job (ruleset §3.3). Uploading a custom entity image is not a
 * capability this library has a consumer for; when one exists it should arrive
 * as a deliberate design with the danger tone resolved, not as a dormant branch.
 */
export function CardImage({ url, srcSet, alt, compact, aside }: CardImageProps) {
  const [showImage, setShowImage] = useState(true)
  // The fade-in is a CLIENT-ONLY enhancement, so it starts already-`loaded` on
  // the server. On srd an entity card is rendered by the ZERO-JS static path
  // (`EntityCardStatic`) — it is not an island, so React never mounts over it
  // and neither `onLoad` nor the cached-load effect below can ever run. A
  // server-rendered `opacity: 0` therefore stays 0 forever, and every piece of
  // entity artwork on the site downloads in full and then paints nothing.
  //
  // Diverging from the client's initial state is safe HERE specifically because
  // srd's islands mount with `createRoot`, never `hydrateRoot` (see
  // `apps/srd/ssg/DESIGN.md`), so there is no hydration pass to mismatch.
  const [loaded, setLoaded] = useState(() => typeof window === 'undefined')
  const imgRef = useRef<HTMLImageElement>(null)

  // Reset the fade-in when the image URL changes so a swapped image fades in
  // instead of snapping to full opacity with the previous image's `loaded`
  // state. Adjusting state during render (vs. an effect) re-renders before
  // commit — no flash of the new image at opacity 1, no extra paint.
  const [loadedUrl, setLoadedUrl] = useState(url)
  if (url !== loadedUrl) {
    setLoadedUrl(url)
    setLoaded(false)
  }

  // Catch images that finished loading before React attached its onLoad handler
  // (cached / preloaded) — for those the load event already fired and won't fire
  // again. Run this in an effect (not a ref callback) and defer the state update to
  // a microtask so it lands after the hydration commit instead of mutating state
  // during it, which would desync the server-rendered markup and force a tree
  // regeneration (React #418).
  // biome-ignore lint/correctness/useExhaustiveDependencies: url is an intentional extra dep — the cached-load check must re-run whenever the image URL swaps
  useEffect(() => {
    const node = imgRef.current
    if (node?.complete && node.naturalWidth > 0) {
      queueMicrotask(() => setLoaded(true))
    }
  }, [url])

  if (!url || !showImage) return null

  const containerWidth = compact
    ? CARD_IMAGE_CONTAINER_WIDTH.compact
    : CARD_IMAGE_CONTAINER_WIDTH.normal

  return (
    <div
      className={cn(
        'mx-auto shrink-0 bg-paper align-top md:mx-0',
        !aside && 'md:float-left md:mr-4'
      )}
      style={{ width: containerWidth, maxWidth: '100%', shapeOutside: 'margin-box' }}
    >
      <div
        className="relative overflow-hidden"
        style={loaded ? undefined : { minHeight: compact ? 120 : 200 }}
      >
        <img
          ref={imgRef}
          src={url}
          srcSet={srcSet}
          // `sizes` MUST accompany a `w`-descriptor srcset. Without it a browser
          // assumes `100vw` and picks the widest candidate — which is the
          // oversampling this exists to stop, so a missing `sizes` would leave
          // the markup looking fixed while behaving exactly as before.
          //
          // The container is a fixed `containerWidth` capped at `maxWidth:100%`,
          // so it is that width except on a viewport narrower than the card.
          sizes={srcSet ? cardImageSizes(compact) : undefined}
          alt={alt}
          className="block h-auto w-full object-contain transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0 }}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setShowImage(false)}
        />
      </div>
    </div>
  )
}
