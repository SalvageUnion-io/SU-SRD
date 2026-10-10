/**
 * assert-local-convex — `bun run dev:itun` refuses a cloud deployment.
 *
 * `convex dev` pushes this checkout's `convex/` to whatever `CONVEX_DEPLOYMENT`
 * names, on start and on every save. `.worktreeinclude` copies
 * `apps/itun/.env.local` into every worktree, so a cloud dev deployment there
 * is one backend shared by every worktree, and the last push wins: a tab
 * served by one worktree calls functions another worktree's push removed
 * (ITUN-CONVEX-A: `build:floor`, missing from an older tree's push). A local
 * deployment is one process on one port, so only one checkout serves it at a
 * time. Development has no cloud deployment (docs/ARCHITECTURE.md, "Accounts
 * and Games operations").
 *
 * Bun loads `.env.local` before this runs, and `convex dev` reads the same
 * variable with the same precedence (environment over file), so this checks
 * the deployment `convex dev` would push to.
 *
 * Usage: bun scripts/assert-local-convex.ts (the `dev` script runs it first)
 */

/** Deployment kinds that live on this machine. */
const LOCAL_KINDS = ['local', 'anonymous']

/**
 * Why `deployment` must not be pushed to from `dev`, or `null` when it may.
 * Unset is allowed: `convex dev` asks on first run.
 */
export function cloudDeploymentRefusal(deployment: string | undefined): string | null {
  const value = deployment?.split('#')[0]?.trim()
  if (!value) return null
  const kind = value.includes(':') ? value.slice(0, value.indexOf(':')) : ''
  if (LOCAL_KINDS.includes(kind)) return null
  return [
    `CONVEX_DEPLOYMENT=${value} is not a local deployment.`,
    "`bun run dev:itun` pushes this checkout's convex/ on every save. A cloud",
    'deployment is shared by every worktree, so pushes overwrite each other',
    '(ITUN-CONVEX-A). Switch this checkout to a local deployment, from apps/itun:',
    '',
    '  bunx convex dev --configure existing --team alex-jarvis --project suref-itun \\',
    '    --dev-deployment local --once',
    '',
    'then the rest of the one-time setup: .claude/skills/convex-ops/SKILL.md#local-backend',
  ].join('\n')
}

if (import.meta.main) {
  const refusal = cloudDeploymentRefusal(process.env.CONVEX_DEPLOYMENT)
  if (refusal) {
    console.error(refusal)
    process.exit(1)
  }
}
