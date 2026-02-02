# 003: Relative Imports over Aliases

**Status:** Accepted

**Context:**
TypeScript and JavaScript projects commonly use path aliases (e.g., `@/components`, `@/hooks`) to simplify imports and avoid deeply nested relative paths. However, this can obscure the actual file relationships and make it harder to understand the codebase structure.

**Decision:**
Prefer relative imports over path aliases for all imports from the `src/` directory:
- ✅ `import { useHydratedPilot } from '../../hooks/pilot'`
- ❌ `import { useHydratedPilot } from '@/hooks/pilot'`

This convention applies to ALL files including route files, components, hooks, utilities, etc.

**Consequences:**

**Positive:**
- File relationships are explicit and clear
- Easier to understand code organization at a glance
- No need to configure and maintain path alias mappings
- Makes refactoring (moving files) more straightforward - you see all affected imports
- Better for AI agents to understand file structure

**Negative:**
- Some imports can be deeply nested (e.g., `../../../hooks/pilot`)
- Slightly more verbose imports
- Requires counting `../` levels when writing imports

**References:**
- `.ai/rules/typescript-style.md`
- `.ai/rules/monorepo-patterns.md`
- `docs/DEVELOPMENT.md` - Imports section
