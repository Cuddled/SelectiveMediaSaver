#!/usr/bin/env bash
# Writes a tag and a GitHub Release per planned version for changelogs.

set -euo pipefail

jq -r '.[] | [.tag, .id, .version, .zip] | @tsv' "$PLAN" |
    while IFS=$'\t' read -r tag id version zip; do
        if ! git rev-parse -q --verify "refs/tags/${tag}" > /dev/null; then
            git tag "$tag"
            git push origin "$tag"
        fi

        if gh release view "$tag" > /dev/null 2>&1; then
            echo "= ${tag}"
        else
            gh release create "$tag" \
                --title "$tag" \
                --notes "Automated release of \`${id}\` ${version}."
            echo "+ ${tag}"
        fi

        # Keep every published plugin available as a normal GitHub Release download too. This is
        # useful for private repositories that cannot serve GitHub Pages on the owner's plan.
        # Versioned artifacts are immutable: never delete and replace an existing asset.
        asset_name="$(basename "$zip")"
        if gh release view "$tag" --json assets --jq '.assets[].name' | grep -Fqx -- "$asset_name"; then
            echo "= ${tag}/${asset_name}"
        else
            gh release upload "$tag" "$zip"
            echo "+ ${tag}/${asset_name}"
        fi
    done
