import { useState } from 'react'
import { Button, Flex } from '@chakra-ui/react'
import type { ButtonProps } from '@chakra-ui/react'
import { signInWithDiscord } from '../lib/api'
import { DiscordIcon } from './shared/DiscordIcon'
import { logger } from '../lib/logger'

interface DiscordSignInButtonProps extends ButtonProps {
  redirectTo?: string
}

export function DiscordSignInButton({ redirectTo, ...props }: DiscordSignInButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDiscordLogin = async () => {
    try {
      setLoading(true)

      const defaultRedirect =
        typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '/dashboard'
      await signInWithDiscord(redirectTo || defaultRedirect)
    } catch (error) {
      logger.error('Error signing in:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleDiscordLogin}
      disabled={loading}
      px={6}
      py={3}
      fontSize="md"
      fontWeight="bold"
      color="su.white"
      bg="su.discordBlurple"
      _hover={{ opacity: 0.9 }}
      _disabled={{ opacity: 0.5 }}
      borderRadius="md"
      h="auto"
      {...props}
    >
      <Flex align="center" gap={2}>
        <DiscordIcon />
        {loading ? 'Signing in...' : 'Sign in with Discord'}
      </Flex>
    </Button>
  )
}
