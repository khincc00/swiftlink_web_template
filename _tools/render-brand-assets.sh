#!/usr/bin/env bash
# =============================================================================
# Render the PNG icons and the social share image from their sources.
#
#   _src/brand/icon-square.svg  → assets/images/apple-touch-icon.png (180)
#                                 assets/images/icon-maskable-512.png
#   assets/images/favicon.svg   → assets/images/icon-192.png, icon-512.png
#   _src/brand/og-image.html    → assets/images/og-image.jpg (1200 × 630)
#
# Needs Google Chrome / Chromium (headless screenshots). Point CHROME at the
# binary if it isn't found automatically:
#   CHROME="/path/to/chrome" bash _tools/render-brand-assets.sh
# Run it after changing the logo, brand colours, or the og-image headline/photo.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${CHROME:-}" ]]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "$(command -v google-chrome || true)" "$(command -v chromium || true)" "$(command -v chromium-browser || true)"; do
    if [[ -n "$c" && -x "$c" ]]; then CHROME="$c"; break; fi
  done
fi
if [[ -z "${CHROME:-}" ]]; then echo "Chrome not found. Set CHROME=/path/to/chrome" >&2; exit 1; fi

OUT=assets/images
shot() { # shot <source> <output.png> <width> <height>
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=4000 \
    --window-size="$3,$4" --screenshot="$2" "file://$PWD/$1" >/dev/null 2>&1
  echo "rendered $2"
}

shot _src/brand/icon-square.svg "$OUT/apple-touch-icon.png" 180 180
shot _src/brand/icon-square.svg "$OUT/icon-maskable-512.png" 512 512
shot "$OUT/favicon.svg"         "$OUT/icon-192.png" 192 192
shot "$OUT/favicon.svg"         "$OUT/icon-512.png" 512 512

# Social image: render as PNG, then convert to a smaller JPG.
TMP="$(mktemp -d)/og-image.png"
shot _src/brand/og-image.html "$TMP" 1200 630
if command -v sips >/dev/null; then                      # macOS
  sips -s format jpeg -s formatOptions 82 "$TMP" --out "$OUT/og-image.jpg" >/dev/null
elif command -v convert >/dev/null; then
  convert "$TMP" -quality 82 "$OUT/og-image.jpg"         # ImageMagick
else
  python3 -c "from PIL import Image; Image.open('$TMP').convert('RGB').save('$OUT/og-image.jpg', quality=82)"
fi
rm -f "$TMP"
echo "rendered $OUT/og-image.jpg"
