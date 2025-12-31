import { useEffect } from 'react'
import { useNavigate, useSearch, Link } from '@tanstack/react-router'
import { Box, Input, Text, VStack } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Heading } from '../base/Heading'
import { redeemInviteCode } from '../../lib/api'
import { logger } from '../../lib/logger'

const codeValidator = z.string().min(1, 'Invite code is required').trim()

export function JoinGame() {
  const search = useSearch({ from: '/dashboard/join' })
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      code: (search as { code?: string }).code || '',
    },
    onSubmit: async ({ value }) => {
      try {
        const gameId = await redeemInviteCode(value.code)
        navigate({ to: '/dashboard/games/$gameId', params: { gameId } })
      } catch (err) {
        logger.error('Failed to join game', err)
        const message = err instanceof Error ? err.message : 'Failed to join game'

        let errorMessage = message
        if (message.includes('invalid_or_expired_code')) {
          errorMessage = 'That invite code is invalid or expired.'
        } else if (message.includes('invite_max_uses_reached')) {
          errorMessage = 'This invite has reached its maximum number of uses.'
        } else if (message.includes('not_authenticated')) {
          errorMessage = 'You must be signed in to join a game.'
        }

        throw new Error(errorMessage)
      }
    },
  })

  useEffect(() => {
    const urlCode = (search as { code?: string }).code
    if (urlCode && urlCode.trim()) {
      form.setFieldValue('code', urlCode)
      form.handleSubmit()
    }
  }, [search, form])

  return (
    <Box p={8} maxW="xl" mx="auto">
      <Button
        asChild
        variant="plain"
        color="brand.srd"
        mb={4}
        _hover={{ textDecoration: 'underline' }}
      >
        <Link to="/dashboard">← Back to Dashboard</Link>
      </Button>
      <Heading level="h1" mb={6}>
        Join a Game
      </Heading>
      <Box
        as="form"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        bg="su.white"
        borderWidth="2px"
        borderColor="su.lightBlue"
        borderRadius="md"
        p={6}
      >
        <VStack gap={4} align="stretch">
          <form.Field
            name="code"
            validators={{
              onChange: ({ value }) => {
                const result = codeValidator.safeParse(value)
                if (!result.success) {
                  return result.error.issues[0]?.message || 'Invalid code'
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <Box>
                <Text
                  as="label"
                  display="block"
                  fontSize="sm"
                  fontWeight="medium"
                  color="su.black"
                  mb={2}
                >
                  Invite Code
                </Text>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter invite code"
                  borderColor="su.lightBlue"
                />
                {field.state.meta.errors.length > 0 && (
                  <Text color="red.600" fontSize="sm" mt={1}>
                    {String(field.state.meta.errors[0])}
                  </Text>
                )}
              </Box>
            )}
          </form.Field>

          {form.state.submissionAttempts > 0 && form.state.errors.length > 0 && (
            <Text color="red.600" fontSize="sm">
              {String(form.state.errors[0])}
            </Text>
          )}

          <Button
            type="submit"
            disabled={form.state.isSubmitting || !form.state.canSubmit}
            bg="brand.srd"
            color="su.white"
            fontWeight="bold"
            py={2}
            px={6}
            _hover={{ opacity: 0.9 }}
            _disabled={{ opacity: 0.5 }}
          >
            {form.state.isSubmitting ? 'Joining…' : 'Join Game'}
          </Button>
        </VStack>
      </Box>
    </Box>
  )
}
