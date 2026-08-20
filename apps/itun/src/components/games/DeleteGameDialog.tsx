/**
 * DeleteGameDialog — the confirm that stands between an Organizer and the end
 * of a campaign.
 *
 * ## Why it is shared rather than written at each surface
 *
 * Deleting is offered in two places — the trash on a row in the Games list, and
 * the danger zone on the Game's own screen — and the two are the same act with
 * the same consequences. The consequences are the *whole content* of this
 * dialog, so a second copy of it would be a second statement of where a crew's
 * builds go, free to drift from what `games.destroy` actually does.
 *
 * ## It says where everything lands, not just that this cannot be undone
 *
 * A generic "this is permanent" would be both frightening and wrong. Deleting a
 * Game destroys the *table* and nothing anybody built: pilots and mechs fall
 * back to their owners' shelves, and the crawler plus anything unclaimed lands
 * on the shelf of whoever is doing the deleting. The dialog names those
 * outcomes with the actual counts in front of the reader, because "4 pilots"
 * and "2 mechs" is what makes the sentence checkable against the row they just
 * clicked.
 *
 * What genuinely does not survive is named too — invites, join requests, the
 * opposition tray, and the crew's wiring. Softening that would be the failure
 * mode of a confirm dialog: it exists to be read once, correctly.
 */

import { Button, ModalShell, Text } from 'component-lib'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { isServerRefusal, serverMessage } from '../../lib/connection/serverError'
import { captureException } from '../../lib/observability'

/** The little a confirm needs to know: what it is ending, and how big it is. */
export type DeletableGame = {
  _id: Id<'games'>
  name: string
  crawlerName: string | null
  pilotCount: number
  mechCount: number
  memberCount: number
}

type Props = {
  /** `null` closes the dialog; a game opens it. Lets one dialog serve a list. */
  game: DeletableGame | null
  onClose: () => void
  /**
   * Called after the server confirms the deletion, never optimistically.
   *
   * The two surfaces want different things here — the list re-renders itself
   * from the `listMine` subscription and needs nothing, while the Game's own
   * route has to navigate away before its `games.get` resolves to `null` and
   * renders "you are not in this game". Passing the intent in keeps this
   * component ignorant of routing.
   */
  onDeleted?: () => void
}

/** "4 pilots", "1 pilot", or null when there are none to mention. */
function countPhrase(n: number, singular: string): string | null {
  if (n === 0) return null
  return `${n} ${n === 1 ? singular : `${singular}s`}`
}

export function DeleteGameDialog({ game, onClose, onDeleted }: Props) {
  const destroy = useMutation(api.games.destroy)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (game === null) return
    setBusy(true)
    setError(null)
    try {
      await destroy({ gameId: game._id })
      onDeleted?.()
      onClose()
    } catch (err) {
      // A refusal carries wording the server chose for the player —
      // `NotAuthorized` extends `ConvexError` precisely so it survives the wire
      // intact rather than arriving as "Server Error". Anything else does not,
      // and rendering `String(err)` would show a redacted stack, so it gets a
      // generic line and an operator report instead. Either way the dialog
      // stays open with the reason on it; closing silently would look like the
      // game had been deleted.
      if (isServerRefusal(err)) {
        setError(serverMessage(err))
      } else {
        captureException(err)
        setError('That game could not be deleted. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  // The builds that survive, phrased as the reader will check them against the
  // row: only the kinds actually present are mentioned.
  const surviving = [
    countPhrase(game?.pilotCount ?? 0, 'pilot'),
    countPhrase(game?.mechCount ?? 0, 'mech'),
  ].filter((part): part is string => part !== null)

  return (
    <ModalShell
      open={game !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
      title={`Delete ${game?.name ?? ''}?`}
      tone="danger"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        <Text>
          This ends the table for all {game?.memberCount ?? 0} of you. It cannot be undone.
        </Text>

        <div className="flex flex-col gap-2">
          <Text variant="hint" className="text-left">
            Nothing anybody built is destroyed:
          </Text>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {surviving.length > 0 && (
              <li>
                <Text variant="hint" className="text-left">
                  {surviving.join(' and ')} go back to the shelves of whoever owns them.
                </Text>
              </li>
            )}
            <li>
              <Text variant="hint" className="text-left">
                {game?.crawlerName === null || game?.crawlerName === undefined
                  ? 'Anything unclaimed lands on your shelf.'
                  : `${game.crawlerName} and anything unclaimed land on your shelf.`}
              </Text>
            </li>
          </ul>
        </div>

        <Text variant="hint" className="text-left">
          The crew, its invites, any pending join requests, the opposition tray and the wiring
          between everyone's builds go with the game.
        </Text>

        {error !== null && (
          <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
            {error}
          </Text>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="compact" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="compact"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? 'Deleting…' : 'Delete game'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
