import { useRouter } from '@tanstack/react-router'
import { Progress } from '@chakra-ui/react'

/**
 * Global loading bar that appears during route navigation
 * Uses TanStack Router's built-in pending state
 */
export function GlobalLoadingBar() {
  const router = useRouter()
  const isPending = router.state.isLoading

  if (!isPending) return null

  return (
    <Progress.Root
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={9999}
      size="xs"
      colorPalette="orange"
      value={null}
    >
      <Progress.Track bg="bg.canvas">
        <Progress.Range bg="su.orange" />
      </Progress.Track>
    </Progress.Root>
  )
}
