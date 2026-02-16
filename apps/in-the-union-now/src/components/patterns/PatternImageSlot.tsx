import { useRef } from 'react'
import { ImageOff, ImagePlus, Replace, X } from 'lucide-react'

type PatternImageSlotProps = {
  defaultImageUrl?: string
  customImageUrl?: string | null
  onSetCustomImage?: (url: string | null) => void
  alt?: string
  compact?: boolean
  readOnly?: boolean
}

const TAG_BUTTON_BASE =
  'inline-flex items-center gap-1 border border-su-black font-mono font-bold uppercase leading-none transition-opacity hover:opacity-80'
const TAG_BUTTON_SM = `${TAG_BUTTON_BASE} bg-su-white px-1 py-0 text-xs text-su-black`
const TAG_BUTTON_SM_DANGER = `${TAG_BUTTON_BASE} bg-su-rust px-1 py-0 text-xs text-su-white`

export function PatternImageSlot({
  defaultImageUrl,
  customImageUrl,
  onSetCustomImage,
  alt = 'Pattern image',
  compact,
  readOnly,
}: PatternImageSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const displayUrl = customImageUrl ?? defaultImageUrl
  const hasCustomImage = !!customImageUrl
  const showControls = !readOnly && onSetCustomImage

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Create a local object URL for preview (future: upload to Supabase Storage)
    const url = URL.createObjectURL(file)
    onSetCustomImage!(url)
    e.target.value = ''
  }

  return (
    <div
      className="shrink-0 align-top md:float-left md:mr-4 md:mb-4"
      style={{ width: compact ? '180px' : '300px', maxWidth: '100%', shapeOutside: 'margin-box' }}
    >
      <div className="group relative aspect-square overflow-hidden rounded border border-dashed border-su-grey-light/50 bg-su-grey-light/10">
        {displayUrl ? (
          <img src={displayUrl} alt={alt} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-su-grey-dark/30">
            <ImageOff className="h-12 w-12" />
          </div>
        )}

        {/* Hover overlay */}
        {showControls && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-su-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {hasCustomImage ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={TAG_BUTTON_SM}
                >
                  <Replace className="h-3 w-3" />
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => onSetCustomImage(null)}
                  className={TAG_BUTTON_SM_DANGER}
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={TAG_BUTTON_SM}
              >
                <ImagePlus className="h-3 w-3" />
                Add Image
              </button>
            )}
          </div>
        )}

        {showControls && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        )}
      </div>
    </div>
  )
}
