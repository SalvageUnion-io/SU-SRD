/**
 * The one place a person is asked how the table sees them (r7 C1, MD7-01,
 * LG7-01, PT7-21): New Game and Join this Game each carry a Display name,
 * filled in from the account's name (its own, else Discord's), so most people
 * only press Join. It is the account's own display name, the one Settings
 * holds, so the invite, Members, the Remove dialog and a pattern's credit all
 * read it; "Player N" (`memberName`) stays the fallback for a blank one.
 *
 * Nothing new is stored: a changed name is saved to the profile before the
 * Game is made or joined, and the rosters follow (`showOnRosters`).
 *
 * A field left empty is the account's name, never "Player N" (r8 C1, MD8-13):
 * an account with no name of its own or Discord's takes its email's first
 * part, shown in the empty field before it is kept.
 */

import { useState } from 'react'
import { useMe, useUpdateProfile } from '../../lib/account/accountApi'

export type TableName = {
  /** What the field shows: the typed name, else the account's. */
  value: string
  /** The name an empty field is kept as: the account's, else its email's first part. */
  fallback: string
  setValue: (value: string) => void
  /** Who is signed in has been read; false until then. */
  loaded: boolean
  /** The account has a name already (its own or Discord's), so arriving may join at once. */
  known: boolean
  /** Save a changed, non-blank name to the profile; a failed save never stops the join. */
  keep: () => Promise<void>
}

/** The account's name for a blank field: its own or Discord's, else its email's first part. */
export function accountName(
  me: { displayName: string | null; email?: string | null } | null | undefined
): string {
  const own = me?.displayName?.trim() ?? ''
  if (own !== '') return own
  return (me?.email ?? '').split('@')[0]?.trim() ?? ''
}

/** The Display name's state, for a door that makes or joins a Game. */
export function useTableName(): TableName {
  const me = useMe()
  const update = useUpdateProfile()
  const [typed, setTyped] = useState<string | null>(null)
  const shown = me?.displayName ?? ''
  const value = typed ?? shown
  const fallback = accountName(me)
  return {
    value,
    fallback,
    setValue: setTyped,
    loaded: me !== undefined,
    known: shown.trim() !== '',
    keep: async () => {
      const name = value.trim() === '' ? fallback : value.trim()
      if (name === '' || name === shown.trim()) return
      // The name is a courtesy to the table: the Game is made or joined either way.
      await update({ displayName: name }).catch(() => undefined)
    },
  }
}
