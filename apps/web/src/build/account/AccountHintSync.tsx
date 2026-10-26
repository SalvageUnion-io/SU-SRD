import { useEffect } from 'react'
import { useMe } from '../../lib/account/accountApi'
import { clearAccountHint, writeAccountHint } from '../../lib/accountHint'
import { localStore } from '../../lib/safeLocalStorage'
import { useSync } from '../../replica/syncContext'

/**
 * Keeps the account hint (`src/lib/accountHint`) the session's, so the
 * SRD's Union bar shows the same account menu as this one.
 *
 * Connected, it writes the name and avatar `useMe` answers with;
 * signed out, it clears them. Syncing and offline leave the hint as it is:
 * neither says the session ended.
 *
 * Mounted once, at the root, beside `ReplicaSync`.
 */
export function AccountHintSync() {
  const { status } = useSync()
  const me = useMe(status === 'live')

  useEffect(() => {
    if (status === 'signedOut') clearAccountHint(localStore())
  }, [status])

  useEffect(() => {
    if (me) writeAccountHint({ name: me.displayName, avatarUrl: me.avatarUrl }, localStore())
  }, [me])

  return null
}
