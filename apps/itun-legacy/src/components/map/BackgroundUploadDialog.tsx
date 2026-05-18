import { useCallback, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { uploadMapImage, deleteMapImage } from '../../lib/api/storageApi'
import { getErrorMessage } from '../../lib/errors'

type BackgroundUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUrl: string | null
  userId: string
  onSave: (url: string | null) => void
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 5

export function BackgroundUploadDialog({
  open,
  onOpenChange,
  currentUrl,
  userId,
  onSave,
}: BackgroundUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const resetState = useCallback(() => {
    setPreview(null)
    setSelectedFile(null)
    setUploading(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please select a PNG, JPEG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_SIZE_MB}MB.`)
      return
    }

    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const url = await uploadMapImage(userId, selectedFile)
      onSave(url)
      resetState()
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }, [selectedFile, userId, onSave, resetState, onOpenChange])

  const handleRemove = useCallback(async () => {
    if (!currentUrl) return
    setUploading(true)
    try {
      await deleteMapImage(currentUrl)
      onSave(null)
      resetState()
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }, [currentUrl, onSave, resetState, onOpenChange])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) resetState()
      onOpenChange(isOpen)
    },
    [onOpenChange, resetState]
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-su-grey-dark bg-su-grey-dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-white">Background Image</DialogTitle>
          <DialogDescription className="text-su-white/60">
            Upload an image for the map background.
          </DialogDescription>
        </DialogHeader>

        {/* Current image preview */}
        {currentUrl && !preview && (
          <div className="relative overflow-hidden rounded border border-su-grey-light/20">
            <img
              src={currentUrl}
              alt="Current background"
              className="max-h-40 w-full object-contain"
            />
            <span className="absolute bottom-1 left-1 rounded bg-su-dark/80 px-1.5 py-0.5 font-mono text-xs text-su-white/50">
              Current
            </span>
          </div>
        )}

        {/* New file preview */}
        {preview && (
          <div className="relative overflow-hidden rounded border border-su-pink/40">
            <img src={preview} alt="Upload preview" className="max-h-40 w-full object-contain" />
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="absolute right-1 top-1 rounded bg-su-dark/80 p-0.5 text-su-white/60 hover:text-su-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="absolute bottom-1 left-1 rounded bg-su-dark/80 px-1.5 py-0.5 font-mono text-xs text-su-pink">
              New
            </span>
          </div>
        )}

        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        {!preview && (
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 border border-dashed border-su-grey-light/30 text-su-white/60 hover:border-su-pink/40 hover:text-su-white"
          >
            <Upload className="h-4 w-4" />
            Choose Image
          </Button>
        )}

        <DialogFooter className="gap-2">
          {currentUrl && !preview && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={uploading}
              className="text-su-rust hover:text-su-rust"
            >
              {uploading ? 'Removing...' : 'Remove'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => handleClose(false)} className="text-su-white/70">
            Cancel
          </Button>
          {preview && (
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-su-pink text-su-white hover:bg-su-pink/80"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
