import { useCallback, useEffect, useRef, useState } from 'react'

/** How long a copy control shows its Check before it goes back. */
const COPIED_MS = 2000

/**
 * A copy control's confirmation state (chrome K5): `flash()` after the
 * clipboard write lands, and `copied` is true for two seconds. The control
 * draws it as its own `Check` swap (`CopiedIcon`) and a polite live region
 * (`CopiedStatus`), never a toast.
 */
export function useCopied(): { copied: boolean; flash: () => void } {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback(() => {
    clearTimeout(timer.current)
    setCopied(true)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }, [])
  return { copied, flash }
}
