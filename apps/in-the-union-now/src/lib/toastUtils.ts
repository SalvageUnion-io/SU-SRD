import { toast } from 'sonner'

export function showSaveToast(message?: string) {
  toast.success(message ?? 'Saved', { id: 'autosave', duration: 1500 })
}
