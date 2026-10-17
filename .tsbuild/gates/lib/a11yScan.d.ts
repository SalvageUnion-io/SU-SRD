/**
 * The WCAG 2.2 AA scan the web app runs as Playwright specs
 * (`e2e/reference-a11y.e2e.ts`, `e2e/cantina-a11y.e2e.ts`, the Cantina's signed-in
 * `e2e/a11y-signed-in.e2e.ts`): axe-core
 * over the spec's page list, at a 1280×900 desktop and again as a Pixel 7. Any violation, on any
 * page or device, fails the spec.
 *
 * It is a spec rather than a script so the scan rides the suite's own browser
 * and `webServer`: one Playwright setup per app, not a second launcher with its
 * own server boot, readiness loop and emulation.
 */
import type { Browser, BrowserContextOptions } from '@playwright/test';
type AxeNode = {
    html: string;
    target: string[];
    failureSummary: string;
};
type AxeViolation = {
    id: string;
    impact: string;
    description: string;
    helpUrl: string;
    nodes: AxeNode[];
};
type PageResult = {
    page: string;
    /** `desktop`, or the Playwright device the page was emulated as. */
    device: string;
    violations: number;
    passes: number;
    incomplete: number;
    details: AxeViolation[];
};
type ScanOptions = {
    browser: Browser;
    baseURL: string;
    pages: readonly string[];
    /** An element the page must contain before it counts as settled, for a loading state `unsettled` does not know. */
    ready?: string;
    /** Cookies and storage each context starts with: a signed-in session. */
    storageState?: BrowserContextOptions['storageState'];
};
/**
 * Scan every page on every emulation. Returns each result, and one line per
 * violation (or crashed scan): the spec asserts that list is empty.
 */
export declare function scanPages(options: ScanOptions): Promise<{
    results: PageResult[];
    violations: string[];
}>;
export {};
