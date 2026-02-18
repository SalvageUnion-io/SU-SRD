import { toast } from 'sonner'

export function showSaveToast() {
  toast.success('Saved', { id: 'autosave', duration: 1500 })
}
