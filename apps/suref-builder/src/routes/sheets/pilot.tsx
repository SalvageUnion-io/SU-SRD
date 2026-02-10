import { createFileRoute } from '@tanstack/react-router'
import PilotLiveSheet from '../../components/PilotLiveSheet'
import { LOCAL_ID } from '../../lib/cacheHelpers'

export const Route = createFileRoute('/sheets/pilot')({
  component: PilotLiveSheetPage,
  staticData: {
    ssr: false,
  },
})

function PilotLiveSheetPage() {
  return <PilotLiveSheet id={LOCAL_ID} />
}
