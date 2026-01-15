import { useState, useRef } from 'react'
import { Box, Image, Button, Input } from '@chakra-ui/react'
import { Card } from './Card'

interface LiveSheetAssetDisplayProps {
  url?: string
  userImageUrl?: string
  alt?: string
  bg?: string
  onUpload?: (file: File) => Promise<void>
  onRemove?: () => Promise<void>
  isUploading?: boolean
  isRemoving?: boolean
}

export function LiveSheetAssetDisplay({
  url,
  userImageUrl,
  alt = 'Asset',
  bg = 'gray.100',
  onUpload,
  onRemove,
  isUploading = false,
  isRemoving = false,
}: LiveSheetAssetDisplayProps) {
  const [isHovered, setIsHovered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveClick = async () => {
    if (onRemove) {
      await onRemove()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && onUpload) {
      await onUpload(file)

      event.target.value = ''
    }
  }

  const displayUrl = userImageUrl || url
  const hasUserImage = !!userImageUrl

  return (
    <Card flexShrink={0} bg={bg} minW="300px" maxW="440px">
      <Box
        position="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Box
          borderWidth="3px"
          borderColor="su.black"
          w="full"
          h="300px"
          bg="gray.100"
          borderRadius="md"
          overflow="hidden"
        >
          {displayUrl ? (
            <Image src={displayUrl} alt={alt} w="full" h="full" objectFit="cover" minW="200px" />
          ) : (
            <Box
              minW="212px"
              w="full"
              h="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              No image
            </Box>
          )}
        </Box>

        {onUpload && isHovered && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.600"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            borderRadius="md"
          >
            <Button
              onClick={handleUploadClick}
              bg="su.orange"
              color="su.white"
              _hover={{ bg: 'brand.srd' }}
              loading={isUploading}
              disabled={isUploading || isRemoving}
            >
              {isUploading ? 'Uploading...' : hasUserImage ? 'Change Image' : 'Upload Image'}
            </Button>
            {hasUserImage && onRemove && (
              <Button
                onClick={handleRemoveClick}
                bg="red.600"
                color="su.white"
                _hover={{ bg: 'red.700' }}
                loading={isRemoving}
                disabled={isUploading || isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Remove Image'}
              </Button>
            )}
          </Box>
        )}

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          display="none"
          onChange={handleFileChange}
        />
      </Box>
    </Card>
  )
}
