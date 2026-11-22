/**
 * CreateDoors — `NewEntityScreen` outside the guided wizard: the chooser, with
 * the Blank dialog open over it at `mode === 'blank'`. Its own chunk, so a
 * guided build does not download the doors or the pattern lists behind them.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CreateMode } from '../../lib/wizard/createMode'
import { BlankCreateDialog } from './BlankCreateDialog'
import { CreateModeChooser } from './CreateModeChooser'

type CreateDoorsProps = {
  kind: SheetKind
  mode: CreateMode
  onModeChange: (mode: CreateMode) => void
  onCreated: (id: string) => void
  gameId?: string | undefined
  forPilot?: string | undefined
  forMech?: string | undefined
  forCrew?: string | undefined
  book?: { chassis?: string | undefined; pattern?: string | undefined } | undefined
}

export function CreateDoors({
  kind,
  mode,
  onModeChange,
  onCreated,
  gameId,
  forPilot,
  forMech,
  forCrew,
  book,
}: CreateDoorsProps) {
  return (
    <>
      <CreateModeChooser
        kind={kind}
        onGuided={() => onModeChange('guided')}
        onBlank={() => onModeChange('blank')}
        onBuilt={onCreated}
        gameId={gameId}
        forPilot={forPilot}
        forMech={forMech}
        forCrew={forCrew}
        book={book}
      />
      <BlankCreateDialog
        kind={kind}
        open={mode === 'blank'}
        onClose={() => onModeChange(undefined)}
        onCreated={onCreated}
        gameId={gameId}
      />
    </>
  )
}
