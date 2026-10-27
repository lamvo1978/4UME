#!/usr/bin/env bash
# Workaround: macOS 26/27 + eas build --local fails PREPARE_CREDENTIALS with
# "Distribution certificate ... hasn't been imported successfully" (expo/eas-cli#3678).
# Re-run after `npx` refreshes the eas-cli-local-build-plugin cache.
set -euo pipefail
shopt -s nullglob
patched=0
for f in "$HOME"/.npm/_npx/*/node_modules/@expo/build-tools/dist/ios/credentials/keychain.js; do
  if grep -q "find-identity', '-v'" "$f"; then
    sed -i '' "s/'find-identity', '-v', '-s'/'find-identity', '-s'/g" "$f"
    echo "Patched: $f"
    patched=1
  fi
done
if [ "$patched" -eq 0 ]; then
  echo "No keychain.js with -v found (already patched or cache empty). Run eas build --local once, then retry."
fi
