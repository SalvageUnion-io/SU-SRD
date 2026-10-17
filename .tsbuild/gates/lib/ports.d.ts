/** The port the primary checkout's dev server listens on: the whole site. */
export declare const BASE_PORT = 4321;
/** The response header each dev server names its checkout in. */
export declare const CHECKOUT_HEADER = "x-su-checkout";
/** This checkout's root, symlinks resolved: three levels above `packages/gates/lib/`. */
export declare const CHECKOUT_ROOT: string;
/** True for the primary checkout, whose `.git` is a directory (a linked worktree's is a file). */
export declare function isPrimaryCheckout(root: string): boolean;
/** 0 for the primary checkout, else 1..99 hashed from the checkout's path. */
export declare function portOffset(root: string, primary: boolean): number;
/** The port the dev server listens on in this checkout (CI always uses the base port). */
export declare function portFor({ root, ci, }?: {
    root?: string;
    ci?: boolean;
}): number;
