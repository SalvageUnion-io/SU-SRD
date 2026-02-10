import { Box, VStack, Heading, Text, Button } from '@chakra-ui/react'
import { Link } from '@tanstack/react-router'

interface PermissionErrorProps {
  message?: string
  showHomeButton?: boolean
}

/**
 * Error screen shown when user doesn't have permission to view a resource
 */
export function PermissionError({
  message = 'You do not have permission to view this resource',
  showHomeButton = true,
}: PermissionErrorProps) {
  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="su.lightBlue"
      p={4}
    >
      <VStack gap={6} maxW="600px" textAlign="center">
        <Heading size="2xl" color="su.black">
          Access Denied
        </Heading>

        <Text fontSize="lg" color="su.black">
          {message}
        </Text>

        <Text fontSize="md" color="su.black">
          This resource is private. If you believe you should have access, please contact the owner
          or check that you're logged in with the correct account.
        </Text>

        {showHomeButton && (
          <Button asChild bg="su.orange" color="su.white" _hover={{ opacity: 0.8 }} size="lg">
            <Link to="/">Go to Home</Link>
          </Button>
        )}
      </VStack>
    </Box>
  )
}
