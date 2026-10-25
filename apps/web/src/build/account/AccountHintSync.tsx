import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { clearAccountHint, writeAccountHint } from '../../lib/accountHint'
import { localStore } from '../../lib/safeLocalStorage'
import { useSync } from '../../replica/syncContext'

/**
 * Keeps the account hint (`src/lib/accountHint`) the session's, so the
 * SRD's Union bar shows the same account menu as this one.
 *
 * Connected, it writes the name and avatar `api.account.me` answers with;
 * signed out, it clears them. Syncing and offline leave the hint as it is:
 * neither says the session ended.
 *
 * Mounted once, at the root, beside `ReplicaSync`.
 */
export function AccountHintSync() {
  const { status } = useSync()
  const me = useQuery(api.account.me, status === 'live' ? {} : 'skip')

  useEffect(() => {
    if (status === 'signedOut') clearAccountHint(localStore())
  }, [status])

  useEffect(() => {
    if (me) writeAccountHint({ name: me.displayName, avatarUrl: me.avatarUrl }, localStore())
  }, [me])

  return null
}
