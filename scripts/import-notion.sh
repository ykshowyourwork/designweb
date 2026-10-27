#!/bin/bash
# Copies the Notion lists into desiweb.org/admin/network, using the keys saved in Vercel.
# The keys are pulled into a temporary file, used, and deleted. Nothing is shown on screen.
# Run from Terminal:  bash "/Users/jt/Desktop/desiweb/website/scripts/import-notion.sh"
cd "$(dirname "$0")/.." || exit 1
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
vercel env pull "$tmp" --environment=production --yes >/dev/null 2>&1 || { echo "Could not read the keys from Vercel. Is the Vercel CLI signed in?"; exit 1; }
set -a
# shellcheck disable=SC1090
source "$tmp"
set +a
node scripts/import-notion.js
