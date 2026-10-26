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

- The app at salvageunion.io (`apps/web`): the reference pages, the character
  builder and game manager, and its Worker and rooms (`apps/web/src/worker`, `apps/web/src/rooms`).
- The Discord bot (`apps/discord-bot`).
- The CI and deploy workflows in `.github/`, which hold production
  credentials.

The game text and artwork are licensed content, not a security matter; a
licensing question goes in a normal issue.
