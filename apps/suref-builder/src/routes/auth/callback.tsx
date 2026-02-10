import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Box, Flex, Text, Spinner } from '@chakra-ui/react'

function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    // Regular OAuth callback - redirect to dashboard which handles the callback
    // The dashboard component will process the OAuth code exchange
    // We need to preserve the query parameters in the URL so Dashboard can read them
    const dashboardParams = new URLSearchParams()
    if (code) dashboardParams.append('code', code)
    if (state) dashboardParams.append('state', state)
    if (error) dashboardParams.append('error', error)

    const dashboardUrl = dashboardParams.toString()
      ? `/dashboard?${dashboardParams.toString()}`
      : '/dashboard'

    window.location.replace(dashboardUrl)
  }, [])

  return (
    <Flex
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      bg="su.white"
    >
      <Box textAlign="center">
        <Spinner size="xl" color="su.discordBlurple" mb={4} />
        <Text fontSize="lg" color="su.black">
          Processing authentication...
        </Text>
      </Box>
    </Flex>
  )
}

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      code: search.code ? String(search.code) : undefined,
      state: search.state ? String(search.state) : undefined,
      error: search.error ? String(search.error) : undefined,
    }
  },
  head: () => ({
    meta: [
      {
        title: 'Authenticating - Salvage Union',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
})
