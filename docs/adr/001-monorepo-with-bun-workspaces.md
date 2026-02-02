# 001: Monorepo with Bun Workspaces

**Status:** Accepted

**Context:**
The project needs to manage two closely related packages:
- `salvageunion-reference` - A standalone npm package containing game data and TypeScript ORM
- `suref-web` - The web application that consumes the reference package

These packages share:
- TypeScript configuration
- Code style (Prettier, ESLint)
- Development tooling
- Reference data updates need to be immediately available to the web app

**Decision:**
Use a Bun workspace monorepo structure with:
- Root `package.json` marked as `"private": true`
- Workspace dependencies using `workspace:*` protocol
- Shared dev dependencies at the root level
- Each package/app is self-contained with its own dependencies
- Single `bun.lock` file at the root

**Consequences:**

**Positive:**
- Immediate availability of package changes to the app via workspace linking
- Shared tooling configuration reduces duplication
- Single lockfile ensures consistent dependency resolution
- Easy to add new packages/apps in the future
- TypeScript can resolve workspace dependencies seamlessly

**Negative:**
- Developers must remember to build the package for types to resolve
- Slightly more complex directory structure
- Need to understand Bun workspace conventions

**References:**
- [Bun Workspace Documentation](https://bun.com/docs/guides/install/workspaces)
- Root `package.json` workspaces configuration
- `.ai/rules/monorepo-patterns.md`
