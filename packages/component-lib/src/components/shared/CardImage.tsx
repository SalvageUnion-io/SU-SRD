import { useEffect, useRef, useState } from 'react'

type CardImageProps = {
  url?: string
  alt: string
  compact?: boolean
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
export function CardImage({ url, alt, compact }: CardImageProps) {
  const [showImage, setShowImage] = useState(true)
  const [loaded, setLoaded] = useState(false)
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

  const containerWidth = compact ? '180px' : '220px'

  return (
    <div
      className="mx-auto shrink-0 bg-paper align-top md:mx-0 md:float-left md:mr-4"
      style={{ width: containerWidth, maxWidth: '100%', shapeOutside: 'margin-box' }}
    >
      <div
        className="relative overflow-hidden"
        style={loaded ? undefined : { minHeight: compact ? 120 : 200 }}
      >
        <img
          ref={imgRef}
          src={url}
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
