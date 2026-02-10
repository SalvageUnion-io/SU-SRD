import { Box, Container, VStack } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LiveSheetBanner } from './LiveSheetBanner'

interface LiveSheetLayoutProps {
  children: ReactNode
}

export function LiveSheetLayout({ children }: LiveSheetLayoutProps) {
  return (
    <Box minH="100vh" p="6">
      <Container maxW="9xl">
        <VStack gap={4} alignItems="stretch">
          <LiveSheetBanner />
          {children}
        </VStack>
      </Container>
    </Box>
  )
}
