#!/usr/bin/env bash
# Copies planned artifacts into the pool, regenerates the index, and pushes the changes.
#
# One commit keeps the index a pure function of the pool, so a failed run publishes nothing.

set -euo pipefail
# shellcheck source=.github/scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

base="$(pages_base_url)"
echo "Serving Classic Revenge from ${base}"
echo "Serving Revenge Next from ${base}/next (legacy repository URL remains ${base})"

count="$(jq 'length' "$PLAN")"
jq -r '.[] | [.zip, .file] | @tsv' "$PLAN" > plan.tsv

# Missing artifact.
while IFS=$'\t' read -r zip _; do
    [ -f "$zip" ] || { echo "::error::missing artifact ${zip}"; exit 1; }
done < plan.tsv

attempt_publish() {
    # Retries reset the checkout, so the complete layout is staged on every attempt.
    bash .github/scripts/update-pages-tree.sh plan.tsv || return 1

    git -C "$POOL_CHECKOUT" add -f .nojekyll
    git -C "$POOL_CHECKOUT" add \
        manifest.json index.js \
        pool index.json \
        next/pool next/index.json || return 1
    commit_pool \
        "Pages already hold the Classic bundle and this Next release plan." \
        "Publish Classic bundle and ${count} Revenge Next release(s)"
}

for attempt in 1 2 3; do
    if attempt_publish; then
        exit 0
    fi

    echo "Publish attempt ${attempt} failed. Syncing with ${POOL_BRANCH}."
    git -C "$POOL_CHECKOUT" fetch origin "$POOL_BRANCH" || break
    git -C "$POOL_CHECKOUT" reset --hard "origin/${POOL_BRANCH}" || break
done

echo "::error::could not publish the pool after 3 attempts"
exit 1
