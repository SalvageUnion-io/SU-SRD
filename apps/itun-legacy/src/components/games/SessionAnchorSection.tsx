import { useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'
import { SectionSeparator, Text, FilterChip } from 'suref-react'
import { usePilotsForCrawler } from '../../hooks/usePilots'
import { useUpdateSessionState } from '../../hooks/useGames'
import type { CampaignRow } from '../../types/common'
import type { SessionState } from '../../lib/sessionStateUtils'

type SessionAnchorSectionProps = {
  game: CampaignRow
  isMediator: boolean
  crawlerId: string | null
}

function parseSessionState(raw: CampaignRow['session_state']): SessionState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const s = raw as Record<string, unknown>
  return {
    round_number: typeof s.round_number === 'number' ? s.round_number : 0,
    initiative_winner:
      s.initiative_winner === 'players' || s.initiative_winner === 'npcs'
        ? s.initiative_winner
        : null,
    active_encounter_id: typeof s.active_encounter_id === 'string' ? s.active_encounter_id : null,
  }
}

export function SessionAnchorSection({ game, isMediator, crawlerId }: SessionAnchorSectionProps) {
  const { data: assignedPilots } = usePilotsForCrawler(crawlerId ?? undefined)
  const updateSessionState = useUpdateSessionState()

  const sessionState = parseSessionState(game.session_state)
  const roundNumber = sessionState?.round_number ?? 0
  const initiativeWinner = sessionState?.initiative_winner ?? null
  const activeEncounterId = sessionState?.active_encounter_id ?? null

  const handlePatch = useCallback(
    (patch: Partial<SessionState>) => {
      updateSessionState.mutate({ gameId: game.id, existing: sessionState, patch })
    },
    [game.id, sessionState, updateSessionState]
  )

  const handleDecrement = useCallback(() => {
    if (updateSessionState.isPending) return
    handlePatch({ round_number: Math.max(0, roundNumber - 1) })
  }, [handlePatch, roundNumber, updateSessionState.isPending])

  const handleIncrement = useCallback(() => {
    if (updateSessionState.isPending) return
    handlePatch({ round_number: roundNumber + 1 })
  }, [handlePatch, roundNumber, updateSessionState.isPending])

  const handleInitiativeToggle = useCallback(
    (value: 'players' | 'npcs') => {
      if (updateSessionState.isPending) return
      handlePatch({ initiative_winner: initiativeWinner === value ? null : value })
    },
    [handlePatch, initiativeWinner, updateSessionState.isPending]
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Session" fontSize="text-sm" />

      {/* Round counter */}
      <div className="flex items-center gap-3">
        <Text variant="default" as="span" className="font-mono text-xs uppercase text-su-white/60">
          Round
        </Text>
        <div className="flex items-center gap-2">
          {isMediator ? (
            <button
              type="button"
              onClick={handleDecrement}
              disabled={updateSessionState.isPending || roundNumber <= 0}
              className="flex h-6 w-6 items-center justify-center rounded border border-su-grey-light/20 text-su-white/60 hover:border-su-pink/40 hover:text-su-pink disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrement round"
            >
              <Minus className="h-3 w-3" />
            </button>
          ) : null}
          <span className="min-w-[2rem] text-center font-mono text-lg font-bold text-su-white">
            {roundNumber}
          </span>
          {isMediator ? (
            <button
              type="button"
              onClick={handleIncrement}
              disabled={updateSessionState.isPending}
              className="flex h-6 w-6 items-center justify-center rounded border border-su-grey-light/20 text-su-white/60 hover:border-su-pink/40 hover:text-su-pink disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Increment round"
            >
              <Plus className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Group initiative toggle */}
      <div className="flex items-center gap-3">
        <Text variant="default" as="span" className="font-mono text-xs uppercase text-su-white/60">
          Initiative
        </Text>
        <div className="flex items-center gap-1">
          {isMediator ? (
            <>
              <FilterChip
                label="Players First"
                active={initiativeWinner === 'players'}
                onClick={() => handleInitiativeToggle('players')}
                colorClass="bg-su-green text-su-black"
              />
              <FilterChip
                label="NPCs First"
                active={initiativeWinner === 'npcs'}
                onClick={() => handleInitiativeToggle('npcs')}
                colorClass="bg-su-rust text-su-white"
              />
            </>
          ) : (
            <span className="font-mono text-sm text-su-white/80">
              {initiativeWinner === 'players'
                ? 'Players First'
                : initiativeWinner === 'npcs'
                  ? 'NPCs First'
                  : '—'}
            </span>
          )}
        </div>
      </div>

      {/* Active encounter stub */}
      <div className="flex items-center gap-2">
        <Text variant="default" as="span" className="font-mono text-xs uppercase text-su-white/30">
          Encounter
        </Text>
        {activeEncounterId ? (
          <span className="font-mono text-xs text-su-white/50">{activeEncounterId}</span>
        ) : (
          <span className="font-mono text-xs text-su-white/30">—</span>
        )}
      </div>

      {/* Pilot status strip */}
      {assignedPilots && assignedPilots.length > 0 && (
        <div className="flex flex-col gap-1">
          <Text variant="default" as="p" className="font-mono text-xs uppercase text-su-white/60">
            Pilot Status
          </Text>
          <div className="flex flex-wrap gap-2">
            {assignedPilots.map((pilot) => (
              <div
                key={pilot.id}
                className="flex items-center gap-2 rounded border border-su-grey-light/20 bg-su-grey-dark/40 px-2 py-1"
              >
                <Text variant="pseudoheader" as="span" className="text-xs uppercase text-su-white">
                  {pilot.callsign}
                </Text>
                <span className="font-mono text-xs text-su-white/70">
                  HP {pilot.hp}/{pilot.max_hp}
                </span>
                <span className="font-mono text-xs text-su-white/50">AP {pilot.ap}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
