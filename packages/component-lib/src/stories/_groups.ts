/**
 * The story taxonomy (`component-lib/stories/groups`): the story catalog's
 * coverage guard fails a story titled outside it, its sidebar sorts by it, and
 * `Styleguide.stories.tsx` documents it. Group definitions live in
 * component-lib's CLAUDE.md.
 */

/** Sanctioned top-level story groups, in sidebar order. */
export const storyGroups: readonly string[] = ['Foundations', 'Atoms', 'Containers', 'Compositions']

/**
 * Sanctioned sub-groups per top-level group, in sidebar order. A sub-group
 * exists only where a cluster earns it (3+ sibling components); only
 * Compositions is large enough to need them, and its sub-grouped clusters sort
 * ahead of its ungrouped leaves.
 */
export const storySubgroups: Readonly<Record<string, readonly string[]>> = {
  Compositions: ['Entity', 'Catalog', 'Dashboard', 'Wizard', 'Shell'],
}
