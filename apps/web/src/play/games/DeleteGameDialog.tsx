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
 * Opposition on the field, and the crew's wiring. Softening that would be the
 * failure mode of a confirm dialog: it exists to be read once, correctly. The
 * field's units are copies made for a fight and end with the Game
 * (`roster.disband`); the NPCs and encounters they were drawn from stay with
 * their maker, and the dialog says that too (MD3-03).
 *
 * ## A template's untouched units can go with it (MD2-02)
 *
 * A Game made from a template arrives with units nobody built. Where any is
 * still as it came (unassigned, unchanged), the dialog asks "Also delete the
 * 13 units it came with?". It arrives unticked, the safe side (MD4-11), and
 * says that left unticked they move to the Organiser's Training Bay (MD4-10).
 * One somebody was handed or changed is theirs: it is never among those
 * counted, and goes to a Training Bay as before.
 *
 * What moves to the Organiser is reported once, in the toast that says the
 * Game is deleted, never as a line per unit: their arrival is the Organiser's
 * own doing (`handedBack`).
 *
 * The dialog itself is the UI library's `ConfirmDialog`, which owns the pending
 * state, keeps the dialog open on a failure, and starts focus on Cancel. This
 * file owns only the words.
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/app'
import { Checkbox, Stack, Text, toast } from '../../components/index'
import { space } from '../../design/tokens'
import { failureMessage } from '../../lib/connection/useServerAction'
import { handedBack } from '../../lib/games/assignmentNotices'
import { playGamesCopy } from '../../messages/play-games'
import { useGameListing } from '../../replica/gameListing'
import { useGamesCall, useViewerId } from '../../replica/roomCalls'
import { leavingOnPurpose } from '../tableNotices.model'

/** The little a confirm needs to know: what it is ending, and how big it is. */
type DeletableGame = {
  _id: string
  name: string
  crawlerName: string | null
  pilotCount: number
  mechCount: number
  memberCount: number
  /** A template Game's units: how many it came with are here, and how many nobody has touched. */
  templateUnits?: { came: number; untouched: number } | undefined
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

/** "4 pilots", "1 pilot", or null when there are none to mention. */
function countPhrase(n: number, singular: string): string | null {
  if (n === 0) return null
  return `${n} ${n === 1 ? singular : `${singular}s`}`
}

/** "for both of you", "for all 4 of you"; alone, nobody else is counted (MD2-19). */
const endsFor = (members: number) =>
  members <= 1
    ? playGamesCopy('thisEndsYourTable')
    : playGamesCopy('thisEndsTheTableFor', {
        who: members === 2 ? 'both of you' : `all ${members} of you`,
      })

const unitCount = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`

export function DeleteGameDialog({ game, onClose, onDeleted }: Props) {
  const destroy = useGamesCall('games.destroy')
  const viewerId = useViewerId()
  // What is unassigned comes to the Organiser: counted for the one toast that says so.
  const listing = useGameListing(game?._id ?? null)
  const came = game?.templateUnits?.came ?? 0
  const untouched = game?.templateUnits?.untouched ?? 0
  // Unticked until the Organiser ticks it: deleting more is never the default (MD4-11).
  const [chosen, setChosen] = useState(false)
  const also = untouched > 0 && chosen

  async function handleConfirm() {
    if (game === null) return
    // Their own doing: `TableNotices` does not tell them the Game is gone.
    const undo = leavingOnPurpose(game._id)
    // Nor is each unit that comes to them announced: one toast reports the move (MD4-10).
    const free = [...(listing?.pilots ?? []), ...(listing?.mechs ?? [])].filter(
      (unit) => unit.ownerId === null
    )
    // The untouched ones a tick deletes are among the free ones, the crawler included.
    const left = free.length + (listing?.crawlers.length ?? 0)
    const coming = listing === undefined ? 0 : Math.max(0, left - (also ? untouched : 0))
    const quiet = viewerId === null ? [] : free.map((unit) => handedBack(unit._id))
    try {
      await destroy({ gameId: game._id, ...(also ? { dropTemplateUnits: true } : {}) })
    } catch (err) {
      undo()
      for (const again of quiet) again()
      throw err
    }
    // It landed, said back to whoever did it (r3 A4).
    toast.success(
      coming > 0
        ? playGamesCopy('gameDeletedMoved', {
            game: game.name,
            count: unitCount(coming),
            build: PRODUCT.build,
          })
        : playGamesCopy('gameDeleted', { game: game.name })
    )
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
      // A refusal (`RoomDeclined`) carries wording the server chose for the
      // player. Anything else does not,
      // and rendering `String(err)` would show a redacted stack, so it gets a
      // generic line and an operator report instead. Either way the dialog
      // stays open with the reason on it; closing silently would look like the
      // game had been deleted.
      describeError={(err) => failureMessage(err, playGamesCopy('gameDeleteFailed'))}
      body={
        <>
          <Text>{endsFor(game?.memberCount ?? 0)}</Text>

          {also ? (
            // The counts above would promise back what the tick deletes.
            <Text variant="hint">{playGamesCopy('theRestGoesHome', { build: PRODUCT.build })}</Text>
          ) : (
            <Stack gap={8}>
              <Text variant="hint">{playGamesCopy('nothingAnybodyBuiltIsDestroyed')}</Text>
              <ul style={SURVIVOR_LIST}>
                {surviving.length > 0 && (
                  <li>
                    <Text variant="hint">
                      {playGamesCopy('goBackToWhoeverOwnsThem', {
                        who: surviving.join(' and '),
                        bay: PRODUCT.build,
                      })}
                    </Text>
                  </li>
                )}
                <li>
                  <Text variant="hint">
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
          )}

          <Text variant="hint">{playGamesCopy('theCrewItsInviteLink')}</Text>
          {/* What stays (MD3-03): a fielded unit is a copy, and goes; its design does not. */}
          <Text variant="hint">{playGamesCopy('whatWasPreparedStays')}</Text>

          {untouched > 0 && (
            <>
              {/* The words name the tick and toggle it (`Checkbox words`, R16). */}
              <Checkbox
                checked={also}
                onChange={(event) => setChosen(event.target.checked)}
                words={
                  untouched === came
                    ? playGamesCopy('alsoDeleteTemplateUnits', { count: unitCount(untouched) })
                    : playGamesCopy('alsoDeleteUntouchedUnits', { count: unitCount(untouched) })
                }
              />
              {!also && (
                <Text variant="hint">
                  {playGamesCopy('leftUntickedTheyMove', { build: PRODUCT.build })}
                </Text>
              )}
            </>
          )}
        </>
      }
    />
  )
}
