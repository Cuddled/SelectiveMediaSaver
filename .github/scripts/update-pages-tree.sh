#!/usr/bin/env bash
# Stages the complete GitHub Pages tree without committing or pushing it.
#
# Usage: update-pages-tree.sh [release-plan.tsv]
# A release plan is a tab-separated list of "built zip" and "published filename" pairs.

set -euo pipefail
# shellcheck source=.github/scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

base="$(pages_base_url)"
classic_dir="${CLASSIC_BUILD_DIR:-build/classic}"
midnight_glass_dir="${MIDNIGHT_GLASS_THEME_DIR:-themes/midnight-glass}"
release_plan="${1:-}"

for asset in manifest.json index.js; do
    if [ ! -f "$classic_dir/$asset" ]; then
        echo "::error::missing Classic Revenge asset ${classic_dir}/${asset}"
        exit 1
    fi
done

for asset in theme.json background-v1.png; do
    if [ ! -f "$midnight_glass_dir/$asset" ]; then
        echo "::error::missing Midnight Glass theme asset ${midnight_glass_dir}/${asset}"
        exit 1
    fi
done

mkdir -p \
    "$POOL_CHECKOUT/pool" \
    "$POOL_CHECKOUT/next/pool" \
    "$POOL_CHECKOUT/themes/midnight-glass"

if [ -n "$release_plan" ]; then
    while IFS=$'\t' read -r zip file; do
        [ -n "$zip" ] || continue
        [ -f "$zip" ] || { echo "::error::missing artifact ${zip}"; exit 1; }
        for destination in "$POOL_CHECKOUT/pool/$file" "$POOL_CHECKOUT/next/pool/$file"; do
            if [ -f "$destination" ]; then
                cmp -s "$zip" "$destination" || {
                    echo "::error::refusing to overwrite immutable Revenge Next artifact ${file}"
                    exit 1
                }
            else
                cp "$zip" "$destination"
            fi
        done
    done < "$release_plan"
fi

mirror_next_pools

# Keep the original Revenge Next URL functional for existing installations.
npm run generate-index -- \
    --dist "$POOL_CHECKOUT/pool" \
    --base-url "${base}/pool" \
    --out "$POOL_CHECKOUT/index.json"

# New Revenge Next installations use an explicit subpath, avoiding the Classic manifest at root.
npm run generate-index -- \
    --dist "$POOL_CHECKOUT/next/pool" \
    --base-url "${base}/next/pool" \
    --out "$POOL_CHECKOUT/next/index.json"

cp "$classic_dir/manifest.json" "$POOL_CHECKOUT/manifest.json"
cp "$classic_dir/index.js" "$POOL_CHECKOUT/index.js"
cp "$midnight_glass_dir/theme.json" "$POOL_CHECKOUT/themes/midnight-glass/theme.json"
background_destination="$POOL_CHECKOUT/themes/midnight-glass/background-v1.png"
if [ -f "$background_destination" ] && \
    ! cmp -s "$midnight_glass_dir/background-v1.png" "$background_destination"; then
    echo "::error::refusing to overwrite immutable Midnight Glass background-v1.png; publish a versioned filename instead"
    exit 1
fi
cp "$midnight_glass_dir/background-v1.png" "$background_destination"
touch "$POOL_CHECKOUT/.nojekyll"

node scripts/validate-pages-layout.mjs "$POOL_CHECKOUT" "$base"
