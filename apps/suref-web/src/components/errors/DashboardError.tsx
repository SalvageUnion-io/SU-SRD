import { Box, Flex, Text } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { Heading } from '../base/Heading'

/**
 * Error component for dashboard routes
 * Provides user-friendly error messages and navigation options
 */
export function DashboardError({ error }: ErrorComponentProps) {
  const navigate = useNavigate()
  const router = useRouter()

  const handleGoHome = () => {
    navigate({ to: '/dashboard' })
  }

  const handleRetry = () => {
    router.invalidate()
  }

  return (
    <Flex alignItems="center" justifyContent="center" minH="60vh" bg="su.white" p={4}>
      <Box
        maxW="md"
        w="full"
        p={6}
        bg="su.lightBlue"
        borderRadius="md"
        shadow="lg"
        borderWidth="2px"
        borderColor="brand.srd"
      >
        <Heading level="h1" fontSize="2xl" fontWeight="bold" mb={4}>
          SYSTEM MALFUNCTION
        </Heading>
        <Text color="su.black" mb={4}>
          Something went wrong while loading your dashboard. This could be a temporary issue.
        </Text>
        <Box
          as="details"
          mb={4}
          p={3}
          bg="su.white"
          borderRadius="md"
          borderWidth="2px"
          borderColor="su.lightOrange"
        >
          <Text as="summary" cursor="pointer" fontWeight="semibold" color="su.black">
            Error Details
          </Text>
          <Text as="pre" mt={2} fontSize="xs" color="brand.srd" overflowY="auto" maxH="40">
            {error?.toString()}
          </Text>
        </Box>
        <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
          <Button
            onClick={handleRetry}
            flex="1"
            px={4}
            py={2}
            bg="su.orange"
            color="su.white"
            borderRadius="md"
            _hover={{ bg: 'brand.srd' }}
            fontWeight="medium"
          >
            Try Again
          </Button>
          <Button
            onClick={handleGoHome}
            flex="1"
            px={4}
            py={2}
            bg="su.green"
            color="su.white"
            borderRadius="md"
            _hover={{ bg: 'brand.srd' }}
            fontWeight="medium"
          >
            Go to Dashboard
          </Button>
        </Flex>
      </Box>
    </Flex>
  )
}
