import { Box, Image } from '@chakra-ui/react'
import { useState } from 'react'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { logger } from '../../../lib/logger'

export function EntityImage({ customWidth }: { customWidth?: string }) {
  const { title, compact, assetUrl } = useEntityDisplayContext()
  const [showImage, setShowImage] = useState(true)

  if (!showImage || !assetUrl) return null

  const width = customWidth || (compact ? '200px' : '300px')

  return (
    <Box
      bg="su.white"
      width={width}
      float="left"
      marginRight={4}
      marginBottom={2}
      marginTop={0}
      shapeOutside="margin-box"
      flexShrink={0}
      verticalAlign="top"
    >
      <Image
        src={assetUrl}
        alt={title}
        w="full"
        h="auto"
        objectFit="contain"
        display="block"
        loading="lazy"
        decoding="async"
        onError={() => {
          logger.error(`Failed to load image: ${assetUrl}`)
          setShowImage(false)
        }}
      />
    </Box>
  )
}
