---
name: validate
description: Run the full CI check suite (lint, format, typecheck, test, validate)
allowed-tools: Bash
---

# Validate

Run the full CI check suite to verify everything passes.

Steps:
1. Run `bun run check:all` from the repo root
2. This runs in parallel: lint, format check, typecheck, tests, data validation
3. Report any failures with clear context about what needs fixing
