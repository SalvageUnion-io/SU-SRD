import { createFileRoute } from '@tanstack/react-router'
import MechLiveSheet from '../../components/MechLiveSheet'
import { LOCAL_ID } from '../../lib/cacheHelpers'

export const Route = createFileRoute('/sheets/mech')({
  component: MechLiveSheetPage,
  staticData: {
    ssr: false,
  },
})

function MechLiveSheetPage() {
  return <MechLiveSheet id={LOCAL_ID} />
}
