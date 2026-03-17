import { memo, useCallback, useMemo, useState } from 'react'
import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  ShieldMinus,
  Archive,
  ArchiveRestore,
  Map,
} from 'lucide-react'
import { SectionSeparator, Text, navigateControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../../hooks/useCurrentUser'
import {
  useGame,
  useGameMembers,
  useDeleteGame,
  useRegenerateInviteCode,
  useArchiveGame,
} from '../../../../hooks/useGames'
import { useCrawler } from '../../../../hooks/useCrawlers'
import { PlayerCrawlerDisplay } from '../../../../components/games/PlayerCrawlerDisplay'
import { PlayerPilotDisplay } from '../../../../components/pilots/PlayerPilotDisplay'
import {
  usePilots,
  usePilotsForCrawler,
  usePilotAbilityCounts,
  useAssignPilotToCrawler,
} from '../../../../hooks/usePilots'
import { useMechMap } from '../../../../hooks/useMechMap'
import {
  usePromoteMember,
  useSelfDemote,
  useUninviteMember,
} from '../../../../hooks/useCampaignMembers'
import { isMediator, getMemberRole } from '../../../../lib/gameUtils'
import { getErrorMessage } from '../../../../lib/errors'
import { actionButtonClasses } from '../../../../components/shared/actionButtonClasses'
import { EMPTY_SLOT_CLASSES } from '../../../../components/patterns/emptySlotClasses'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../../components/shared/NotFoundState'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { useRealtimeSubscription } from '../../../../hooks/useRealtimeSubscription'
import { useActivityFeed } from '../../../../hooks/useActivityFeed'
import { gameKeys } from '../../../../hooks/useGames'
import type { CampaignMemberRow, CampaignRow } from '../../../../types/common'

export const Route = createLazyFileRoute('/_authenticated/games/$gameId/')({
  component: GameShowPage,
})

function GameShowPage() {
  const { gameId } = Route.useParams()
  const user = useCurrentUser()
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: members, isLoading: membersLoading } = useGameMembers(gameId)

  // Activity feed: scoped to this game's entities
  const gameCrawlerId = game?.crawler_id
  const relevantIds = useMemo(() => {
    const ids = new Set<string>([gameId])
    if (gameCrawlerId) ids.add(gameCrawlerId)
    return ids
  }, [gameId, gameCrawlerId])
  useActivityFeed(user?.id, relevantIds)

  // Realtime: sync campaign members and game data across clients
  useRealtimeSubscription('campaign_members', `campaign_id=eq.${gameId}`, [
    gameKeys.members(gameId),
  ])
  useRealtimeSubscription('campaigns', `id=eq.${gameId}`, [gameKeys.detail(gameId)])

  if (gameLoading || membersLoading) return <PageSkeleton />
  if (!game) return <NotFoundState message="Game not found." />

  const role = members ? getMemberRole(members, user?.id ?? '') : null
  const isMed = members ? isMediator(members, user?.id ?? '') : false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-su-pink">{game.name}</h1>
        {role && (
          <span className="rounded bg-su-grey-dark px-2 py-0.5 font-mono text-xs uppercase text-su-white/70">
            {role}
          </span>
        )}
        {game.archived && (
          <span className="rounded bg-su-orange/80 px-2 py-0.5 font-mono text-xs uppercase text-su-white">
            Archived
          </span>
        )}
      </div>

      <Link
        to="/games/$gameId/map"
        params={{ gameId }}
        className="flex items-center gap-2 rounded border border-su-grey-light/20 bg-su-grey-dark/50 px-3 py-2 font-mono text-sm text-su-white/70 hover:border-su-pink/40 hover:text-su-pink"
      >
        <Map className="h-4 w-4" />
        Campaign Map
      </Link>

      <CrawlerSection game={game} isMediator={isMed} />

      <MembersSection gameId={gameId} members={members ?? []} isMediator={isMed} />

      {game.crawler_id && <AssignedPilotsSection crawlerId={game.crawler_id} isMediator={isMed} />}

      {isMed && <InviteCodeSection game={game} />}

      {isMed && <DangerZone game={game} />}
    </div>
  )
}

function CrawlerSection({ game, isMediator }: { game: CampaignRow; isMediator: boolean }) {
  const { data: crawler } = useCrawler(game.crawler_id ?? undefined)

  if (game.crawler_id && crawler) {
    return (
      <div className="flex flex-col gap-3">
        <SectionSeparator label="Crawler" fontSize="text-sm" />
        <PlayerCrawlerDisplay game={game} crawler={crawler} listing compact={false} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Crawler" fontSize="text-sm" />
      {isMediator ? (
        <Link to="/games/$gameId/create-crawler" params={{ gameId: game.id }} className="block">
          <div className={EMPTY_SLOT_CLASSES}>
            <Plus className="h-4 w-4" />
            <span className="font-mono text-sm font-semibold uppercase">Create Crawler</span>
          </div>
        </Link>
      ) : (
        <p className="text-sm text-su-grey-dark">No crawler yet. The Mediator will create one.</p>
      )}
    </div>
  )
}

function MembersSection({
  gameId,
  members,
  isMediator: isMed,
}: {
  gameId: string
  members: CampaignMemberRow[]
  isMediator: boolean
}) {
  const user = useCurrentUser()
  const promote = usePromoteMember()
  const demote = useSelfDemote()
  const uninvite = useUninviteMember()

  const handlePromote = useCallback(
    (userId: string) => {
      promote.mutate(
        { campaignId: gameId, userId },
        {
          onSuccess: () => toast.success('Promoted to Mediator.'),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [gameId, promote]
  )

  const handleSelfDemote = useCallback(() => {
    demote.mutate(
      { campaignId: gameId },
      {
        onSuccess: () => toast.success('Demoted to Player.'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [gameId, demote])

  const handleUninvite = useCallback(
    (userId: string) => {
      uninvite.mutate(
        { campaignId: gameId, userId },
        {
          onSuccess: () => toast.success('Member removed.'),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [gameId, uninvite]
  )

  const mediatorCount = useMemo(
    () => members.filter((m) => m.role === 'mediator').length,
    [members]
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Players" fontSize="text-sm" />
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isYou={member.user_id === user?.id}
            isMediator={isMed}
            isSoleMediator={member.role === 'mediator' && mediatorCount === 1}
            onPromote={() => handlePromote(member.user_id)}
            onUninvite={() => handleUninvite(member.user_id)}
            onSelfDemote={handleSelfDemote}
          />
        ))}
        {members.length === 0 && <p className="text-sm text-su-grey-dark">No players yet.</p>}
      </div>
    </div>
  )
}

const MemberRow = memo(function MemberRow({
  member,
  isYou,
  isMediator: isMed,
  isSoleMediator,
  onPromote,
  onUninvite,
  onSelfDemote,
}: {
  member: CampaignMemberRow
  isYou: boolean
  isMediator: boolean
  isSoleMediator: boolean
  onPromote: () => void
  onUninvite: () => void
  onSelfDemote: () => void
}) {
  const roleColor = member.role === 'mediator' ? 'bg-su-pink/80' : 'bg-su-grey-dark/50'
  const isMemberMediator = member.role === 'mediator'

  return (
    <div className="flex items-center justify-between rounded-md border border-su-grey-light/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <Text variant="pseudoheader" as="span" className="text-sm uppercase">
          {isYou ? 'You' : `Player ${member.user_id.slice(0, 6)}`}
        </Text>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-xs uppercase text-su-white/80 ${roleColor}`}
        >
          {member.role}
        </span>
      </div>
      {isMed && (
        <div className="flex items-center gap-1">
          {isYou && isMemberMediator && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelfDemote}
              disabled={isSoleMediator}
              className="h-7 gap-1 text-xs text-su-orange hover:bg-su-orange/20 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                isSoleMediator ? 'A game needs at least one Mediator' : 'Demote yourself to Player'
              }
            >
              <ShieldMinus className="h-3 w-3" />
              Demote
            </Button>
          )}
          {!isYou && !isMemberMediator && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPromote}
              className="h-7 gap-1 text-xs text-su-green hover:bg-su-green/20"
              title="Promote to Mediator"
            >
              <ShieldCheck className="h-3 w-3" />
              Promote
            </Button>
          )}
          {!isYou && !isMemberMediator && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUninvite}
              className="h-7 gap-1 text-xs text-su-rust hover:bg-su-rust/20"
              title="Remove from campaign"
            >
              <UserMinus className="h-3 w-3" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  )
})

function AssignedPilotsSection({
  crawlerId,
  isMediator,
}: {
  crawlerId: string
  isMediator: boolean
}) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { data: assignedPilots } = usePilotsForCrawler(crawlerId)
  const { data: myPilots } = usePilots(user?.id)
  const assignPilot = useAssignPilotToCrawler()

  const allPilots = useMemo(
    () => [...(assignedPilots ?? []), ...(myPilots?.filter((p) => !p.crawler_id) ?? [])],
    [assignedPilots, myPilots]
  )
  const pilotIds = useMemo(() => allPilots.map((p) => p.id), [allPilots])
  const { data: abilityCounts } = usePilotAbilityCounts(pilotIds)

  const mechIds = useMemo(
    () => allPilots.map((p) => p.mech_id).filter((id): id is string => !!id),
    [allPilots]
  )
  const { mechMap } = useMechMap(mechIds)

  // Pilots owned by user that are not yet assigned to any crawler
  const unassignedPilots = useMemo(() => myPilots?.filter((p) => !p.crawler_id) ?? [], [myPilots])

  const handleAssign = useCallback(
    (pilotId: string) => {
      if (!user) return
      assignPilot.mutate(
        { pilotId, crawlerId, userId: user.id },
        {
          onSuccess: (pilot) => {
            toast.success(`${pilot.callsign} assigned to crawler!`)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, crawlerId, assignPilot]
  )

  const handleUnassign = useCallback(
    (pilotId: string) => {
      if (!user) return
      assignPilot.mutate(
        { pilotId, crawlerId: null, userId: user.id, oldCrawlerId: crawlerId },
        {
          onSuccess: (pilot) => {
            toast.success(`${pilot.callsign} unassigned from crawler.`)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, crawlerId, assignPilot]
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Assigned Pilots" fontSize="text-sm" />
      <div className="flex flex-col gap-2">
        {assignedPilots?.map((pilot) => {
          const navControl = navigateControl(() =>
            navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
          )
          const removeControls: ReferenceEntityControl[] = [
            navControl,
            ...(isMediator || pilot.user_id === user?.id
              ? [
                  {
                    key: 'unassign',
                    label: 'Remove',
                    onClick: () => handleUnassign(pilot.id),
                    ariaLabel: 'Remove from crawler',
                    variant: 'danger' as const,
                  },
                ]
              : []),
          ]
          return (
            <PlayerPilotDisplay
              key={pilot.id}
              pilot={pilot}
              listing
              compact
              abilityCount={abilityCounts?.[pilot.id] ?? 0}
              mech={pilot.mech_id ? (mechMap.get(pilot.mech_id) ?? null) : null}
              controls={removeControls}
            />
          )
        })}
        {(!assignedPilots || assignedPilots.length === 0) && (
          <p className="text-sm text-su-grey-dark">No pilots assigned yet.</p>
        )}
      </div>

      {unassignedPilots.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text variant="default" as="p" className="text-xs text-su-white/50">
            Assign one of your pilots:
          </Text>
          {unassignedPilots.map((pilot) => {
            const assignControls: ReferenceEntityControl[] = [
              navigateControl(() =>
                navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
              ),
              {
                key: 'assign',
                label: 'Assign',
                onClick: () => handleAssign(pilot.id),
                ariaLabel: 'Assign to crawler',
                bgColor: 'var(--color-su-pink)',
              },
            ]
            return (
              <PlayerPilotDisplay
                key={pilot.id}
                pilot={pilot}
                listing
                compact
                abilityCount={abilityCounts?.[pilot.id] ?? 0}
                mech={pilot.mech_id ? (mechMap.get(pilot.mech_id) ?? null) : null}
                controls={assignControls}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function InviteCodeSection({ game }: { game: CampaignRow }) {
  const regenerate = useRegenerateInviteCode()

  const handleCopy = useCallback(() => {
    if (game.invite_code) {
      navigator.clipboard.writeText(game.invite_code)
      toast.success('Invite code copied!')
    }
  }, [game.invite_code])

  const handleRegenerate = useCallback(() => {
    regenerate.mutate(
      { gameId: game.id },
      {
        onSuccess: () => toast.success('Invite code regenerated.'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [game.id, regenerate])

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Invite Code" fontSize="text-sm" />
      <div className="flex items-center gap-3">
        <code className="rounded bg-su-grey-dark px-3 py-1.5 font-mono text-lg tracking-widest text-su-white">
          {game.invite_code ?? '------'}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="text-su-white/60 hover:text-su-white"
          title="Copy invite code"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
          className="text-su-white/60 hover:text-su-white"
          title="Generate new invite code"
        >
          <RefreshCw className={`h-4 w-4 ${regenerate.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-xs text-su-grey-dark">
        Share this code with players so they can join your game.
      </p>
    </div>
  )
}

function DangerZone({ game }: { game: CampaignRow }) {
  const navigate = useNavigate()
  const deleteGameMutation = useDeleteGame()
  const archiveGameMutation = useArchiveGame()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleArchiveToggle = useCallback(() => {
    archiveGameMutation.mutate(
      { gameId: game.id, archived: !game.archived },
      {
        onSuccess: (data) => {
          toast.success(data.archived ? 'Game archived.' : 'Game restored.')
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }, [game.id, game.archived, archiveGameMutation])

  const handleDelete = useCallback(() => {
    deleteGameMutation.mutate(
      { gameId: game.id },
      {
        onSuccess: () => {
          toast.success(`Game "${game.name}" deleted.`)
          navigate({ to: '/' })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      }
    )
  }, [game, deleteGameMutation, navigate])

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Danger Zone" fontSize="text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleArchiveToggle}
          disabled={archiveGameMutation.isPending}
          className="w-fit gap-1.5 text-su-orange hover:bg-su-orange/20 hover:text-su-orange"
        >
          {game.archived ? (
            <>
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore Game
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5" />
              Archive Game
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowConfirm(true)}
          className="w-fit gap-1.5 text-su-rust hover:bg-su-rust/20 hover:text-su-rust"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Game
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="border-su-grey-dark bg-su-grey-dark sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-su-white">Delete Game</DialogTitle>
            <DialogDescription className="text-su-white/60">
              This will permanently delete &ldquo;{game.name}&rdquo; and all associated data. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              className="text-su-white/70"
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteGameMutation.isPending}
              className={actionButtonClasses('rust')}
            >
              {deleteGameMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
