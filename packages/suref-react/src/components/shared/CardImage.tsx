import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

type CardImageEditable = {
  customUrl?: string | null
  onSetCustom: (url: string | null) => void
  onFileSelected?: (file: File) => void
  isUploading?: boolean
  removeLabel?: string
}

type CardImageProps = {
  url?: string
  alt: string
  compact?: boolean
  editable?: CardImageEditable
  width?: number
  height?: number
}

const TAG_SM =
  'inline-flex items-center gap-1 border border-su-black bg-su-white px-1 py-0 font-mono text-xs font-bold uppercase leading-none text-su-black transition-opacity hover:opacity-80'
const TAG_SM_DANGER =
  'inline-flex items-center gap-1 border border-su-black bg-su-rust px-1 py-0 font-mono text-xs font-bold uppercase leading-none text-su-white transition-opacity hover:opacity-80'

export function CardImage({ url, alt, compact, editable, width, height }: CardImageProps) {
  const [showImage, setShowImage] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const displayUrl = editable?.customUrl ?? url

  // Reset the fade-in when the image URL changes so a swapped image fades in
  // instead of snapping to full opacity with the previous image's `loaded`
  // state. Adjusting state during render (vs. an effect) re-renders before
  // commit — no flash of the new image at opacity 1, no extra paint.
  const [loadedUrl, setLoadedUrl] = useState(displayUrl)
  if (displayUrl !== loadedUrl) {
    setLoadedUrl(displayUrl)
    setLoaded(false)
  }

  // Catch images that finished loading before React attached its onLoad handler
  // (cached / preloaded) — for those the load event already fired and won't fire
  // again. Run this in an effect (not a ref callback) and defer the state update to
  // a microtask so it lands after the hydration commit instead of mutating state
  // during it, which would desync the server-rendered markup and force a tree
  // regeneration (React #418).
  // biome-ignore lint/correctness/useExhaustiveDependencies: displayUrl is an intentional extra dep — the cached-load check must re-run whenever the image URL swaps
  useEffect(() => {
    const node = imgRef.current
    if (node?.complete && node.naturalWidth > 0) {
      queueMicrotask(() => setLoaded(true))
    }
  }, [displayUrl])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editable) return
    if (editable.onFileSelected) {
      editable.onFileSelected(file)
    } else {
      const objectUrl = URL.createObjectURL(file)
      editable.onSetCustom(objectUrl)
    }
    e.target.value = ''
  }

  const hasCustom = !!editable?.customUrl
  const containerWidth = compact ? '180px' : '220px'

  // Nothing to show and not editable — hide entirely
  if (!displayUrl && !editable) return null
  // Image failed to load and not editable — hide
  if (!showImage && !editable) return null

  return (
    <div
      className="mx-auto shrink-0 bg-su-white align-top md:mx-0 md:float-left md:mr-4"
      style={{ width: containerWidth, maxWidth: '100%', shapeOutside: 'margin-box' }}
    >
      <div
        className={cn('group relative overflow-hidden', editable && 'rounded')}
        style={displayUrl && showImage && !loaded ? { minHeight: compact ? 120 : 200 } : undefined}
      >
        {displayUrl && showImage ? (
          <img
            ref={imgRef}
            src={displayUrl}
            alt={alt}
            className="block h-auto w-full object-contain transition-opacity duration-300"
            style={{ opacity: loaded ? 1 : 0 }}
            loading="lazy"
            decoding="async"
            {...(width ? { width } : {})}
            {...(height ? { height } : {})}
            onLoad={() => setLoaded(true)}
            onError={() => {
              console.error(`Failed to load image: ${displayUrl}`)
              setShowImage(false)
            }}
          />
        ) : editable ? (
          <div
            className="flex items-center justify-center text-su-grey-dark/30"
            style={{ width: containerWidth, height: containerWidth, maxWidth: '100%' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="2" x2="22" y1="2" y2="22" />
              <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
              <line x1="13.5" x2="6" y1="13.5" y2="21" />
              <line x1="18" x2="21" y1="12" y2="15" />
              <path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59" />
              <path d="M21 15V5a2 2 0 0 0-2-2H9" />
            </svg>
          </div>
        ) : null}

        {/* Editable hover overlay */}
        {editable && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center gap-2 bg-su-black/50 transition-opacity',
              editable.isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {editable.isUploading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-su-white border-t-transparent" />
            ) : hasCustom ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={TAG_SM}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => editable.onSetCustom(null)}
                  className={TAG_SM_DANGER}
                >
                  {editable.removeLabel ?? 'Remove'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={TAG_SM}
              >
                Add Image
              </button>
            )}
          </div>
        )}

        {editable && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        )}
      </div>
    </div>
  )
}
