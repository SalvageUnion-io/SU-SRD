/**
 * The bot's two Cantina settings, which the Worker holds as secrets: the
 * `.convex.site` origin and the shared bot secret. Each is read by its
 * `CANTINA_*` name first and its pre-3.2 `ITUN_*` name second, so the rename
 * ships before the new secrets are set. Neither is in wrangler.jsonc's
 * `secrets.required` while either name will do; `/health` still 503s without one.
 */
type CantinaSecrets = Partial<
  Record<
    'CANTINA_CONVEX_SITE_URL' | 'CANTINA_BOT_SECRET' | 'ITUN_CONVEX_SITE_URL' | 'ITUN_BOT_SECRET',
    string
  >
>

export type BotEnv = Env & CantinaSecrets

/** The client's settings; an unset one is the empty string. */
export function cantinaConfig(env: CantinaSecrets): { siteUrl: string; botSecret: string } {
  return {
    siteUrl: env.CANTINA_CONVEX_SITE_URL || env.ITUN_CONVEX_SITE_URL || '',
    botSecret: env.CANTINA_BOT_SECRET || env.ITUN_BOT_SECRET || '',
  }
}
