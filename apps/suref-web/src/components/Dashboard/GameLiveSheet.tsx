import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { Box, Flex, VStack, HStack, Grid } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { Button } from '@chakra-ui/react'

import { ExternalLinkModal } from './ExternalLinkModal'
import { GameInfo } from './GameInfo'
import { PilotMechCell } from './PilotMechCell'
import { ActiveToggle } from '../shared/ActiveToggle'
import { PrivateToggle } from '../shared/PrivateToggle'
import { PermissionError } from '../shared/PermissionError'
import { Card } from '../shared/Card'
import { LiveSheetLayout } from '../shared/LiveSheetLayout'
import { ControlBarContainer } from '../shared/ControlBarContainer'
import { useCreateEntity } from '../../hooks/useCreateEntity'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { isGameMediator } from '../../lib/permissions'
import {
  useGame,
  useGameCrawler,
  useUpdateGame,
  useDeleteGame,
  useGameInvites,
  useCreateGameInvite,
  useExpireGameInvite,
  useExternalLinks,
  useCreateExternalLink,
  useDeleteExternalLink,
} from '../../hooks/game'
import { useGameMembers } from '../../hooks/game/useGameMembers'
import type { GameInvite } from '../../lib/api/games'
import { ValueDisplay } from '../shared/ValueDisplay'
import { CrawlerSmallDisplay } from './CrawlerSmallDisplay'
import { logger } from '../../lib/logger'

type GameInviteRow = GameInvite

export function GameLiveSheet() {
  const { gameId } = useParams({ strict: false })
  const navigate = useNavigate()

  const { userId } = useCurrentUser()

  const { data: game, isLoading: gameLoading, error: gameError } = useGame(gameId)

  const { data: members = [] } = useGameMembers(gameId)

  const { data: crawler } = useGameCrawler(gameId)

  const isMediator = useMemo(() => {
    if (!members || !userId) return false
    return isGameMediator(members, userId)
  }, [members, userId])

  const isEditable = isMediator

  const updateGameMutation = useUpdateGame()
  const deleteGameMutation = useDeleteGame()

  const {
    data: invites = [],
    isLoading: invitesLoading,
    error: inviteQueryError,
  } = useGameInvites(isMediator ? gameId : undefined)
  const createInviteMutation = useCreateGameInvite()
  const expireInviteMutation = useExpireGameInvite()

  const {
    data: externalLinks = [],
    isLoading: linksLoading,
    error: linksQueryError,
  } = useExternalLinks(gameId)
  const createLinkMutation = useCreateExternalLink()
  const deleteLinkMutation = useDeleteExternalLink()

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)

  const inviteError = inviteQueryError?.message || null
  const linksError = linksQueryError?.message || null
  const deleteError = deleteGameMutation.error?.message || null

  const { createEntity: createCrawler, isLoading: isCreatingCrawler } = useCreateEntity({
    table: 'crawlers',
    navigationPath: (id: string) => `/dashboard/crawlers/${id}`,
    placeholderData: gameId ? { game_id: gameId, active: true } : undefined,
  })

  const isInviteActive = (inv: GameInviteRow) => {
    const now = new Date()
    const notExpired = !inv.expires_at || new Date(inv.expires_at) > now
    const uses = inv.uses ?? 0
    const underUses = inv.max_uses == null || uses < inv.max_uses
    return notExpired && underUses
  }

  const activeInvites = useMemo(() => invites.filter(isInviteActive), [invites])

  const createInvite = async () => {
    if (!gameId) return
    await createInviteMutation.mutateAsync(gameId)
  }

  const handleCreateExternalLink = async (name: string, url: string) => {
    if (!gameId) return
    await createLinkMutation.mutateAsync({ gameId, url, name })
    setIsLinkModalOpen(false)
  }

  const deleteExternalLinkHandler = async (linkId: string) => {
    if (!gameId) return
    await deleteLinkMutation.mutateAsync({ linkId, gameId })
  }

  const handleDeleteGame = async () => {
    if (!gameId) return
    const confirmMsg =
      'This will permanently delete this game and un-assign any associated models (like crawlers). This cannot be undone. Are you sure?'
    const ok = window.confirm(confirmMsg)
    if (!ok) return

    await deleteGameMutation.mutateAsync(gameId)
    navigate({ to: '/dashboard' })
  }

  useEffect(() => {
    if (!gameId) {
      navigate({ to: '/dashboard' })
      return
    }
  }, [gameId, navigate])

  if (gameLoading) {
    return (
      <Box p={8}>
        <Flex align="center" justify="center" minH="60vh">
          <Text fontSize="xl" color="brand.srd">
            Loading game...
          </Text>
        </Flex>
      </Box>
    )
  }

  const error = gameError?.message || null

  if (error || !game) {
    if (
      error &&
      (error.includes('permission') || error.includes('private') || error.includes('access'))
    ) {
      return <PermissionError message={error} />
    }

    return (
      <Box p={8}>
        <VStack align="center" justify="center" minH="60vh" gap={4}>
          <Text fontSize="xl" color="red.600">
            {error || 'Game not found'}
          </Text>
          <Button
            asChild
            bg="brand.srd"
            color="su.white"
            fontWeight="bold"
            py={2}
            px={6}
            _hover={{ opacity: 0.9 }}
          >
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </VStack>
      </Box>
    )
  }

  return (
    <LiveSheetLayout>
      <ControlBarContainer
        backgroundColor="su.gameBlue"
        hasPendingChanges={updateGameMutation.isPending}
        leftContent={
          <HStack gap={4}>
            <ActiveToggle
              active={game.active ?? false}
              onChange={(active) => {
                if (!gameId) return
                updateGameMutation.mutate({
                  id: gameId,
                  updates: { active },
                })
              }}
              disabled={!isEditable}
            />
            <PrivateToggle
              isPrivate={game.private ?? true}
              onChange={(isPrivate) => {
                if (!gameId) return
                updateGameMutation.mutate({
                  id: gameId,
                  updates: { private: isPrivate },
                })
              }}
              disabled={!isEditable}
            />
          </HStack>
        }
      />

      <Flex gap={4} direction={{ base: 'column', lg: 'row' }} align="stretch">
        <VStack flex="1" gap={4} align="stretch">
          <GameInfo
            name={game.name}
            description={game.description}
            onNameChange={(value) => {
              if (!gameId) return
              updateGameMutation.mutate({
                id: gameId,
                updates: { name: value },
              })
            }}
            onDescriptionChange={(value) => {
              if (!gameId) return
              updateGameMutation.mutate({
                id: gameId,
                updates: { description: value },
              })
            }}
            disabled={!isEditable}
          />
          {crawler ? (
            <CrawlerSmallDisplay id={crawler.id} />
          ) : (
            <Flex align="center" justify="center" p={4}>
              <Button
                onClick={async () => {
                  try {
                    await createCrawler()
                  } catch (err) {
                    logger.error('Failed to create crawler:', err)
                  }
                }}
                bg="su.white"
                color="su.crawlerPink"
                fontWeight="bold"
                py={2}
                px={4}
                _hover={{ opacity: 0.9 }}
                disabled={!isEditable || isCreatingCrawler}
              >
                {isCreatingCrawler ? 'Creating...' : '+ Create Crawler'}
              </Button>
            </Flex>
          )}

          {crawler && members.length > 0 && (
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} w="full">
              {members.map(
                (member) =>
                  member.role === 'player' && (
                    <PilotMechCell
                      key={member.user_id}
                      memberId={member.user_id}
                      crawlerId={crawler.id}
                      displayName={member.user_name}
                    />
                  )
              )}
            </Grid>
          )}

          {isMediator && (
            <Card bg="red.600" title="Danger Zone">
              <VStack gap={2} align="stretch" p={4}>
                {deleteError && (
                  <Text color="red.200" fontSize="sm">
                    {deleteError}
                  </Text>
                )}
                <Button
                  onClick={handleDeleteGame}
                  disabled={!isEditable || deleteGameMutation.isPending}
                  w="full"
                  bg="su.white"
                  color="red.600"
                  fontWeight="bold"
                  py={3}
                  px={4}
                  _hover={{ bg: 'red.100' }}
                  _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  {deleteGameMutation.isPending ? 'Deleting...' : 'DELETE THIS GAME'}
                </Button>
                <Text fontSize="xs" color="su.white" textAlign="center">
                  This will permanently delete this game and all associated data. This action cannot
                  be undone.
                </Text>
              </VStack>
            </Card>
          )}
        </VStack>

        <VStack w={{ base: 'full', lg: '400px' }} gap={4} align="stretch" flexShrink={0}>
          <Card bg="su.gameBlue" title="Members">
            <VStack gap={2} align="stretch" w="full">
              {members.map((member) => (
                <ValueDisplay
                  key={member.user_id}
                  label={member.role.toUpperCase()}
                  value={
                    member.user_name ?? member.user_email ?? `User ${member.user_id.slice(0, 8)}`
                  }
                  inline={false}
                />
              ))}
            </VStack>
          </Card>

          {isMediator && (
            <Card
              bg="su.gameBlue"
              title="Invites"
              rightContent={
                activeInvites.length === 0 ? (
                  <Button
                    onClick={createInvite}
                    bg="brand.srd"
                    color="su.white"
                    fontWeight="bold"
                    fontSize="sm"
                    py={1}
                    px={3}
                    _hover={{ opacity: 0.9 }}
                  >
                    + Create
                  </Button>
                ) : undefined
              }
            >
              {inviteError && (
                <Text color="red.600" p={4} fontSize="sm">
                  {inviteError}
                </Text>
              )}
              {invitesLoading ? (
                <Text color="brand.srd" p={4}>
                  Loading invites…
                </Text>
              ) : activeInvites.length === 0 ? (
                <Text color="brand.srd" p={4}>
                  No invites yet.
                </Text>
              ) : (
                <VStack gap={2} align="stretch" p={4}>
                  {activeInvites.map((inv) => (
                    <Box key={inv.id} p={2} bg="su.white" borderRadius="md">
                      <Text fontSize="xs" color="brand.srd">
                        Uses: {inv.uses}
                        {inv.max_uses ? ` / ${inv.max_uses}` : ''}
                      </Text>
                      <Flex gap={2} mt={1} alignItems="center">
                        <Text fontSize="xs" color="su.black" fontFamily="mono" flex="1">
                          {inv.code}
                        </Text>
                        <Button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/dashboard/join?code=${inv.code}`
                            )
                          }
                          variant="plain"
                          color="brand.srd"
                          fontSize="xs"
                          p={1}
                          _hover={{ textDecoration: 'underline' }}
                        >
                          Copy
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!gameId) return
                            await expireInviteMutation.mutateAsync({
                              inviteId: inv.id,
                              gameId,
                            })
                          }}
                          variant="plain"
                          color="brand.srd"
                          fontSize="xs"
                          p={1}
                          _hover={{ textDecoration: 'underline' }}
                        >
                          Expire
                        </Button>
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              )}
            </Card>
          )}

          <Card
            bg="su.gameBlue"
            title="Resources"
            rightContent={
              isMediator ? (
                <Button
                  onClick={() => setIsLinkModalOpen(true)}
                  bg="brand.srd"
                  color="su.white"
                  fontWeight="bold"
                  fontSize="sm"
                  py={1}
                  px={3}
                  _hover={{ opacity: 0.9 }}
                >
                  + Add
                </Button>
              ) : undefined
            }
          >
            {linksError && (
              <Text color="red.600" p={4} fontSize="sm">
                {linksError}
              </Text>
            )}
            {linksLoading ? (
              <Text color="brand.srd" p={4}>
                Loading resources…
              </Text>
            ) : externalLinks.length === 0 ? (
              <Text color="brand.srd" p={4}>
                No external links yet.
              </Text>
            ) : (
              <VStack gap={2} align="stretch" p={4}>
                {externalLinks.map((link) => (
                  <Flex
                    key={link.id}
                    align="center"
                    justify="space-between"
                    p={2}
                    bg="su.white"
                    borderRadius="md"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'inherit',
                        fontWeight: 'medium',
                        flex: 1,
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {link.name}
                    </a>
                    {isMediator && (
                      <Button
                        onClick={() => {
                          if (window.confirm(`Delete "${link.name}"?`)) {
                            deleteExternalLinkHandler(link.id)
                          }
                        }}
                        variant="plain"
                        color="brand.srd"
                        fontSize="sm"
                        p={1}
                        _hover={{ color: 'red.700' }}
                      >
                        ✕
                      </Button>
                    )}
                  </Flex>
                ))}
              </VStack>
            )}
          </Card>
        </VStack>
      </Flex>

      <ExternalLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onAdd={handleCreateExternalLink}
      />
    </LiveSheetLayout>
  )
}
