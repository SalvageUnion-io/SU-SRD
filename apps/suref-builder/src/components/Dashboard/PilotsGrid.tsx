import { PilotSmallDisplay } from './PilotSmallDisplay'
import { EntityGrid } from './EntityGrid'

export function PilotsGrid() {
  return (
    <EntityGrid<'pilots'>
      table="pilots"
      title="Your Pilots"
      createButtonLabel="New Pilot"
      createButtonBgColor="su.orange"
      createButtonColor="su.white"
      emptyStateMessage="No pilots yet"
      renderCard={(pilot) => {
        return <PilotSmallDisplay key={pilot.id} id={pilot.id} />
      }}
    />
  )
}
