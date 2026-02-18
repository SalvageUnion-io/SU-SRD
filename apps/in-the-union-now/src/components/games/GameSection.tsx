import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, LogIn } from 'lucide-react'
import {
  DisplayCard,
  CardHeader,
  SectionSeparator,
  Text,
  ValueDisplay,
  navigateControl,
} from 'suref-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { useGames, useJoinGame } from '../../hooks/useGames'
import { Skeleton } from '../ui/skeleton'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { getErrorMessage } from '../../lib/errors'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import type { CampaignRow } from '../../types/common'

export function GameSection() {
  const user = useAuthStore((s) => s.user)
  const [showArchived, setShowArchived] = useState(false)
  const { data: games, isLoading } = useGames(user?.id, showArchived)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Games" fontSize="text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
          className="h-6 px-2 font-mono text-xs uppercase text-su-white/50 hover:text-su-white"
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </SectionSeparator>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {games?.map((game) => (
            <GameListing key={game.id} game={game} />
          ))}
          <div className="flex gap-2">
            <NewGameSlot />
            <JoinGameSlot />
          </div>
        </div>
      )}
    </div>
  )
}

function GameListing({ game }: { game: CampaignRow }) {
  const navigate = useNavigate()

  const handleNavigate = useCallback(() => {
    navigate({ to: '/games/$gameId', params: { gameId: game.id } })
  }, [navigate, game.id])

  const controls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])

  const headerContent = (
    <CardHeader
      title={game.name}
      subtitle={
        <div className="flex flex-wrap items-center gap-1">
          {game.archived && (
            <span className="rounded bg-su-orange/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-su-white">
              Archived
            </span>
          )}
          {game.crawler_id && <ValueDisplay label="Crawler" value="Active" compact />}
          {!game.crawler_id && (
            <Text variant="default" as="span" className="text-xs text-su-white/50">
              No crawler yet
            </Text>
          )}
        </div>
      }
      compact
    />
  )

  return (
    <DisplayCard
      headerBg="bg-su-pink"
      headerContent={headerContent}
      mode="listing"
      controls={controls}
    />
  )
}

function NewGameSlot() {
  return (
    <Link to="/games/new" className="block flex-1">
      <div className={EMPTY_SLOT_CLASSES}>
        <Plus className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold uppercase">New Game</span>
      </div>
    </Link>
  )
}

function JoinGameSlot() {
  const user = useAuthStore((s) => s.user)
  const joinGame = useJoinGame()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [open, setOpen] = useState(false)

  const handleJoin = useCallback(() => {
    if (!user || !code.trim()) return
    joinGame.mutate(
      { userId: user.id, inviteCode: code.trim() },
      {
        onSuccess: (campaign) => {
          toast.success(`Joined "${campaign.name}"!`)
          setOpen(false)
          setCode('')
          navigate({ to: '/games/$gameId', params: { gameId: campaign.id } })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      }
    )
  }, [user, code, joinGame, navigate])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className={`${EMPTY_SLOT_CLASSES} flex-1`}>
          <LogIn className="h-4 w-4" />
          <span className="font-mono text-sm font-semibold uppercase">Join Game</span>
        </div>
      </DialogTrigger>
      <DialogContent className="border-su-grey-dark bg-su-grey-dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-white">Join a Game</DialogTitle>
          <DialogDescription className="text-su-white/60">
            Enter the invite code shared by your Mediator.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="INVITE CODE"
            maxLength={6}
            className="font-mono text-lg uppercase tracking-widest"
          />
          <Button
            onClick={handleJoin}
            disabled={code.trim().length < 6 || joinGame.isPending}
            className={actionButtonClasses('green')}
          >
            {joinGame.isPending ? 'Joining...' : 'Join'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
