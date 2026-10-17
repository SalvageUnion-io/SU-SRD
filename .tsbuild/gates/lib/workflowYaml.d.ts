/**
 * Reading a parsed GitHub Actions workflow or composite action
 * (`Bun.YAML.parse`'s output): its steps, the local actions they call, and
 * its job graph. `tools/check-workflows.ts` holds the invariants; this is the
 * shape they read.
 */
export type Yaml = Record<string, unknown>;
/** A workflow or composite action: its repo-relative path and parsed document. */
export type WorkflowFile = {
    path: string;
    doc: Yaml;
};
/** A step and where it sits: `jobs.<id>.steps[n]` or `runs.steps[n]`. */
export type Step = {
    where: string;
    step: Yaml;
};
export declare const isObject: (v: unknown) => v is Yaml;
/** Every step in a workflow's jobs, or a composite action's `runs.steps`. */
export declare function stepsOf(f: WorkflowFile): Step[];
/** `./.github/actions/<name>` -> its `action.yml` (or `.yaml`) among `files`. */
export declare function localAction(files: readonly WorkflowFile[], uses: unknown): WorkflowFile | undefined;
/**
 * `stepsOf`, with every local composite action a step `uses` read through:
 * its steps follow the calling step, each `where` the caller's
 * (`jobs.<id>.steps[n]`) plus the action's own, so `jobOf` still names the
 * job. What a job does is the same whether a step is inline or in an action.
 */
export declare function expandedStepsOf(files: readonly WorkflowFile[], f: WorkflowFile, seen?: ReadonlySet<string>): Step[];
/** Shell text with comment lines removed — prose about a command is not the command. */
export declare const executable: (script: string) => string;
/** A job's `needs:`, string or list, as a list. */
export declare function needsOf(job: unknown): string[];
/** `jobs.<id>.steps[n]` -> `<id>`. */
export declare const jobOf: (where: string) => string;
/** Every job `job` transitively `needs`. */
export declare function ancestorsOf(jobs: Yaml, job: string): Set<string>;
