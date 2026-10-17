import type { LaunchOptions } from '@playwright/test';
/** The executable to launch: `SHOT_CHROME_PATH`, Playwright's own, the fallback, or Playwright's default. */
export declare function chromeExecutable(own: string): string | undefined;
/** Launches Chromium with `options`, choosing the executable as `chromeExecutable` does. */
export declare function launchBrowser(options?: LaunchOptions): Promise<import("@playwright/test").Browser>;
