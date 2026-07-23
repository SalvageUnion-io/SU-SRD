<!--
  The canonical LLM statement for this project.

  Both about pages render this file verbatim — srd's `/about`
  (`apps/srd/src/pages/about.astro`, read at build time with node:fs) and ITUN's
  `/about` (`apps/itun/src/routes/about.tsx`, inlined via a Vite `?raw` import).
  Edit the wording here and both sites change together; there is no second copy.

  Format contract (see `packages/component-lib/src/llmStatement/`): one `#`
  heading, then blank-line-separated plain paragraphs. The renderer does NOT
  interpret inline markdown — no links, bold, or lists.
-->

# How this was built

Much of this project was written with LLM assistance. Every change was reviewed, run, and merged by a human, and the commit history is public if you want to see which parts.

The site, schema, and project were started before LLMs, and have been deliberately designed and refined.

This project supports open-weight models and stands against consolidated corporate ownership of LLM infrastructure. The tools that build things should belong to the people building with them.
