/**
 * The story files the catalog serves, as repo-relative globs: component-lib's,
 * and each app's own components'. `catalog.tsx`'s `import.meta.glob` must be a
 * literal, so it spells the same list out; `listStories.ts`, the coverage
 * guard and `catalogRoute.test.ts` read this one.
 */
export const STORY_GLOBS = [
  'packages/component-lib/src/**/*.stories.tsx',
  'apps/itun/src/components/**/*.stories.tsx',
  'apps/srd/src/components/**/*.stories.tsx',
] as const
