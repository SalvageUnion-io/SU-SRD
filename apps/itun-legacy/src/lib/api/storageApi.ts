import { supabase } from '../supabase'
import { handleSupabaseError } from '../errors'

const MAP_IMAGES_BUCKET = 'map-images'
const ENTITY_IMAGES_BUCKET = 'entity-images'

export async function uploadMapImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(MAP_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) handleSupabaseError(error)

  const { data } = supabase.storage.from(MAP_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteMapImage(publicUrl: string): Promise<void> {
  // Extract path from public URL: ...map-images/userId/filename.ext
  const marker = `/${MAP_IMAGES_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return
  const path = publicUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(MAP_IMAGES_BUCKET).remove([path])
  if (error) handleSupabaseError(error)
}

export async function uploadEntityImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(ENTITY_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) handleSupabaseError(error)

  const { data } = supabase.storage.from(ENTITY_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteEntityImage(publicUrl: string): Promise<void> {
  const marker = `/${ENTITY_IMAGES_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return
  const path = publicUrl.slice(idx + marker.length)

  const { error } = await supabase.storage.from(ENTITY_IMAGES_BUCKET).remove([path])
  if (error) console.warn('Failed to delete entity image:', error.message)
}
