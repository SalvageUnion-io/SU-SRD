import { Flex } from '@chakra-ui/react'
import { DiscordSignInButton } from '../DiscordSignInButton'

export function Auth() {
  return (
    <Flex alignItems="center" justifyContent="center" minH="100vh" bg="su.white">
      <DiscordSignInButton px={6} py={3} fontSize="md" fontWeight="bold" />
    </Flex>
  )
}
