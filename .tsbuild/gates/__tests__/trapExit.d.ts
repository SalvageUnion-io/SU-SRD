/** What a trapped `process.exit` throws, carrying the code the CLI would exit with. */
export declare class Exited extends Error {
    readonly code: number | string | null | undefined;
    constructor(code: number | string | null | undefined);
}
/**
 * Gate preconditions call `process.exit(1)` on failure. Registers hooks that
 * turn `exit` into a thrown `Exited` (so the runner survives and the function
 * stops where the CLI would) and capture `console.error`, restored after each
 * test. Returns the captured lines, cleared before each test.
 */
export declare function trapExit(): {
    errors: string[];
};
