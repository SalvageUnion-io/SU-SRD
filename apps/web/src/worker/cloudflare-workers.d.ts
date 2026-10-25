/**
 * `cloudflare:workers` for this workspace, whose tsconfig carries the DOM's
 * globals rather than workerd's: only what the rooms and the bot's gateway
 * use, typed from `@cloudflare/workers-types`' module entry (which declares no
 * globals).
 */
declare module 'cloudflare:workers' {
  import type {
    DurableObjectNamespace,
    DurableObjectState,
    ExecutionContext,
    Rpc,
  } from '@cloudflare/workers-types'

  export abstract class DurableObject<Env = unknown> implements Rpc.DurableObjectBranded {
    [Rpc.__DURABLE_OBJECT_BRAND]: never
    protected ctx: DurableObjectState
    protected env: Env
    constructor(ctx: DurableObjectState, env: Env)
    alarm?(alarmInfo?: { retryCount: number; isRetry: boolean }): void | Promise<void>
  }

  export abstract class WorkerEntrypoint<Env = unknown> implements Rpc.WorkerEntrypointBranded {
    [Rpc.__WORKER_ENTRYPOINT_BRAND]: never
    protected ctx: ExecutionContext
    protected env: Env
    constructor(ctx: ExecutionContext, env: Env)
  }

  /** This Worker's own classes, by name (`exports` in `wrangler.jsonc`). */
  export const exports: Record<string, DurableObjectNamespace | undefined>
}
