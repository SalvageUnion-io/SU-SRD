import { useEffect, useState } from 'react'
import { createRootRoute, Outlet, Scripts, HeadContent } from '@tanstack/react-router'
import { Box, Flex, ChakraProvider, VStack, Button } from '@chakra-ui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { TopNavigation } from '../components/TopNavigation'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { GlobalLoadingBar } from '../components/shared/GlobalLoadingBar'
import Footer from '../components/Footer'
import { getSchemaCatalog } from 'salvageunion-reference'
import { getSession, onAuthStateChange } from '../lib/api'
import type { User } from '@supabase/supabase-js'
import { Toaster } from '../components/ui/ToasterComponent'
import { EntityViewerModalProvider } from '../providers/EntityViewerModalProvider'
import { ThemeProvider } from '../providers/ThemeProvider'
import { fetchCurrentUser } from '../lib/supabase.server'
import { system } from '../theme'
import { queryClient } from '../lib/queryClient'
import type React from 'react'
import { Heading } from '../components/base/Heading'
import { Text } from '../components/base/Text'
import { initPerformanceMonitoring } from '../lib/performance'

const schemaIndexData = getSchemaCatalog()

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  beforeLoad: async () => {
    const serverUser = await fetchCurrentUser()
    return {
      serverUser,
    }
  },
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ChakraProvider value={system}>{children}</ChakraProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    getSession().then((session) => {
      setUser(session?.user ?? null)
      setUserLoading(false)
    })

    const subscription = onAuthStateChange((authUser) => {
      setUser(authUser)
      setUserLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Initialize performance monitoring
  useEffect(() => {
    initPerformanceMonitoring()
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Salvage Union System Reference Document</title>
        {/* Initialize theme immediately to prevent flash - explicitly set to light mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('chakra-ui-color-mode', 'light');
              })();
            `,
          }}
        />
        {/* Resource hints for faster external resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://*.supabase.co" />
        <link rel="dns-prefetch" href="https://*.supabase.in" />
        {/* Preload critical font */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap"
          as="style"
        />
        {/* Content Security Policy - includes localhost for local development */}
        {/* Note: CSP in meta tag applies to local dev; Netlify headers override in production */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost http://127.0.0.1 https://*.supabase.co https://*.netlify.app;"
        />
        <HeadContent />
      </head>
      <body>
        <Providers>
          <ErrorBoundary>
            <EntityViewerModalProvider>
              <GlobalLoadingBar />
              <Flex flexDirection="column" h="100vh" bg="bg.canvas">
                <TopNavigation
                  user={user}
                  userLoading={userLoading}
                  schemas={schemaIndexData.schemas.filter((s) => !s.meta)}
                />
                <Box as="main" flex="1" display="flex" bg="bg.landing" flexDirection="column">
                  {children}
                </Box>
                <Footer />
              </Flex>
              <Toaster />
            </EntityViewerModalProvider>
          </ErrorBoundary>
        </Providers>
        <Scripts />
      </body>
    </html>
  )
}

function NotFoundComponent() {
  return (
    <Flex alignItems="center" justifyContent="center" minH="80vh" bg="bg.surface" p={4}>
      <Box
        maxW="2xl"
        w="full"
        p={8}
        bg="bg.canvas"
        borderRadius="md"
        shadow="lg"
        borderWidth="2px"
        borderColor="brand.srd"
      >
        <VStack gap={6} alignItems="center">
          <Heading level="h1" fontSize="6xl" fontWeight="bold" color="brand.srd">
            404
          </Heading>
          <Heading
            level="h2"
            fontSize="2xl"
            fontWeight="bold"
            textAlign="center"
            color="fg.default"
          >
            SALVAGE OPERATION FAILED
          </Heading>
          <Text color="fg.default" textAlign="center" fontSize="lg">
            The page you're looking for has been lost to the wastes. It might have been scrapped,
            relocated, or never existed in the first place.
          </Text>

          <Box w="full" mt={4}>
            <Text color="brand.srd" fontWeight="semibold" mb={2}>
              Try one of these instead:
            </Text>
            <VStack gap={2} alignItems="stretch">
              <Button
                asChild
                w="full"
                px={4}
                py={2}
                bg="su.orange"
                color="su.white"
                borderRadius="md"
                _hover={{ bg: 'brand.srd' }}
                fontWeight="medium"
              >
                <a href="/">Return to Home</a>
              </Button>
              <Button
                asChild
                w="full"
                px={4}
                py={2}
                bg="su.green"
                color="su.white"
                borderRadius="md"
                _hover={{ bg: 'brand.srd' }}
                fontWeight="medium"
              >
                <a href="/">Browse Reference Data</a>
              </Button>
            </VStack>
          </Box>

          <Box w="full" mt={6} pt={6} borderTopWidth="2px" borderTopColor="border.default">
            <Text color="brand.srd" fontWeight="semibold" mb={3} fontSize="sm">
              Popular Schemas:
            </Text>
            <Flex flexWrap="wrap" gap={2}>
              {schemaIndexData.schemas
                .filter((s) => !s.meta)
                .slice(0, 6)
                .map((schema) => (
                  <Button
                    key={schema.id}
                    asChild
                    size="sm"
                    px={3}
                    py={1}
                    bg="bg.surface"
                    color="fg.default"
                    borderRadius="md"
                    _hover={{ bg: 'su.orange', color: 'su.white' }}
                    fontSize="xs"
                  >
                    <a href={`/schema/${schema.id}`}>{schema.displayName}</a>
                  </Button>
                ))}
            </Flex>
          </Box>
        </VStack>
      </Box>
    </Flex>
  )
}
