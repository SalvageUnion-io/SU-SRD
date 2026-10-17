/**
 * Every file under `dir` that `keep` accepts, as absolute paths, never entering
 * a directory named in `skip`. A missing `dir` yields `[]`.
 */
export declare function walk(dir: string, keep: (path: string) => boolean, skip?: ReadonlySet<string>, out?: string[]): string[];
