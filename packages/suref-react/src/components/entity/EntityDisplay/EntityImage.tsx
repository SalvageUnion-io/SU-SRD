import { useCallback, useState } from 'react'
import type { EntityImageComponent } from './entityDisplayTypes'
import { logger } from '../../../lib/logger'

type EntityImageProps = {
  title: string
  compact: boolean
  assetUrl: string
  imageComponent?: EntityImageComponent
  customWidth?: string
}

export function EntityImage({
  title,
  compact,
  assetUrl,
  imageComponent,
  customWidth,
}: EntityImageProps) {
  const [showImage, setShowImage] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // Use a callback ref to catch images that loaded before React attached onLoad
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [])

  if (!showImage || !assetUrl) return null

  const width = customWidth || (compact ? '120px' : '300px')
  const ImageComp = imageComponent || 'img'

  // Only pass ref for native img elements (custom components manage their own rendering)
  const refProps = !imageComponent ? { ref: imgRef } : {}

  return (
    <div
      className="shrink-0 bg-su-white align-top md:float-left md:mr-4"
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
