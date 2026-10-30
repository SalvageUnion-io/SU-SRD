/**
 * The `main` branch ruleset, declared once. `tools/environments.ts` compares
 * the live ruleset against it; `check-workflows.ts` reads which workflows it
 * waits on. The ruleset is owner-applied; nothing here edits it.
 */

/** A `code_scanning` rule entry: which tool's results gate a merge, and at what severity. */
export type CodeScanningSpec = {
  tool: string
  security_alerts_threshold: string
  alerts_threshold: string
}

/** A `bypass_actors` entry; `actor_id` is null for `OrganizationAdmin`, a role. */
export type BypassActorSpec = { actor_type: string; actor_id: number | null; bypass_mode: string }

export type RulesetSpec = {
  name: string
  /** `conditions.ref_name.include`; nothing is excluded. */
  include: readonly string[]
  /** `bypass_actors`: the owner, as organisation admin, may merge past the gates. */
  bypassActors: readonly BypassActorSpec[]
  /** Every rule type the ruleset carries. */
  rules: readonly string[]
  /** `required_status_checks` contexts, each from GitHub Actions, strict (up to date with the base). */
  requiredChecks: readonly string[]
  /** `code_scanning` tools: blocking a merge on a finding is this rule's job, not a status. */
  codeScanning: readonly CodeScanningSpec[]
}

/** The GitHub Actions app: the only source a required context is taken from. */
export const ACTIONS_APP_ID = 15368

/**
 * The `main` branch ruleset. CodeQL gates through `code_scanning` alone: its
 * job's own status (`Analyze (javascript-typescript)`) passes once the analysis
 * uploads, whatever it found, so requiring it too added nothing but a second
 * name to keep in step.
 */
export const MAIN_RULESET: RulesetSpec = {
  name: 'main',
  include: ['~DEFAULT_BRANCH'],
  bypassActors: [{ actor_type: 'OrganizationAdmin', actor_id: null, bypass_mode: 'always' }],
  rules: [
    'deletion',
    'non_fast_forward',
    'required_status_checks',
    'code_scanning',
    'pull_request',
  ],
  requiredChecks: ['CI Success', 'PR title is a conventional commit', 'Claude review'],
  codeScanning: [
    { tool: 'CodeQL', security_alerts_threshold: 'high_or_higher', alerts_threshold: 'errors' },
  ],
}
