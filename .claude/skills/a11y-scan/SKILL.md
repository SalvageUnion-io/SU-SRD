---
name: a11y-scan
description: Run WCAG 2.1 AA accessibility scan using puppeteer + axe-core
allowed-tools: Bash
---

# Accessibility Scan

Run the automated accessibility scanner against a local dev server.

Steps:

1. Determine the base URL and pages to scan:
   - If arguments are provided, use them as: `<base-url> <page1> <page2> ...`
   - If no arguments, default to: `http://localhost:4321 /` (suref-web dev server)
2. Run the scan: `bun tools/a11y-scan.ts <base-url> <pages...>`
3. Report results:
   - Total violations, passes, and incomplete checks per page
   - Group violations by impact level (critical > serious > moderate > minor)
   - For each violation: ID, description, affected nodes, and help URL
4. If violations found, suggest specific fixes based on the violation types
