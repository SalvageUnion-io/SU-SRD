# Security policy

## Reporting a vulnerability

Report it privately through GitHub: the repository's **Security** tab, then
**Report a vulnerability**
(<https://github.com/SalvageUnion-io/SU-SRD/security/advisories/new>). Please
do not open a public issue, pull request or discussion for it.

Include what is affected, how to reproduce it, and what an attacker gains.

## What is in scope

Only what is deployed from `main`: older commits and releases are not
patched.

- The reference site (`apps/srd`) and the character builder and game manager
  (`apps/itun`), including its Convex backend.
- The Discord bot (`apps/discord-bot`) and the artwork Worker
  (`apps/su-assets`).
- The CI and deploy workflows in `.github/`, which hold production
  credentials.

The game text and artwork are licensed content, not a security matter; a
licensing question goes in a normal issue.
