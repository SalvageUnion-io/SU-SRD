/**
 * The workspace dependency graph, read from the manifests.
 */
export type Workspace = {
    /** Repo-relative directory, e.g. `packages/cantina-domain`. */
    dir: string;
    /** The manifest `name`, which `bun --filter` takes. */
    name: string;
    /** Names of the workspaces it depends on through a `workspace:` range. */
    deps: string[];
};
/** A workspace's `package.json`, as far as the gates read it. */
export type PackageManifest = {
    name: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};
/** Every workspace's manifest under `root`, in `discoverWorkspaceDirs` order. */
export declare function readManifests(root?: string, opts?: {
    withTools?: boolean;
}): {
    dir: string;
    name: string;
    manifest: PackageManifest;
}[];
/** Every workspace (`tools/` included) with its `workspace:` dependencies. */
export declare function readWorkspaces(root?: string): Workspace[];
