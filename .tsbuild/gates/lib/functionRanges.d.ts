/**
 * Every function in a source file as a 1-based line range, for `mergeLcov`
 * (`lib/lcov.ts`), which needs to know which function a reported line sits in.
 */
import type { FunctionRange } from './lcov';
/** The line ranges of every function in the file at `path`. */
export declare function functionRanges(path: string): FunctionRange[];
