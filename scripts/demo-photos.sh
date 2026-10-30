#!/bin/bash
# Photos for the demo sites (/site/<slug>), pulled each morning from each business's Google Maps photos.
#   scripts/demo-photos.sh list                 → the demos still waiting for photos (slug | business | maps link)
#   scripts/demo-photos.sh save <slug> <jpg...> → shrinks them, uploads to the public demo-photos bucket,
#                                                 and sets that demo's photos in that order
# Uses the Supabase CLI login on this Mac (no keys in here).
set -euo pipefail
REF=ugylbemtlemmvltbitmb
BASE="https://$REF.supabase.co/storage/v1/object/public/demo-photos"
q() { supabase db query --linked --project-ref "$REF" "$1" 2>/dev/null; }

case "${1:-}" in
  list)
    q "select slug, business, google_maps from network where slug is not null and site is not null and coalesce(jsonb_array_length(site->'photos'), 0) = 0 and stage <> 'pass' order by updated_at desc limit 20" \
      | python3 -c 'import sys,json
d=json.load(sys.stdin); rows=d.get("rows", d) if isinstance(d, dict) else d
for r in rows: print(r["slug"], "|", r["business"], "|", r.get("google_maps") or "")'
    ;;
  save)
    slug="$2"; shift 2
    [[ "$slug" =~ ^[a-z0-9-]{3,60}$ ]] || { echo "bad slug"; exit 1; }
    tmp="$(mktemp -d)"; urls=(); n=0
    for f in "$@"; do
      n=$((n + 1))
      sips -Z 1400 -s format jpeg -s formatOptions 74 "$f" --out "$tmp/$n.jpg" >/dev/null
      supabase storage cp "$tmp/$n.jpg" "ss:///demo-photos/$slug/$n.jpg" --experimental --linked --project-ref "$REF" --content-type image/jpeg >/dev/null 2>&1
      urls+=("\"$BASE/$slug/$n.jpg\"")
    done
    json="[$(IFS=,; echo "${urls[*]}")]"
    q "update network set site = jsonb_set(site, '{photos}', '$json'::jsonb) where slug = '$slug'" >/dev/null
    rm -rf "$tmp"
    echo "Saved $n photos for $slug → https://desiweb.org/site/$slug"
    ;;
  *) sed -n 2,6p "$0" ;;
esac
