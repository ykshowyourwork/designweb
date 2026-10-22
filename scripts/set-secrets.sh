#!/bin/bash
# Puts DesiWeb's secret keys into Vercel without showing them on screen or saving them anywhere else.
# Run from Terminal:  bash "/Users/jt/Desktop/YK 2.0/designweb/scripts/set-secrets.sh"
# Press Enter on any question to skip it and set it later.
cd "$(dirname "$0")/.." || exit 1

set_secret() {
  local name="$1" value="$2"
  for env in production preview; do
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1
    printf %s "$value" | vercel env add "$name" "$env" >/dev/null 2>&1 || { echo "  Could not save $name ($env)."; return 1; }
  done
  echo "  Saved $name."
}

ask() {
  local name="$1" prompt="$2" value
  read -r -s -p "$prompt: " value
  echo
  if [ -z "$value" ]; then echo "  Skipped $name."; return; fi
  set_secret "$name" "$value" && changed=1
}

changed=0
echo "DesiWeb secret keys. Typing is hidden."
ask STRIPE_SECRET_KEY "Stripe secret key (starts with rk_live_, sk_live_ or sk_test_)"

read -r -p "Make a new admin password for desiweb.org/admin? (y = make one for me, n = I'll type my own, Enter = skip): " make
if [ "$make" = "y" ]; then
  pw="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20)"
  set_secret ADMIN_PASSWORD "$pw" && changed=1
  echo
  echo "  Your admin password (save it in the Passwords app now, it won't be shown again):"
  echo "  $pw"
  echo
  unset pw
elif [ "$make" = "n" ]; then
  ask ADMIN_PASSWORD "Password for desiweb.org/admin (8+ characters)"
else
  echo "  Skipped ADMIN_PASSWORD."
fi

ask NOTION_TOKEN      "Notion integration secret (starts with ntn_ or secret_)"

if [ "$changed" = 1 ]; then
  echo "Redeploying so the site uses the new keys..."
  vercel deploy --prod --yes >/dev/null 2>&1 && echo "Done. desiweb.org is using the new keys." || echo "Redeploy failed. Run: vercel deploy --prod"
else
  echo "Nothing changed."
fi
