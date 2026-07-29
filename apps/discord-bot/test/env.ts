/**
 * Test-only environment, preloaded via `bunfig.toml`.
 *
 * `src/config.ts` calls `requireEnv` at module scope, so *importing* anything
 * that reaches it throws without these. That was invisible until the ITUN
 * commands arrived — the reference commands never needed configuration — and
 * the fix belongs here rather than in `config.ts`, because a bot that starts
 * without a Discord token is a bot that fails silently in production. The
 * strictness is correct; the tests just have to satisfy it.
 *
 * `??=` rather than `=` so a real local environment is never clobbered.
 *
 * **`ITUN_*` is deliberately left unset**, so the default state under test is
 * Solo mode. That is the state most deployments are in and the one that must
 * never regress: every reference command has to behave identically with no
 * ITUN deployment configured. Tests that need Connected mode inject a fake
 * client rather than setting these.
 */
process.env.DISCORD_TOKEN ??= 'test-discord-token'
process.env.DISCORD_CLIENT_ID ??= 'test-discord-client-id'
