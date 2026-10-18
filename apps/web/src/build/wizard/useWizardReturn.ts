import { useNavigate } from '@tanstack/react-router'
import { useReturnToContainer } from '../entityContainer/useShowContainer'

/**
 * Where finishing or cancelling a `/…/new` wizard goes: the Game's page in
 * Play when the wizard was started from it (`?game=<id>`, ADR-052 §3), else
 * back to where the build was started from (`useReturnToContainer`).
 */
export function useWizardReturn(gameId: string | undefined): () => void {
  const navigate = useNavigate()
  const back = useReturnToContainer()
  return () => {
    if (gameId === undefined) back()
    else void navigate({ to: '/play/games/$gameId', params: { gameId } })
  }
}
