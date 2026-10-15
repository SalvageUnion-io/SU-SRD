import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../../convex/_generated/api'
import { clearAccountHint, writeAccountHint } from '../../../ui/accountHint'
import { useConnection } from '../../lib/connection/connectionContext'
import { localStore } from '../../lib/safeLocalStorage'

/**
 * Keeps the account hint (`src/ui/accountHint`) the session's, so the
 * SRD's Union bar shows the same account menu as this one.
 *
 * Connected, it writes the name and avatar `api.account.me` answers with;
 * signed out (`solo`), it clears them. Connecting and Disconnected leave the
 * hint as it is: neither says the session ended.
 *
 * Mounted once, at the root, beside `AccountReconciler`.
 */
export function AccountHintSync() {
  const { mode } = useConnection()
  const me = useQuery(api.account.me, mode === 'connected' ? {} : 'skip')

  useEffect(() => {
    if (mode === 'solo') clearAccountHint(localStore())
  }, [mode])

  useEffect(() => {
    if (me) writeAccountHint({ name: me.displayName, avatarUrl: me.avatarUrl }, localStore())
  }, [me])

  return null
}
