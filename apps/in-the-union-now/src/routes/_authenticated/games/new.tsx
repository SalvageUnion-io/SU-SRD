import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { SectionSeparator } from 'suref-react'
import { actionButtonClasses } from '../../../components/shared/actionButtonClasses'
import { useAuthStore } from '../../../stores/authStore'
import { useCreateGame } from '../../../hooks/useGames'
import { getErrorMessage } from '../../../lib/errors'
import { LabeledInput } from '../../../components/shared/LabeledInput'

export const Route = createFileRoute('/_authenticated/games/new')({
  component: NewGamePage,
})

function NewGamePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createGame = useCreateGame()
  const [name, setName] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!user || !name.trim()) return

      createGame.mutate(
        { userId: user.id, name: name.trim() },
        {
          onSuccess: (game) => {
            toast.success(`Game "${game.name}" created!`)
            navigate({ to: '/games/$gameId', params: { gameId: game.id } })
          },
          onError: (error) => {
            toast.error(getErrorMessage(error))
          },
        }
      )
    },
    [user, name, createGame, navigate]
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionSeparator label="Create a New Game" fontSize="text-base" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <LabeledInput
          label="Game Name"
          id="game-name"
          value={name}
          onChange={setName}
          placeholder="e.g. The Wasteland Reclaimers"
          maxLength={100}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!name.trim() || createGame.isPending}
            className={actionButtonClasses('green')}
          >
            {createGame.isPending ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </form>
    </div>
  )
}
