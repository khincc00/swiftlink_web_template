# Changelog

## v2.0.0 — 2026-10-03

A rebuilt, eleven-page template with a small build step, interactive booking tools and launch-ready SEO and legal pages.

### Added
- **Build system**: `_tools/build.py` (Python 3.8+, no dependencies) wraps `_src/pages/*.html` in the shared head, header and footer, and generates `sitemap.xml` and `robots.txt`.
- **Pages**: services & fleet, instant quote wizard, shipment tracking, contact, careers, privacy policy (PDPA), terms of service and a 404 page.
- **Interactive tools**: hero estimate and tracking console, 5-step quote wizard with live pricing, vehicle matcher, interactive Singapore coverage map, searchable FAQ, rates table.
- **Business data in one file**: `assets/js/config.js` holds prices, vehicles, regions, surcharges, Singapore public holidays, dispatch hours, form endpoints and demo tracking records.
- **Forms**: PDPA consent checkbox, honeypot spam trap, optional background submission to a form endpoint (Formspree etc.), email and WhatsApp fallbacks.
- **SEO and sharing**: canonical URLs, Open Graph / Twitter cards, schema.org JSON-LD, social share image, app icons and web manifest.
- **Analytics hook**: optional Google Analytics 4 with lead, contact-click and tracking events.
- **Performance**: WebP copies of all photos served through `<picture>`; `_tools/optimize-images.sh`.
- Light / dark theme, mobile quick-action bar, accessibility improvements.
- Developer comments throughout the code and a full English README.

### Removed
- The old flyer files in `_previous-version/` and unused SVG illustrations. They remain available in the `v1.0.0` tag.

## v1.0.0 — 2026-10-02

Initial three-page template: home, about and gallery.
