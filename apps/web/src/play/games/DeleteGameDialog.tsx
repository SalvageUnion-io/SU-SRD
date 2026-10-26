/**
 * DeleteGameDialog — the confirm that stands between an Organizer and the end
 * of a campaign.
 *
 * ## Why it is shared rather than written at each surface
 *
 * Deleting is offered from the hub's "End this game" panel. The consequences
 * are the *whole content* of this dialog, so it is kept as its own component
 * rather than inlined there: it is the one statement of where a crew's builds
 * go, and must not drift from what `games.destroy` actually does.
 *
 * ## It says where everything lands, not just that this cannot be undone
 *
 * A generic "this is permanent" would be both frightening and wrong. Deleting a
 * Game destroys the *table* and nothing anybody built: pilots and mechs fall
 * back to their owners' shelves, and the crawler plus anything unassigned comes
 * to the shelves of whoever is doing the deleting. The dialog names those
 * outcomes with the actual counts in front of the reader, because "4 pilots"
 * and "2 mechs" is what makes the sentence checkable against the row they just
 * clicked.
 *
 * What genuinely does not survive is named too — the invite link, the
 * opposition tray, and the crew's wiring. Softening that would be the failure
 * mode of a confirm dialog: it exists to be read once, correctly.
 *
 * The dialog itself is the UI library's `ConfirmDialog`, which owns the pending
 * state, keeps the dialog open on a failure, and starts focus on Cancel. This
 * file owns only the words.
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { ConfirmDialog, Stack, Text } from '../../components/index'
import { space } from '../../design/tokens'
import { failureMessage } from '../../lib/connection/useServerAction'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesCall } from '../../replica/roomCalls'

/** The little a confirm needs to know: what it is ending, and how big it is. */
type DeletableGame = {
  _id: string
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
   * The hub uses it to show Shelves before its `games.get` resolves to `null`
   * and renders "you are not in this game". Passing the intent in keeps this
   * component ignorant of what the caller shows next.
   */
  onDeleted?: () => void
}

const SURVIVOR_LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
  listStyleType: 'disc',
  paddingLeft: space[20],
} satisfies CSSProperties

/** The hint rung is centred; these asides read as a left-set list. */
const LEFT = { textAlign: 'left' } satisfies CSSProperties

/** "4 pilots", "1 pilot", or null when there are none to mention. */
function countPhrase(n: number, singular: string): string | null {
  if (n === 0) return null
  return `${n} ${n === 1 ? singular : `${singular}s`}`
}

export function DeleteGameDialog({ game, onClose, onDeleted }: Props) {
  const destroy = useGamesCall('games.destroy')

  async function handleConfirm() {
    if (game === null) return
    await destroy({ gameId: game._id })
    // The dialog then closes itself, through `onOpenChange(false)` → `onClose`.
    onDeleted?.()
  }

  // The builds that survive, phrased as the reader will check them against the
  // row: only the kinds actually present are mentioned.
  const surviving = [
    countPhrase(game?.pilotCount ?? 0, 'pilot'),
    countPhrase(game?.mechCount ?? 0, 'mech'),
  ].filter((part): part is string => part !== null)

  return (
    <ConfirmDialog
      open={game !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={playGamesCopy('delete', { value: game?.name ?? '' })}
      tone="danger"
      confirmLabel={playGamesCopy('deleteGame')}
      pendingLabel={playGamesCopy('deleting')}
      onConfirm={handleConfirm}
      // A refusal carries wording the server chose for the player —
      // `NotAuthorized` extends `ConvexError` precisely so it survives the wire
      // intact rather than arriving as "Server Error". Anything else does not,
      // and rendering `String(err)` would show a redacted stack, so it gets a
      // generic line and an operator report instead. Either way the dialog
      // stays open with the reason on it; closing silently would look like the
      // game had been deleted.
      describeError={(err) => failureMessage(err, 'That Game could not be deleted. Try again.')}
      body={
        <>
          <Text>{playGamesCopy('thisEndsTheTableFor', { value: game?.memberCount ?? 0 })}</Text>

          <Stack gap={8}>
            <Text variant="hint" style={LEFT}>
              {playGamesCopy('nothingAnybodyBuiltIsDestroyed')}
            </Text>
            <ul style={SURVIVOR_LIST}>
              {surviving.length > 0 && (
                <li>
                  <Text variant="hint" style={LEFT}>
                    {surviving.join(' and ')} go back to whoever owns them, in their {PRODUCT.build}
                    .
                  </Text>
                </li>
              )}
              <li>
                <Text variant="hint" style={LEFT}>
                  {game?.crawlerName === null || game?.crawlerName === undefined
                    ? playGamesCopy('anythingUnassignedComesToYou', { build: PRODUCT.build })
                    : playGamesCopy('andAnythingUnassignedComeTo', {
                        crawlerName: game.crawlerName,
                        build: PRODUCT.build,
                      })}
                </Text>
              </li>
            </ul>
          </Stack>

          <Text variant="hint" style={LEFT}>
            {playGamesCopy('theCrewItsInviteLink')}
          </Text>
        </>
      }
    />
  )
}
