import { useNavigate } from '@tanstack/react-router'

/**
 * Where cancelling a `/…/new` wizard goes, and finishing one started from a
 * Game: the Game's page in Play when the wizard was started from it
 * (`?game=<id>`, ADR-052 §3), else the Training Bay. Nothing remembers a
 * current container.
 */
export function useWizardReturn(gameId: string | undefined): () => void {
  const navigate = useNavigate()
  return () => {
    if (gameId === undefined) void navigate({ to: '/' })
    else void navigate({ to: '/games/$gameId', params: { gameId } })
  }
}
