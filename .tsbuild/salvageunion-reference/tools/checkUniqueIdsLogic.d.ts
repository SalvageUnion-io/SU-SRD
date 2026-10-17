/**
 * Pure logic for unique-ID validation across the Salvage Union data.
 *
 * Validates that every `id`, at any depth of a row:
 * 1. is a valid UUID (v4 format) — except in files in SLUG_ID_FILES
 * 2. is unique within its file
 * 3. is unique across all files
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=ids`) and the tests share one implementation.
 */
export type FileResult = {
    file: string;
    totalItems: number;
    /** Every `id` visited, at any depth (a row can carry many). */
    idCount: number;
    invalidUUIDs: Array<{
        id: string;
        index: number;
        context: string;
    }>;
    /** `indices` are row indices; `contexts` the path of each copy inside its row. */
    duplicatesInFile: Array<{
        id: string;
        indices: number[];
        contexts: string[];
    }>;
};
export type ValidationResult = {
    files: FileResult[];
    globalDuplicates: Array<{
        id: string;
        files: Array<{
            file: string;
            indices: number[];
        }>;
    }>;
    totalIds: number;
    uniqueIds: number;
    invalidIds: number;
    duplicateIds: number;
};
export declare function validateUUID(id: string): boolean;
export declare function checkFile(filename: string, data: Record<string, unknown>[]): FileResult;
/** Run the full unique-ID check over every supplied data file. */
export declare function checkAllFiles(filesByName: Record<string, Record<string, unknown>[]>): ValidationResult;
