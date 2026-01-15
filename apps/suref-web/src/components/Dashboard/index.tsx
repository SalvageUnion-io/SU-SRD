import { useEffect, useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Box, Flex, Text } from '@chakra-ui/react'
import { getSession, onAuthStateChange } from '../../lib/api'
import type { User } from '@supabase/supabase-js'
import { Auth } from './Auth'
import { logger } from '../../lib/logger'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const hash = window.location.hash

      if (code) {
        const pkceVerifier = localStorage.getItem('supabase.auth.token')
        logger.log('PKCE verifier in storage:', pkceVerifier ? 'found' : 'NOT FOUND')

        await new Promise((resolve) => setTimeout(resolve, 1000))

        const session = await getSession()
        logger.log('Session after code exchange:', session ? 'found' : 'not found')

        if (session) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } else if (hash) {
        await new Promise((resolve) => setTimeout(resolve, 100))

        window.history.replaceState({}, document.title, window.location.pathname)
      }

      const session = await getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    handleAuthCallback()

    const subscription = onAuthStateChange((authUser) => {
      setUser(authUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <Flex
        flexDirection="column"
        flex="1"
        alignItems="center"
        justifyContent="center"
        bg="su.white"
      >
        <Text fontSize="lg" color="su.black">
          Loading...
        </Text>
      </Flex>
    )
  }

  if (!user) {
    return (
      <Flex flexDirection="column" flex="1" pt={{ base: 20, lg: 0 }}>
        <Box flex="1" display="flex" alignItems="center" justifyContent="center">
          <Auth />
        </Box>
      </Flex>
    )
  }

  return (
    <Flex flexDirection="column" flex="1" pt={{ base: 20, lg: 0 }}>
      <Box flex="1" display="flex" flexDirection="column">
        <Outlet />
      </Box>
    </Flex>
  )
}
