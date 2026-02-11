import { useState } from 'react'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { logger } from '../../../lib/logger'

export function EntityImage({ customWidth }: { customWidth?: string }) {
  const { title, compact, assetUrl } = useEntityDisplayContext()
  const [showImage, setShowImage] = useState(true)

  if (!showImage || !assetUrl) return null

  const width = customWidth || (compact ? '200px' : '300px')

  return (
    <div
      className="mr-4 mb-2 shrink-0 bg-su-white align-top"
      style={{
        width,
        float: 'left',
        shapeOutside: 'margin-box',
      }}
    >
      <img
        src={assetUrl}
        alt={title}
        className="block h-auto w-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => {
          logger.error(`Failed to load image: ${assetUrl}`)
          setShowImage(false)
        }}
      />
    </div>
  )
}
