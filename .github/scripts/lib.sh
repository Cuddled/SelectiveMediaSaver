#!/usr/bin/env bash

# Shared helpers for pool workflows.

# Branch holding the pool and the index. Set the POOL_BRANCH repository variable to move it.
POOL_BRANCH="${POOL_BRANCH:-gh-pages}"
# Working copy of that branch.
POOL_CHECKOUT="${POOL_CHECKOUT:-published}"

# Prints the URL the pool is served from without a trailing slash.
pages_base_url() {
    if [ -n "${PAGES_BASE_URL:-}" ]; then
        printf '%s' "${PAGES_BASE_URL%/}"
        return
    fi

    local owner="${GITHUB_REPOSITORY%%/*}"
    local repo="${GITHUB_REPOSITORY#*/}"
    owner="${owner,,}"

    # User and organization sites serve from the domain root.
    local base="https://${owner}.github.io"
    [ "$repo" = "${owner}.github.io" ] || base="${base}/${repo}"

    printf '%s' "$base"
}

# Commits staged pool changes and pushes them. Skips if nothing is staged.
commit_pool() {
    if git -C "$POOL_CHECKOUT" diff --cached --quiet; then
        echo "$1"
        return 0
    fi

    git -C "$POOL_CHECKOUT" commit -m "$2"
    git -C "$POOL_CHECKOUT" push origin "$POOL_BRANCH"
}

# Keeps the legacy Revenge Next pool at /pool and its canonical copy at /next/pool byte-for-byte
# compatible. The legacy path cannot be removed because existing installs already point at it.
mirror_next_pools() {
    local legacy="$POOL_CHECKOUT/pool"
    local canonical="$POOL_CHECKOUT/next/pool"
    local source file name destination

    mkdir -p "$legacy" "$canonical"

    for source in "$legacy" "$canonical"; do
        if [ "$source" = "$legacy" ]; then
            destination="$canonical"
        else
            destination="$legacy"
        fi

        while IFS= read -r -d '' file; do
            name="${file##*/}"
            if [ -f "$destination/$name" ]; then
                cmp -s "$file" "$destination/$name" || {
                    echo "::error::Revenge Next artifact ${name} differs between /pool and /next/pool"
                    return 1
                }
            else
                cp "$file" "$destination/$name" || return 1
            fi
        done < <(find "$source" -maxdepth 1 -type f -name '*.zip' -print0)
    done
}
