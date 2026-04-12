#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: bash scripts/create-mac-dmg.sh <path-to-app> <output-dmg>" >&2
  exit 1
fi

APP_PATH="$1"
OUTPUT_DMG="$2"

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH" >&2
  exit 1
fi

APP_NAME="$(basename "$APP_PATH")"
VOL_NAME="${APP_NAME%.app}"
STAGING_DIR="$(mktemp -d /tmp/endpointdoctor-dmg.XXXXXX)"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

cp -R "$APP_PATH" "$STAGING_DIR/$APP_NAME"
ln -s /Applications "$STAGING_DIR/Applications"

rm -f "$OUTPUT_DMG"

hdiutil create \
  -volname "$VOL_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$OUTPUT_DMG"

echo "Created DMG: $OUTPUT_DMG"