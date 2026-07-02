import { createFileRoute } from '@tanstack/react-router'

import { EncounterScreen } from '../components/encounter/EncounterScreen'

export const Route = createFileRoute('/encounter')({
  component: EncounterPage,
})

function EncounterPage() {
  return <EncounterScreen />
}
