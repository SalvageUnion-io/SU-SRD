import { supabase } from '../supabase'

const BUCKET_NAME = 'user-images'

/**
 * Upload an image file to Supabase storage
 * Files are stored in user-specific folders: {userId}/{entityType}/{entityId}/{filename}
 */
export async function uploadImage(
  file: File,
  entityType: 'pilots' | 'mechs',
  entityId: string
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User must be authenticated to upload images')
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.')
  }

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('File size must be less than 5MB')
  }

  const timestamp = Date.now()
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${user.id}/${entityType}/${entityId}/${timestamp}-${sanitizedFilename}`

  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path)

  return publicUrl
}

/**
 * Delete an image from Supabase storage
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  const urlParts = imageUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`)
  if (urlParts.length !== 2 || !urlParts[1]) {
    throw new Error('Invalid image URL format')
  }

  const filePath = urlParts[1]

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath])

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`)
  }
}

/**
 * Update entity with new image URL
 */
export async function updateEntityImage(
  entityType: 'pilots' | 'mechs',
  entityId: string,
  imageUrl: string | null
): Promise<void> {
  const { error } = await supabase
    .from(entityType)
    .update({ image_url: imageUrl })
    .eq('id', entityId)

  if (error) {
    throw new Error(`Failed to update ${entityType} image: ${error.message}`)
  }
}
