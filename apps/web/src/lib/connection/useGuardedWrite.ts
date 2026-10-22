import { WritesBlockedOffline } from '../../stores/entityBackend'
import { askWrite, reportWriteFailure, runWrite } from '../runWrite'
import { useConnection } from './connectionContext'

/**
 * A hook's own Convex writes (Play's seat and Downtime), refused here while
 * the connection cannot write rather than handed to the Convex client, which
 * would queue them until it returns: Disconnected is read-only, not a write
 * queue (ADR-030 §1). The refusal says why (offline, still signing in, an
 * outdated tab); a write that goes is `runWrite`'s or `askWrite`'s, so a
 * failure is said by the one rule (`reportWriteFailure`).
 */
export type GuardedWrite = {
  /** Send a fire-and-forget write, or say why it cannot go. */
  send: (write: () => Promise<unknown>) => void
  /** Send a write whose answer the caller acts on: false when it was refused or failed. */
  ask: (write: () => Promise<boolean>) => Promise<boolean>
}

export function useGuardedWrite(): GuardedWrite {
  const { mode, canWrite, outdated } = useConnection()

  /** True, having said why, when no write may go now. */
  function blocked(): boolean {
    if (canWrite) return false
    reportWriteFailure(
      new WritesBlockedOffline(
        outdated ? 'outdated' : mode === 'connecting' ? 'settling' : 'offline'
      )
    )
    return true
  }

  return {
    send: (write) => {
      if (!blocked()) runWrite(write)
    },
    ask: async (write) => (blocked() ? false : await askWrite(write)),
  }
}
