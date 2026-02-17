import { useCallback, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, Copy, Trash2 } from 'lucide-react'
import { SectionSeparator, DisplayCard, Text, ValueDisplay } from 'suref-react'
import { toast } from 'sonner'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useAuthStore } from '../../../../stores/authStore'
import { useGame, useGameMembers, useDeleteGame } from '../../../../hooks/useGames'
import { useCrawler } from '../../../../hooks/useCrawlers'
import {
  usePilots,
  usePilotsForCrawler,
  useAssignPilotToCrawler,
} from '../../../../hooks/usePilots'
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
import type { CampaignMemberRow, CampaignRow, PilotRow } from '../../../../types/common'

export const Route = createFileRoute('/_authenticated/games/$gameId/')({
  component: GameShowPage,
})

function GameShowPage() {
  const { gameId } = Route.useParams()
  const user = useAuthStore((s) => s.user)
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: members, isLoading: membersLoading } = useGameMembers(gameId)

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
      </div>

      <CrawlerSection game={game} isMediator={isMed} />

      <MembersSection members={members ?? []} />

      {game.crawler_id && <AssignedPilotsSection crawlerId={game.crawler_id} isMediator={isMed} />}

      {isMed && <InviteCodeSection game={game} />}

      {isMed && <DangerZone game={game} />}
    </div>
  )
}

function CrawlerSection({ game, isMediator }: { game: CampaignRow; isMediator: boolean }) {
  const { data: crawler } = useCrawler(game.crawler_id ?? undefined)

  if (game.crawler_id && crawler) {
    const headerContent = (
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <Text
          variant="pseudoheader"
          as="span"
          className="py-[3px] text-base uppercase tracking-[-0.02em]"
          style={{ lineHeight: 1 }}
        >
          {crawler.name || 'Unnamed Crawler'} {crawler.tag ? `#${crawler.tag}` : ''}
        </Text>
        <div className="flex flex-wrap items-center gap-1">
          <ValueDisplay label="SP" value={`${crawler.current_sp}/${crawler.max_sp}`} compact />
          <ValueDisplay label="TL" value={crawler.tech_level} compact />
          <ValueDisplay label="Upkeep" value={crawler.upkeep} compact />
        </div>
      </div>
    )

    return (
      <div className="flex flex-col gap-3">
        <SectionSeparator label="Crawler" fontSize="text-sm" />
        <Link to="/games/$gameId/crawler" params={{ gameId: game.id }}>
          <DisplayCard headerBg="bg-su-pink" headerContent={headerContent} mode="listing" />
        </Link>
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

function MembersSection({ members }: { members: CampaignMemberRow[] }) {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Players" fontSize="text-sm" />
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow key={member.id} member={member} isYou={member.user_id === user?.id} />
        ))}
        {members.length === 0 && <p className="text-sm text-su-grey-dark">No players yet.</p>}
      </div>
    </div>
  )
}

function MemberRow({ member, isYou }: { member: CampaignMemberRow; isYou: boolean }) {
  const roleColor = member.role === 'mediator' ? 'bg-su-pink/80' : 'bg-su-grey-dark/50'

  return (
    <div className="flex items-center justify-between rounded-md border border-su-grey-light/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <Text variant="pseudoheader" as="span" className="text-sm uppercase">
          {isYou ? 'You' : `Player ${member.user_id.slice(0, 6)}`}
        </Text>
      </div>
      <span
        className={`rounded px-2 py-0.5 font-mono text-xs uppercase text-su-white/80 ${roleColor}`}
      >
        {member.role}
      </span>
    </div>
  )
}

function AssignedPilotsSection({
  crawlerId,
  isMediator,
}: {
  crawlerId: string
  isMediator: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const { data: assignedPilots } = usePilotsForCrawler(crawlerId)
  const { data: myPilots } = usePilots(user?.id)
  const assignPilot = useAssignPilotToCrawler()

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
        {assignedPilots?.map((pilot) => (
          <PilotAssignmentRow
            key={pilot.id}
            pilot={pilot}
            canUnassign={isMediator || pilot.user_id === user?.id}
            onUnassign={() => handleUnassign(pilot.id)}
          />
        ))}
        {(!assignedPilots || assignedPilots.length === 0) && (
          <p className="text-sm text-su-grey-dark">No pilots assigned yet.</p>
        )}
      </div>

      {unassignedPilots.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text variant="default" as="p" className="text-xs text-su-white/50">
            Assign one of your pilots:
          </Text>
          {unassignedPilots.map((pilot) => (
            <PilotAssignmentRow
              key={pilot.id}
              pilot={pilot}
              canAssign
              onAssign={() => handleAssign(pilot.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PilotAssignmentRow({
  pilot,
  canAssign,
  canUnassign,
  onAssign,
  onUnassign,
}: {
  pilot: PilotRow
  canAssign?: boolean
  canUnassign?: boolean
  onAssign?: () => void
  onUnassign?: () => void
}) {
  const pilotClassName = useMemo(() => {
    const cls = SalvageUnionReference.get('classes', pilot.class_ref)
    return cls?.name ?? 'Unknown'
  }, [pilot.class_ref])

  return (
    <div className="flex items-center justify-between rounded-md border border-su-grey-light/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <Text variant="pseudoheader" as="span" className="text-sm uppercase">
          {pilot.callsign}
        </Text>
        <ValueDisplay label="Class" value={pilotClassName} compact />
      </div>
      {canAssign && onAssign && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAssign}
          className="h-7 text-xs text-su-green hover:bg-su-green/20"
        >
          <Plus className="mr-1 h-3 w-3" />
          Assign
        </Button>
      )}
      {canUnassign && onUnassign && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnassign}
          className="h-7 text-xs text-su-rust hover:bg-su-rust/20"
        >
          Remove
        </Button>
      )}
    </div>
  )
}

function InviteCodeSection({ game }: { game: CampaignRow }) {
  const handleCopy = useCallback(() => {
    if (game.invite_code) {
      navigator.clipboard.writeText(game.invite_code)
      toast.success('Invite code copied!')
    }
  }, [game.invite_code])

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
        >
          <Copy className="h-4 w-4" />
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
  const user = useAuthStore((s) => s.user)
  const deleteGameMutation = useDeleteGame()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = useCallback(() => {
    if (!user) return
    deleteGameMutation.mutate(
      { gameId: game.id, userId: user.id },
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
  }, [user, game, deleteGameMutation, navigate])

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Danger Zone" fontSize="text-sm" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="w-fit gap-1.5 text-su-rust hover:bg-su-rust/20 hover:text-su-rust"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Game
      </Button>

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
