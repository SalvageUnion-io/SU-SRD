/**
 * requestPersistentStorage tests — best-effort persistence request (audit fix:
 * IndexedDB is eviction-eligible without navigator.storage.persist()).
 *
 * The helper is fire-and-forget from getDb(): it must NEVER reject and must not
 * re-prompt once storage is already persistent. We stub navigator.storage per
 * case and restore it afterward (happy-dom's default may or may not define it).
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { requestPersistentStorage } from '../index'

const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage')

function stubStorage(value: unknown): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(navigator, 'storage', originalStorage)
  } else {
    // @ts-expect-error — remove the stub if the runtime had none originally
    delete navigator.storage
  }
})

describe('requestPersistentStorage', () => {
  test('requests persistence when not already granted', async () => {
    const persist = mock(async () => true)
    const persisted = mock(async () => false)
    stubStorage({ persist, persisted })

    await requestPersistentStorage()

    expect(persisted).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  test('does not re-prompt when storage is already persistent', async () => {
    const persist = mock(async () => true)
    const persisted = mock(async () => true)
    stubStorage({ persist, persisted })

    await requestPersistentStorage()

    expect(persisted).toHaveBeenCalledTimes(1)
    expect(persist).not.toHaveBeenCalled()
  })

  test('resolves (never rejects) when the Storage API is unavailable', async () => {
    stubStorage(undefined)
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })

  test('swallows errors thrown by the Storage API', async () => {
    stubStorage({
      persisted: async () => false,
      persist: async () => {
        throw new Error('denied')
      },
    })
    await expect(requestPersistentStorage()).resolves.toBeUndefined()
  })
})
