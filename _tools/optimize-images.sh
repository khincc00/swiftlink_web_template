#!/usr/bin/env bash
# =============================================================================
# Create WebP copies of every JPG in assets/images/photos/.
#
# build.py detects a .webp next to a .jpg and wraps that <img> in a <picture>
# element, so modern browsers download the smaller WebP and older ones the JPG.
#
# Requires cwebp (macOS: `brew install webp`, Debian/Ubuntu: `apt install webp`).
#   bash _tools/optimize-images.sh          # only missing or outdated WebPs
#   bash _tools/optimize-images.sh --force  # regenerate all
# Then rebuild:  python3 _tools/build.py
#
# Tip: keep source photos at most ~2000 px wide and below ~500 KB before running.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
command -v cwebp >/dev/null || { echo "cwebp not found (brew install webp)" >&2; exit 1; }

QUALITY=78
for jpg in assets/images/photos/*.jpg; do
  webp="${jpg%.jpg}.webp"
  if [[ "${1:-}" == "--force" || ! -f "$webp" || "$jpg" -nt "$webp" ]]; then
    cwebp -quiet -q "$QUALITY" -metadata none "$jpg" -o "$webp"
    printf '%-48s %6s KB → %6s KB\n' "$jpg" "$(( $(wc -c < "$jpg") / 1024 ))" "$(( $(wc -c < "$webp") / 1024 ))"
  fi
done
