import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadImage, deleteImage, updateEntityImage } from '../lib/api/storage'
import { toaster } from '../components/ui/toaster'
import { logger } from '../lib/logger'

interface UseImageUploadOptions {
  entityType: 'pilots' | 'mechs'
  entityId: string
  getCurrentImageUrl: () => string | null | undefined
  queryKey: unknown[]
}

export function useImageUpload({
  entityType,
  entityId,
  getCurrentImageUrl,
  queryKey,
}: UseImageUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const newImageUrl = await uploadImage(file, entityType, entityId)

      const currentImageUrl = getCurrentImageUrl()
      if (currentImageUrl) {
        try {
          await deleteImage(currentImageUrl)
        } catch (error) {
          logger.warn('Failed to delete old image:', error)
        }
      }

      await updateEntityImage(entityType, entityId, newImageUrl)

      return newImageUrl
    },
    onSuccess: (newImageUrl) => {
      queryClient.setQueryData(queryKey, (oldData: unknown) => {
        if (!oldData || typeof oldData !== 'object') return oldData
        return { ...oldData, image_url: newImageUrl }
      })

      toaster.create({
        title: 'Image uploaded successfully',
        type: 'success',
      })
    },
    onError: (error: Error) => {
      toaster.create({
        title: 'Failed to upload image',
        description: error.message,
        type: 'error',
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      const currentImageUrl = getCurrentImageUrl()
      if (currentImageUrl) {
        await deleteImage(currentImageUrl)
      }

      await updateEntityImage(entityType, entityId, null)
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, (oldData: unknown) => {
        if (!oldData || typeof oldData !== 'object') return oldData
        return { ...oldData, image_url: null }
      })

      toaster.create({
        title: 'Image removed successfully',
        type: 'success',
      })
    },
    onError: (error: Error) => {
      toaster.create({
        title: 'Failed to remove image',
        description: error.message,
        type: 'error',
      })
    },
  })

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    try {
      await uploadMutation.mutateAsync(file)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await removeMutation.mutateAsync()
    } finally {
      setIsRemoving(false)
    }
  }

  return {
    handleUpload,
    handleRemove,
    isUploading,
    isRemoving,
  }
}
