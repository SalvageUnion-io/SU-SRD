import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, LogIn } from 'lucide-react'
import { DisplayCard, SectionSeparator, Text, ValueDisplay, navigateControl } from 'suref-react'
import type { EntityControl } from 'suref-react'
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

const CONTROL_VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-su-green text-su-white hover:bg-emerald-600',
  danger: 'text-su-white/60 hover:bg-su-rust/80 hover:text-su-white',
  ghost: 'opacity-60 hover:bg-white/20 hover:opacity-100',
}

function ControlButtons({ controls }: { controls: EntityControl[] }) {
  return (
    <div className="flex gap-2">
      {controls.map((control) => {
        const Icon = control.icon
        return (
          <button
            key={control.key}
            type="button"
            className={`flex min-w-[25px] shrink-0 cursor-pointer items-center justify-center self-center rounded p-1 transition-colors ${CONTROL_VARIANT_STYLES[control.variant ?? 'ghost'] ?? ''}`}
            title={control.ariaLabel}
            aria-label={control.ariaLabel}
            onClick={(e) => {
              e.stopPropagation()
              control.onClick()
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}

export function GameSection() {
  const user = useAuthStore((s) => s.user)
  const { data: games, isLoading } = useGames(user?.id)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Games" fontSize="text-sm" />

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
    <>
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <Text
          variant="pseudoheader"
          as="span"
          className="py-[3px] text-base uppercase tracking-[-0.02em]"
          style={{ lineHeight: 1 }}
        >
          {game.name}
        </Text>
        <div className="flex flex-wrap items-center gap-1">
          {game.crawler_id && <ValueDisplay label="Crawler" value="Active" compact />}
          {!game.crawler_id && (
            <Text variant="default" as="span" className="text-xs text-su-white/50">
              No crawler yet
            </Text>
          )}
        </div>
      </div>
      <ControlButtons controls={controls} />
    </>
  )

  return <DisplayCard headerBg="bg-su-pink" headerContent={headerContent} mode="listing" />
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
