import {
  Box,
  Button,
  Flex,
  IconButton,
  Text,
  Spinner,
  Drawer,
  VStack,
  Image,
} from '@chakra-ui/react'
import type { User } from '@supabase/supabase-js'
import { Link } from '@tanstack/react-router'
import { Heading } from '../chakra'
import { useNavigationState } from '../hooks/useNavigationState'
import { DiscordSignInButton } from './DiscordSignInButton'

interface TopNavigationProps {
  user: User | null
  userLoading?: boolean
}

export function TopNavigation({ user, userLoading = false }: TopNavigationProps) {
  const { isOpen, signingOut, handleSignOut, isActive, toggleMenu } = useNavigationState()

  return (
    <>
      <Flex
        h="80px"
        bg="su.white"
        px={6}
        py={3}
        alignItems="center"
        justifyContent="space-between"
        zIndex={45}
      >
        <Button
          asChild
          _hover={{ bg: 'bg.hover' }}
          bg="transparent"
          borderRadius="md"
          variant="ghost"
          h="auto"
          p={2}
          color="fg.default"
        >
          <Link to="/dashboard">
            <Heading level="h2">Salvage Union</Heading>
            <Text fontSize="xs" color="brand.srd">
              Builder
            </Text>
          </Link>
        </Button>

        <IconButton
          onClick={toggleMenu}
          bg="su.orange"
          color="su.white"
          p={2}
          borderRadius="md"
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
            />
          </svg>
        </IconButton>
      </Flex>

      <Drawer.Root open={isOpen} onOpenChange={(e) => !e.open && toggleMenu()}>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Body display="flex" flexDirection="column" h="full" p={6}>
              <VStack gap={2} alignItems="stretch" w="full" h="full" justifyContent="space-between">
                <VStack gap={2} alignItems="stretch" w="full">
                  <Button
                    asChild
                    _hover={{ bg: 'bg.hover' }}
                    bg="transparent"
                    borderRadius="md"
                    variant="ghost"
                    h="auto"
                    p={2}
                    color="fg.default"
                    w="full"
                    justifyContent="center"
                  >
                    <Link to="/dashboard" onClick={toggleMenu}>
                      <Heading level="h2">Salvage Union</Heading>
                      <Text fontSize="xs" color="brand.srd">
                        Builder
                      </Text>
                    </Link>
                  </Button>

                  <VStack
                    as="ul"
                    gap={1}
                    alignItems="stretch"
                    w="full"
                    style={{ listStyle: 'none', padding: 0, margin: 0 }}
                  >
                    <Box as="li" style={{ listStyle: 'none' }}>
                      <Button
                        asChild
                        px={4}
                        py={2}
                        _hover={{ bg: 'bg.hover' }}
                        bg={isActive('/sheets/mech') ? 'bg.active' : 'transparent'}
                        borderBottomWidth={isActive('/sheets/mech') ? '3px' : 0}
                        borderBottomColor="su.orange"
                        color="fg.default"
                        fontWeight={isActive('/sheets/mech') ? 'semibold' : 'normal'}
                        borderRadius="md"
                        variant="ghost"
                        h="auto"
                        w="full"
                        justifyContent="center"
                      >
                        <Link to="/sheets/mech" onClick={toggleMenu}>
                          Mech Playground
                        </Link>
                      </Button>
                    </Box>
                    <Box as="li" style={{ listStyle: 'none' }}>
                      <Button
                        asChild
                        px={4}
                        py={2}
                        _hover={{ bg: 'bg.hover' }}
                        bg={isActive('/sheets/pilot') ? 'bg.active' : 'transparent'}
                        borderBottomWidth={isActive('/sheets/pilot') ? '3px' : 0}
                        borderBottomColor="su.orange"
                        color="fg.default"
                        fontWeight={isActive('/sheets/pilot') ? 'semibold' : 'normal'}
                        borderRadius="md"
                        variant="ghost"
                        h="auto"
                        w="full"
                        justifyContent="center"
                      >
                        <Link to="/sheets/pilot" onClick={toggleMenu}>
                          Pilot Playground
                        </Link>
                      </Button>
                    </Box>
                    <Box as="li" style={{ listStyle: 'none' }}>
                      <Button
                        asChild
                        px={4}
                        py={2}
                        _hover={{ bg: 'bg.hover' }}
                        bg={isActive('/sheets/crawler') ? 'bg.active' : 'transparent'}
                        borderBottomWidth={isActive('/sheets/crawler') ? '3px' : 0}
                        borderBottomColor="su.orange"
                        color="fg.default"
                        fontWeight={isActive('/sheets/crawler') ? 'semibold' : 'normal'}
                        borderRadius="md"
                        variant="ghost"
                        h="auto"
                        w="full"
                        justifyContent="center"
                      >
                        <Link to="/sheets/crawler" onClick={toggleMenu}>
                          Crawler Playground
                        </Link>
                      </Button>
                    </Box>
                  </VStack>

                  {userLoading ? (
                    <Flex
                      alignItems="center"
                      justifyContent="center"
                      w="full"
                      pt={4}
                      borderTopWidth="1px"
                      borderTopColor="border.default"
                    >
                      <Spinner size="sm" color="fg.default" />
                    </Flex>
                  ) : user ? (
                    <>
                      <Box pt={4} borderTopWidth="1px" borderTopColor="border.default" w="full" />
                      <Box as="li" style={{ listStyle: 'none' }}>
                        <Flex
                          px={4}
                          py={2}
                          alignItems="center"
                          justifyContent="center"
                          gap={2}
                          w="full"
                        >
                          {user.user_metadata?.avatar_url && (
                            <Box
                              w="24px"
                              h="24px"
                              borderRadius="full"
                              overflow="hidden"
                              flexShrink={0}
                            >
                              <Image
                                src={user.user_metadata.avatar_url}
                                alt={
                                  user.user_metadata?.preferred_username ||
                                  user.user_metadata?.full_name ||
                                  user.email?.split('@')[0] ||
                                  'User'
                                }
                                w="full"
                                h="full"
                                objectFit="cover"
                              />
                            </Box>
                          )}
                          <Text fontSize="sm" color="fg.default" fontWeight="medium">
                            {user.user_metadata?.preferred_username ||
                              user.user_metadata?.full_name ||
                              user.email?.split('@')[0] ||
                              'User'}
                          </Text>
                        </Flex>
                      </Box>
                      <Box as="li" style={{ listStyle: 'none' }}>
                        <Button
                          asChild
                          px={4}
                          py={2}
                          _hover={{ bg: 'bg.hover' }}
                          bg={isActive('/dashboard/pilots') ? 'bg.active' : 'transparent'}
                          borderBottomWidth={isActive('/dashboard/pilots') ? '3px' : 0}
                          borderBottomColor="su.orange"
                          color="fg.default"
                          fontWeight={isActive('/dashboard/pilots') ? 'semibold' : 'normal'}
                          borderRadius="md"
                          variant="ghost"
                          h="auto"
                          w="full"
                          justifyContent="center"
                        >
                          <Link to="/dashboard/pilots" onClick={toggleMenu}>
                            My Pilots
                          </Link>
                        </Button>
                      </Box>
                      <Box as="li" style={{ listStyle: 'none' }}>
                        <Button
                          asChild
                          px={4}
                          py={2}
                          _hover={{ bg: 'bg.hover' }}
                          bg={isActive('/dashboard/mechs') ? 'bg.active' : 'transparent'}
                          borderBottomWidth={isActive('/dashboard/mechs') ? '3px' : 0}
                          borderBottomColor="su.orange"
                          color="fg.default"
                          fontWeight={isActive('/dashboard/mechs') ? 'semibold' : 'normal'}
                          borderRadius="md"
                          variant="ghost"
                          h="auto"
                          w="full"
                          justifyContent="center"
                        >
                          <Link to="/dashboard/mechs" onClick={toggleMenu}>
                            My Mechs
                          </Link>
                        </Button>
                      </Box>
                      <Box as="li" style={{ listStyle: 'none' }}>
                        <Button
                          asChild
                          px={4}
                          py={2}
                          _hover={{ bg: 'bg.hover' }}
                          bg={isActive('/dashboard/crawlers') ? 'bg.active' : 'transparent'}
                          borderBottomWidth={isActive('/dashboard/crawlers') ? '3px' : 0}
                          borderBottomColor="su.orange"
                          color="fg.default"
                          fontWeight={isActive('/dashboard/crawlers') ? 'semibold' : 'normal'}
                          borderRadius="md"
                          variant="ghost"
                          h="auto"
                          w="full"
                          justifyContent="center"
                        >
                          <Link to="/dashboard/crawlers" onClick={toggleMenu}>
                            My Crawlers
                          </Link>
                        </Button>
                      </Box>
                      <Box as="li" style={{ listStyle: 'none' }}>
                        <Button
                          asChild
                          px={4}
                          py={2}
                          _hover={{ bg: 'bg.hover' }}
                          bg={isActive('/dashboard/games') ? 'bg.active' : 'transparent'}
                          borderBottomWidth={isActive('/dashboard/games') ? '3px' : 0}
                          borderBottomColor="su.orange"
                          color="fg.default"
                          fontWeight={isActive('/dashboard/games') ? 'semibold' : 'normal'}
                          borderRadius="md"
                          variant="ghost"
                          h="auto"
                          w="full"
                          justifyContent="center"
                        >
                          <Link to="/dashboard/games" onClick={toggleMenu}>
                            My Games
                          </Link>
                        </Button>
                      </Box>
                    </>
                  ) : null}
                </VStack>

                <VStack gap={1} alignItems="stretch" w="full">
                  {userLoading ? null : user ? (
                    <Box w="full" pt={4} borderTopWidth="1px" borderTopColor="border.default">
                      <Button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        w="full"
                        px={4}
                        py={3}
                        fontSize="sm"
                        color="su.white"
                        bg="brand.srd"
                        _hover={{ bg: 'su.orange' }}
                        _disabled={{ opacity: 0.5 }}
                        borderRadius="md"
                        fontWeight="medium"
                        h="auto"
                      >
                        {signingOut ? 'Signing out...' : 'Sign Out'}
                      </Button>
                    </Box>
                  ) : (
                    <Box w="full" pt={4} borderTopWidth="1px" borderTopColor="border.default">
                      <DiscordSignInButton
                        px={4}
                        py={3}
                        fontSize="sm"
                        w="full"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={2}
                      />
                    </Box>
                  )}
                </VStack>
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  )
}
