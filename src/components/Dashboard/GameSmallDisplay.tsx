import { VStack, Box, Flex } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { type LinkProps } from '@tanstack/react-router'
import { UserEntitySmallDisplay } from './UserEntitySmallDisplay'
import { useGame, useGameCrawler, useDeleteGame } from '../../hooks/game/useGames'
import { useGameMembers } from '../../hooks/game/useGameMembers'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { isGameMediator } from '../../lib/permissions'
import { DeleteButton } from '../shared/DeleteButton'

interface GameSmallDisplayProps {
  id: string
  to?: LinkProps['to']
  params?: LinkProps['params']
  onClick?: () => void
  isInactive?: boolean
}

export function GameSmallDisplay({ id, to, params, onClick, isInactive }: GameSmallDisplayProps) {
  const { data: game, isLoading: gameLoading } = useGame(id)
  const { data: members } = useGameMembers(id)
  const { data: crawler } = useGameCrawler(id)
  const { userId } = useCurrentUser()
  const deleteGame = useDeleteGame()

  const mediator = members?.find((m) => m.role === 'mediator')
  const mediatorName = mediator?.user_name || mediator?.user_id
  const crawlerName = crawler?.name

  const isMediator = members && userId ? isGameMediator(members, userId) : false

  if (gameLoading || !game) {
    return (
      <UserEntitySmallDisplay
        to={to}
        params={params}
        onClick={onClick}
        bgColor="su.gameBlue"
        w="full"
        leftHeader="Loading..."
        rightHeader="..."
      />
    )
  }

  const detailContent = (
    <VStack gap={1} alignItems="stretch">
      {crawlerName && (
        <Flex gap={1} alignItems="center">
          <Box bg="su.pink" px={2} py={1} borderRadius="sm" borderWidth="2px" borderColor="black">
            <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
              CRAWLER
            </Text>
          </Box>
          <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
            {crawlerName}
          </Text>
        </Flex>
      )}

      {mediatorName && (
        <Flex gap={1} alignItems="center">
          <Box bg="brand.srd" px={2} py={1} borderRadius="sm" borderWidth="2px" borderColor="black">
            <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
              MEDIATOR
            </Text>
          </Box>
          <Text fontSize="xs" color="su.white" fontWeight="bold" textTransform="uppercase">
            {mediatorName}
          </Text>
        </Flex>
      )}
    </VStack>
  )

  const handleDelete = async () => {
    await deleteGame.mutateAsync(id)
  }

  const deleteButton = isMediator ? (
    <DeleteButton
      entityName="Game"
      onConfirmDelete={handleDelete}
      disabled={deleteGame.isPending}
    />
  ) : undefined

  return (
    <UserEntitySmallDisplay
      to={to}
      params={params}
      onClick={onClick}
      detailLabel="Mediator"
      detailValue={mediatorName || 'Unknown'}
      bgColor="su.gameBlue"
      leftHeader={game.name}
      rightHeader={crawlerName || 'New Game'}
      detailContent={crawlerName || mediatorName ? detailContent : undefined}
      isInactive={isInactive}
      deleteButton={deleteButton}
    />
  )
}
