import { Button, Flex, Text } from '@chakra-ui/react'
import type { User } from '@supabase/supabase-js'
import { DiscordSignInButton } from '../DiscordSignInButton'

interface UserMenuProps {
  /** Current user or null if not authenticated */
  user: User | null
  /** Sign out handler */
  onSignOut: () => void
  /** Whether sign out is in progress */
  signingOut: boolean
  /** Optional custom sign in component */
  signInComponent?: React.ReactNode
}

/**
 * User menu component showing user info and sign out button
 * Used in TopNavigation for consistent auth UI
 */
export function UserMenu({ user, onSignOut, signingOut, signInComponent }: UserMenuProps) {
  return (
    <Flex
      alignItems="center"
      gap={4}
      flexDirection={{ base: 'column', lg: 'row' }}
      w={{ base: 'full', lg: 'auto' }}
    >
      {user ? (
        <>
          <Text fontSize="sm" color="su.black" fontWeight="medium">
            {user.user_metadata?.full_name || user.email || 'User'}
          </Text>
          <Button
            onClick={onSignOut}
            disabled={signingOut}
            px={4}
            py={2}
            fontSize="sm"
            color="su.white"
            bg="brand.srd"
            _hover={{ bg: 'su.orange' }}
            _disabled={{ opacity: 0.5 }}
            borderRadius="md"
            h="auto"
            w={{ base: 'full', lg: 'auto' }}
          >
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </>
      ) : (
        signInComponent || (
          <DiscordSignInButton
            px={4}
            py={2}
            fontSize="sm"
            w={{ base: 'full', lg: 'auto' }}
            display="flex"
            alignItems="center"
            gap={2}
          />
        )
      )}
    </Flex>
  )
}
