#!/usr/bin/env bash
# Regenerates index.json from the pool and pushes it when if it changed.

set -euo pipefail
# shellcheck source=.github/scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

bash .github/scripts/update-pages-tree.sh

# Stage every served path so the commit is an atomic snapshot of the validated Pages layout.
git -C "$POOL_CHECKOUT" add -f .nojekyll
git -C "$POOL_CHECKOUT" add \
    manifest.json index.js \
    pool index.json \
    next/pool next/index.json
commit_pool \
    "${UNCHANGED_MESSAGE:-Pages already match the Classic bundle and Revenge Next pools.}" \
    "${COMMIT_MESSAGE:-Regenerate Pages plugin layout}"
