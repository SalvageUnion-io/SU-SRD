import { MechSmallDisplay } from './MechSmallDisplay'
import { EntityGrid } from './EntityGrid'

export function MechsGrid() {
  return (
    <EntityGrid<'mechs'>
      table="mechs"
      title="Your Mechs"
      createButtonLabel="New Mech"
      createButtonBgColor="su.green"
      createButtonColor="su.white"
      emptyStateMessage="No mechs yet"
      renderCard={(mech) => {
        return <MechSmallDisplay key={mech.id} id={mech.id} />
      }}
    />
  )
}
