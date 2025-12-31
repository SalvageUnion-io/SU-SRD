'use client'

import { createToaster } from '@chakra-ui/react'

export const toaster: ReturnType<typeof createToaster> = createToaster({
  placement: 'bottom-end',
  pauseOnPageIdle: true,
  gap: 2,
  offsets: {
    bottom: '1rem',
    right: '1rem',
    left: '1rem',
    top: '1rem',
  },
})
