/**
 * Game-related TanStack Query hooks
 *
 * Centralized exports for all game management hooks
 */

export {
  useGame,
  useUpdateGame,
  useDeleteGame,
  useUserGamesList,
  useGameCrawler,
  gamesKeys,
} from './useGames'
export {
  useGameInvites,
  useCreateGameInvite,
  useExpireGameInvite,
  useRedeemInviteCode,
  gameInvitesKeys,
} from './useGameInvites'
export {
  useExternalLinks,
  useCreateExternalLink,
  useDeleteExternalLink,
  externalLinksKeys,
} from './useExternalLinks'
export { useGameMembers, useUserGameRole, gameMembersKeys } from './useGameMembers'
