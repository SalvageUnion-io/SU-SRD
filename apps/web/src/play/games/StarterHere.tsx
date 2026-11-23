/**
 * StarterHere — the empty "Bring into this Game" dialog's Starter Set, in
 * place (r5 B18): each Starter Set Pilot a button that copies them, with the
 * Mech their book pairs them with already assigned, straight into this Game.
 * The player stays on the Game's page; the notice names the copy and carries
 * its Undo. Its own file, imported only once the empty dialog opens: the
 * Starter Set's templates are not the Game page's to load.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, Text, toast, tokens } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { copyStarterPilot, starterMechOf, undoCopies } from '../../lib/starterSet/copyStarter'
import { starterTemplates } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { playGamesCopy } from '../../messages/play-games'

const HERE = {
  display: 'flex',
  flexBasis: '100%',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const PILOTS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

export function StarterHere({
  gameId,
  gameName,
  onCopied,
}: {
  gameId: string
  gameName: string | null
  /** The copy is made: the dialog closes. */
  onCopied: () => void
}) {
  const [copying, setCopying] = useState(false)
  const where = gameName ?? playGamesCopy('thisGame')

  async function copy(templateId: string, name: string) {
    const mech = starterMechOf(templateId)
    const what =
      mech === null ? name : buildStarterSetCopy('pilotAndMech', { name, mech: mech.name })
    setCopying(true)
    try {
      const made = await copyStarterPilot(templateId, { kind: 'game', gameId })
      onCopied()
      toast.success(buildStarterSetCopy('copiedTo', { name: what, label: where }), {
        action: {
          label: buildStarterSetCopy('undo'),
          onClick: () =>
            void undoCopies([
              { kind: 'pilot', id: made.id },
              ...(made.mech === null ? [] : [{ kind: 'mech' as const, id: made.mech.id }]),
            ]).then(() => toast.success(buildStarterSetCopy('copyUndone', { name: what }))),
        },
      })
    } catch (err) {
      toast.error(failureMessage(err, buildStarterSetCopy('notCopied', { name })))
    } finally {
      setCopying(false)
    }
  }

  return (
    <div style={HERE}>
      <Text variant="note">{playGamesCopy('starterHere')}</Text>
      <div style={PILOTS}>
        {starterTemplates('pilot', 'starter-set').map((pilot) => (
          <Button
            key={pilot.id}
            variant="default"
            size="compact"
            disabled={copying}
            aria-label={playGamesCopy('starterHereCopy', { name: pilot.name })}
            onClick={() => void copy(pilot.id, pilot.name)}
          >
            {playGamesCopy('starterHereButton', { name: pilot.name })}
          </Button>
        ))}
      </div>
    </div>
  )
}
