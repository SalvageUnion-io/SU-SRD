/**
 * `cloudflare:workers` for this workspace, whose tsconfig carries the DOM's
 * globals rather than workerd's: only what the rooms use, typed from
 * `@cloudflare/workers-types`' module entry (which declares no globals).
 */
declare module 'cloudflare:workers' {
  import type {
    DurableObjectNamespace,
    DurableObjectState,
    Rpc,
    WebSocket,
  } from '@cloudflare/workers-types'

  export abstract class DurableObject<Env = unknown> implements Rpc.DurableObjectBranded {
    [Rpc.__DURABLE_OBJECT_BRAND]: never
    protected ctx: DurableObjectState
    protected env: Env
    constructor(ctx: DurableObjectState, env: Env)
    fetch?(request: Request): Response | Promise<Response>
    webSocketClose?(
      ws: WebSocket,
      code: number,
      reason: string,
      wasClean: boolean
    ): void | Promise<void>
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>
  }

  /** This Worker's own classes, by name (`exports` in `wrangler.jsonc`). */
  export const exports: Record<string, DurableObjectNamespace | undefined>
}
