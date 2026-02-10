import { useState, useCallback } from 'react'
import { Box, Button, Flex, IconButton, Menu, Text, Drawer, VStack } from '@chakra-ui/react'
import type { SchemaInfo } from '../types/schema'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { Heading } from 'suref-react'

interface TopNavigationProps {
  schemas?: SchemaInfo[]
}

export function TopNavigation({ schemas = [] }: TopNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), [])

  const handleNavigate = useCallback(
    (path: string) => {
      navigate({ to: path })
      setIsOpen(false)
    },
    [navigate]
  )

  const isActive = useCallback(
    (path: string) => location.pathname.startsWith(path),
    [location.pathname]
  )

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
          <Link to="/">
            <Heading level="h2">Salvage Union</Heading>
            <Text fontSize="xs" color="brand.srd">
              SRD
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
                    <Link to="/" onClick={toggleMenu}>
                      <Heading level="h2">Salvage Union</Heading>
                      <Text fontSize="xs" color="brand.srd">
                        SRD
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
                      <Menu.Root>
                        <Menu.Trigger asChild>
                          <Button
                            px={4}
                            py={2}
                            _hover={{ bg: 'bg.hover' }}
                            bg={isActive('/schema') ? 'bg.active' : 'transparent'}
                            borderBottomWidth={isActive('/schema') ? '3px' : 0}
                            borderBottomColor="su.orange"
                            color="fg.default"
                            fontWeight={isActive('/schema') ? 'semibold' : 'normal'}
                            borderRadius="md"
                            variant="ghost"
                            h="auto"
                            w="full"
                            justifyContent="center"
                          >
                            Reference
                          </Button>
                        </Menu.Trigger>
                        <Menu.Positioner>
                          <Menu.Content
                            maxH="300px"
                            minW="200px"
                            overflowY="auto"
                            bg="bg.canvas"
                            borderColor="border.default"
                          >
                            {schemas.map((schema) => (
                              <Menu.Item
                                key={schema.id}
                                value={schema.id}
                                onSelect={() => {
                                  handleNavigate(`/schema/${schema.id}`)
                                }}
                                color="fg.default"
                              >
                                {schema.displayName || schema.title.replace('Salvage Union ', '')}
                              </Menu.Item>
                            ))}
                          </Menu.Content>
                        </Menu.Positioner>
                      </Menu.Root>
                    </Box>

                    <Box as="li" style={{ listStyle: 'none' }}>
                      <Button
                        asChild
                        px={4}
                        py={2}
                        _hover={{ bg: 'bg.hover' }}
                        bg={isActive('/randsum') ? 'bg.active' : 'transparent'}
                        borderBottomWidth={isActive('/randsum') ? '3px' : 0}
                        borderBottomColor="su.orange"
                        color="fg.default"
                        fontWeight={isActive('/randsum') ? 'semibold' : 'normal'}
                        borderRadius="md"
                        variant="ghost"
                        h="auto"
                        w="full"
                        justifyContent="center"
                      >
                        <Link to="/randsum" onClick={toggleMenu}>
                          Discord Bot
                        </Link>
                      </Button>
                    </Box>
                  </VStack>
                </VStack>

                <VStack gap={1} alignItems="stretch" w="full">
                  <Box w="full" pt={4} borderTopWidth="1px" borderTopColor="border.default">
                    <Button
                      asChild
                      px={4}
                      py={2}
                      _hover={{ bg: 'bg.hover' }}
                      bg={isActive('/about') ? 'bg.active' : 'transparent'}
                      borderBottomWidth={isActive('/about') ? '3px' : 0}
                      borderBottomColor="su.orange"
                      color="fg.default"
                      fontWeight={isActive('/about') ? 'semibold' : 'normal'}
                      borderRadius="md"
                      variant="ghost"
                      h="auto"
                      w="full"
                      justifyContent="center"
                    >
                      <Link to="/about" onClick={toggleMenu}>
                        About
                      </Link>
                    </Button>
                  </Box>
                </VStack>
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  )
}
