import { useCallback, useState } from 'react'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { logger } from '../../../lib/logger'

export function EntityImage({ customWidth }: { customWidth?: string }) {
  const { title, compact, assetUrl, imageComponent } = useEntityDisplayContext()
  const [showImage, setShowImage] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // Use a callback ref to catch images that loaded before React attached onLoad
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [])

  if (!showImage || !assetUrl) return null

  const width = customWidth || (compact ? '200px' : '300px')
  const ImageComp = imageComponent || 'img'

  // Only pass ref for native img elements (custom components manage their own rendering)
  const refProps = !imageComponent ? { ref: imgRef } : {}

  return (
    <div
      className="mb-4 shrink-0 bg-su-white align-top md:float-left md:mr-4 md:mb-2"
      style={{
        width,
        maxWidth: '100%',
        shapeOutside: 'margin-box',
      }}
    >
      <ImageComp
        src={assetUrl}
        alt={title}
        className="block h-auto w-full object-contain transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0 }}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          logger.error(`Failed to load image: ${assetUrl}`)
          setShowImage(false)
        }}
        {...refProps}
      />
    </div>
  )
}
