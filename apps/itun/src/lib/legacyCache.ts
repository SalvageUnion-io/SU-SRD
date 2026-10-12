import { captureException } from './observability'

/**
 * The IndexedDB database ITUN kept before the D9 decision removed the device
 * cache (`docs/ARCHITECTURE.md#no-device-cache`).
 */
const LEGACY_DB_NAME = 'itun-v1'

/**
 * Delete the pre-D9 cache, once per boot, best effort. `idb` is the page's
 * `indexedDB`, or `undefined` where the browser has none.
 *
 * A browser that ran ITUN before D9 still holds `itun-v1`: a copy of the last
 * signed-in account's roster. Sign-out used to empty it; nothing touches it
 * now, so on a shared device it would sit on disk indefinitely. Deleting a
 * database that does not exist is a no-op, so this is safe on every boot.
 *
 * A `blocked` delete (another tab on an older build still holds it open)
 * completes once that tab closes, so it is left to finish. Removable once
 * pre-D9 builds are no longer in the wild, i.e. a few months after D9b ships.
 */
export function deleteLegacyCache(idb: Pick<IDBFactory, 'deleteDatabase'> | undefined): void {
  if (idb === undefined) return
  try {
    const request = idb.deleteDatabase(LEGACY_DB_NAME)
    request.onerror = () => {
      captureException(request.error, { source: 'deleteLegacyCache' })
    }
  } catch (err) {
    captureException(err, { source: 'deleteLegacyCache' })
  }
}
