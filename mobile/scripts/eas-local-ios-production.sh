#!/usr/bin/env bash
# Production iOS .ipa via `eas build --local`: keeps dev .env.local out of the JS bundle.
set -euo pipefail
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_HOLD="$ROOT/.env.local.build-hold"
ARTIFACTS="$ROOT/build-artifacts"

restore_env() {
  if [[ -f "$ENV_HOLD" ]]; then
    mv -f "$ENV_HOLD" "$ROOT/.env.local"
    echo "Restored .env.local"
  fi
}
trap restore_env EXIT

if [[ -f "$ROOT/.env.local" ]]; then
  mv -f "$ROOT/.env.local" "$ENV_HOLD"
  echo "Moved .env.local aside for this build (simulator/dev file restored when script exits)."
fi

export PATH="/usr/local/opt/ruby/bin:${HOME}/.gem/ruby/3.4.0/bin:/usr/local/bin:${PATH}"
if ! command -v fastlane >/dev/null; then
  echo "fastlane not in PATH. See docs/mobile-eas-update.md (iOS local build)."
  exit 1
fi

bash "$ROOT/scripts/patch-eas-local-macos27.sh" || true

npx tsc --noEmit
mkdir -p "$ARTIFACTS"
export EAS_LOCAL_BUILD_ARTIFACTS_DIR="$ARTIFACTS"

echo "Starting eas build -p ios --profile production --local …"
npx eas-cli@latest build -p ios --profile production --local

IPA="$(ls -t "$ARTIFACTS"/*.ipa 2>/dev/null | head -1 || true)"
if [[ -z "$IPA" ]]; then
  echo "No .ipa in $ARTIFACTS — check build output."
  exit 1
fi

listing="$(unzip -l "$IPA" 2>/dev/null || true)"
if [[ "$listing" == *main.jsbundle* ]]; then
  echo "OK: main.jsbundle in $IPA"
  APP_BUNDLE="$(unzip -Z1 "$IPA" 2>/dev/null | grep -E 'Payload/[^/]+\.app/main\.jsbundle$' | head -1)"
  if [[ -n "$APP_BUNDLE" ]] && unzip -p "$IPA" "$APP_BUNDLE" 2>/dev/null | strings | grep -q 'api.4ume.io.vn'; then
    echo "OK: bundle references https://api.4ume.io.vn"
  elif [[ -n "$APP_BUNDLE" ]] && unzip -p "$IPA" "$APP_BUNDLE" 2>/dev/null | strings | grep -qE '192\.168\.|127\.0\.0\.1:5088'; then
    echo "ERROR: bundle still has dev API URL — check .env.local was moved aside."
    exit 1
  fi
else
  echo "ERROR: no main.jsbundle in $IPA — do not submit to TestFlight."
  exit 1
fi

echo "Done: $IPA"
echo "Submit: npx eas-cli@latest submit -p ios --profile production --path \"$IPA\""
