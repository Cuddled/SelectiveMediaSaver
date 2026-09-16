#!/usr/bin/env bash
set -euo pipefail

# This exact revision publishes io.github.revenge:api:1.0.0.
revenge_xposed_sha='9a1426d0a3df000beb4174d0071d4d80e8be42fc'
checkout="${1:-.deps/revenge-xposed}"

if [[ ! -d "$checkout/.git" ]]; then
  mkdir -p "$(dirname "$checkout")"
  git init --quiet "$checkout"
  git -C "$checkout" remote add origin https://github.com/revenge-mod/revenge-xposed.git
fi

git -C "$checkout" fetch --quiet --depth 1 origin "$revenge_xposed_sha"
git -C "$checkout" checkout --quiet --detach FETCH_HEAD

resolved="$(git -C "$checkout" rev-parse HEAD)"
if [[ "$resolved" != "$revenge_xposed_sha" ]]; then
  echo "Unexpected RevengeXposed revision: $resolved" >&2
  exit 1
fi

"$checkout/gradlew" -p "$checkout" --no-daemon :api:publishToMavenLocal
echo "Published io.github.revenge:api:1.0.0 from ${revenge_xposed_sha}."
