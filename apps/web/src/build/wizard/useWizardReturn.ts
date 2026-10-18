import { useNavigate } from '@tanstack/react-router'

/**
 * Where finishing or cancelling a `/…/new` wizard goes: the Game's page in
 * Play when the wizard was started from it (`?game=<id>`, ADR-052 §3), else
 * the Hangar, where the new unit landed. Nothing remembers a current
 * container.
 */
export function useWizardReturn(gameId: string | undefined): () => void {
  const navigate = useNavigate()
  return () => {
    if (gameId === undefined) void navigate({ to: '/' })
    else void navigate({ to: '/play/games/$gameId', params: { gameId } })
  }
}
