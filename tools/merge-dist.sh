#!/usr/bin/env bash
# merge-dist — put the Cantina's build inside srd's, the one `dist` su-srd serves.
#
#   bash tools/merge-dist.sh
#
# Run after both apps are built (`bun --filter web build` and
# `bun --filter web build:cantina`), by deploy-cloudflare.yml, deploy-preview.yml and anyone
# serving both through one `wrangler dev`. Copies `apps/web/dist-cantina/build/`
# to `apps/web/dist/build/`, and nothing else: the Cantina's `dist-cantina/_headers`
# is not su-srd's (srd's `public/_headers` covers `/build/assets/*`, and the
# Worker sets the Cantina's CSP, apps/web/src/worker/build.ts).
#
# Refuses to overwrite: srd emits nothing under `build/`, so one already there
# means a stale merge or a route that moved. The Cantina's copy of the shared
# base stylesheet (`dist-cantina/assets/`, apps/web/src/styles/baseStylesheet.ts) stays
# behind for srd's, and must match it byte for byte, or the Cantina would link
# a file the site does not serve.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
from="$root/apps/web/dist-cantina/build"
to="$root/apps/web/dist/build"

if [ ! -f "$from/index.html" ]; then
  echo "FATAL: no Cantina build at $from (run its build first)." >&2
  exit 1
fi
if [ ! -d "$root/apps/web/dist" ]; then
  echo "FATAL: no srd build at $root/apps/web/dist (run its build first)." >&2
  exit 1
fi
if [ -e "$to" ]; then
  echo "FATAL: $to already exists; srd emits nothing under build/." >&2
  exit 1
fi

for file in "$root/apps/web/dist-cantina/assets/"*; do
  if ! cmp -s "$file" "$root/apps/web/dist/assets/$(basename "$file")"; then
    echo "FATAL: the base stylesheet's $(basename "$file") differs between the two builds." >&2
    exit 1
  fi
done

cp -R "$from" "$to"
echo "merge-dist: $(find "$to" -type f | wc -l | tr -d ' ') Cantina files in $to"
