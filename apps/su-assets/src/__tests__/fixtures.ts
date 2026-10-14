import type { AssetBucket } from '../worker'

/** A bucket holding `entries`, recording every key it was asked for. */
export function bucketWith(entries: Record<string, string>): AssetBucket & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    async get(key: string) {
      asked.push(key)
      const body = entries[key]
      if (body === undefined) return null
      return { body: new Response(body).body }
    },
  }
}

/** A bucket with nothing in it. */
export const emptyBucket: AssetBucket = {
  async get() {
    return null
  },
}

export function req(path: string, method = 'GET'): Request {
  return new Request(`https://assets.salvageunion.io${path}`, { method })
}
