#!/usr/bin/env bash
set -euo pipefail

template_sha='d47f792150f4dcc4f47aace6227f8b8c52aa84de'
base="https://raw.githubusercontent.com/revenge-mod/revenge-plugin-template/${template_sha}"

mkdir -p gradle/wrapper
curl --fail --silent --show-error --location \
  "${base}/gradle/wrapper/gradle-wrapper.jar" \
  --output gradle/wrapper/gradle-wrapper.jar

expected='498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17'
actual="$(sha256sum gradle/wrapper/gradle-wrapper.jar | awk '{print $1}')"
if [[ "$actual" != "$expected" ]]; then
  echo "Gradle wrapper JAR checksum mismatch: $actual" >&2
  exit 1
fi

chmod +x gradlew
echo "Gradle wrapper ready (${template_sha})."
