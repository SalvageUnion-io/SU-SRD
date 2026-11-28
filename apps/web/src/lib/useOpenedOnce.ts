import { useState } from 'react'

/**
 * Whether `open` has ever been true: a lazily loaded dialog mounts on its
 * first opening and then stays mounted, so it closes, animates and returns
 * focus exactly as an always-mounted one does. Until then the sheet carries
 * none of its code.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened || open
}
