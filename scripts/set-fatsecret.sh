#!/bin/bash
# Saves the FatSecret food-data keys into Vercel without showing them on screen or saving them anywhere else.
# Run from Terminal:  bash "/Users/jt/Desktop/desiweb/website/scripts/set-fatsecret.sh"
# Where to find them: https://platform.fatsecret.com/my-account/api-key, section "REST API OAuth 1.0 Credentials"
#   Consumer Key    = tap "Show Consumer Key" (NOT the Client ID)
#   Consumer Secret = tap "Show Consumer Secret"
cd "$(dirname "$0")/.." || exit 1

save() {
  local name="$1" value="$2"
  for env in production preview; do
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1
    printf %s "$value" | vercel env add "$name" "$env" >/dev/null 2>&1 || { echo "  Could not save $name ($env). Is the Vercel CLI signed in? Run: vercel login"; exit 1; }
  done
  echo "  Saved $name."
}

ask() {
  local name="$1" prompt="$2" value
  while true; do
    read -r -s -p "$prompt: " value
    echo
    value="$(printf %s "$value" | tr -d '[:space:]')"
    if [[ "$value" =~ ^[a-f0-9]{32}$ ]]; then save "$name" "$value"; return; fi
    echo "  That should be 32 letters and numbers (a-f, 0-9). Try again."
  done
}

echo "FatSecret keys for the fitness app. Typing is hidden."
ask FATSECRET_CONSUMER_KEY    "Consumer Key (tap Show Consumer Key, under OAuth 1.0)"
ask FATSECRET_CONSUMER_SECRET "Consumer Secret (tap Show Consumer Secret, same section)"
echo
echo "Done. Tell Claude \"fatsecret keys are in\" and it will redeploy and test it."
