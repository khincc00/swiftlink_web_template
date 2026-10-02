#!/usr/bin/env python3
"""
SwiftLink site builder
======================

A tiny, dependency-free static site generator (Python 3.8+, standard library only).

HOW IT WORKS
------------
1. Every page's *content* lives in  _src/pages/<name>.html
2. This script wraps each page in the shared <head>, icon sprite, header,
   footer and mobile action bar, replaces the {{placeholders}} below, and
   writes the finished page to the project root as  <name>.html
3. It also writes  sitemap.xml  and  robots.txt  to the project root.

    python3 _tools/build.py

Never edit the generated *.html files in the project root directly: they are
overwritten on every build. Edit _src/pages/*.html or this file instead.

PAGE HEADER BLOCK
-----------------
Each source page starts with an HTML comment holding its settings:

    <!--
    title: Page title | Brand            (required)  <title> and og:title
    description: One-sentence summary    (required)  meta description / og:description
    nav: home | services | ...           (required)  which menu item is highlighted
    script: quote.js                     (optional)  extra script from assets/js/
    robots: noindex                      (optional)  adds <meta name="robots">, skips sitemap
    sitemap: no                          (optional)  leave the page out of sitemap.xml
    image: assets/images/photos/x.jpg    (optional)  per-page social share image
    rootlinks: yes                       (optional)  makes relative links root-relative (404.html)
    -->

PLACEHOLDERS YOU CAN USE INSIDE _src/pages/*.html
-------------------------------------------------
    {{icon:name}}   inline SVG icon from the ICONS dictionary below
    {{c:key}}       a value from COMPANY, e.g. {{c:phone}}, {{c:licence}}
    {{s:key}}       a value from SITE, e.g. {{s:url}}
    {{sgmap}}       the interactive Singapore map from _src/sgmap.svg

IMAGES
------
If a WebP copy of a photo exists next to the JPG (create them with
_tools/optimize-images.sh), every <img src="assets/images/photos/*.jpg">
is automatically wrapped in a <picture> element that serves the WebP to
browsers that support it and falls back to the JPG.
"""
import datetime
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"


# =============================================================================
# 1. SITE SETTINGS  (domain, SEO, analytics)
# =============================================================================
SITE = {
    # Public URL of the live site, WITHOUT a trailing slash. Used for canonical
    # links, social share previews (og:url / og:image must be absolute),
    # sitemap.xml and robots.txt. Change this before going live.
    "url": "https://www.swiftlink.com.sg",
    # Path the site is served from. "/" for a domain root, "/my-folder/" if it
    # lives in a sub-folder. Only used by pages with `rootlinks: yes` (404.html),
    # so their links still work when the host shows them at a nested URL.
    "base_path": "/",
    "lang": "en",
    "locale": "en_SG",
    "name": "SwiftLink Logistics & Transport",
    # Default social share image (1200 x 630). Regenerate it from
    # _src/og-image.html, see README → Social share image.
    "og_image": "assets/images/og-image.jpg",
    "theme_color": "#0A2463",
    # Google Analytics 4 measurement ID, e.g. "G-XXXXXXXXXX".
    # Leave empty to load no analytics at all. When set, the tag is added to
    # every page and assets/js/main.js reports calls, WhatsApp clicks and
    # form submissions as GA4 events (see SL.track in main.js).
    "ga4_id": "",
}

# =============================================================================
# 2. COMPANY DETAILS  (shown in the header, footer, legal pages, schema.org)
#    Keep these in sync with `company` in assets/js/config.js.
# =============================================================================
COMPANY = {
    "name": "SwiftLink Logistics & Transport Pte Ltd",
    "phone": "+65 6777 4599",          # display format
    "tel": "+6567774599",              # tel: link format (no spaces)
    "whatsapp": "6567774599",          # wa.me format: country code + number, digits only
    "email": "enquiry@swiftlink.com.sg",
    "dpo_email": "privacy@swiftlink.com.sg",  # Data Protection Officer (PDPA requirement)
    "careers_email": "careers@swiftlink.com.sg",
    "street": "456 Logistics Avenue, #03-22",
    "postal": "609876",
    "licence": "LTA/TS/2023/01987",
    "uen": "201400000X",               # Singapore company registration number (UEN)
    "founded": "2014",
}
COMPANY["address"] = f"{COMPANY['street']}, Singapore {COMPANY['postal']}"

# Social profiles. Use "#" as a visible placeholder during design review,
# a full URL when live, or "" to hide the icon completely.
SOCIAL = {
    "linkedin": "#",
    "facebook": "#",
    "instagram": "#",
}

# =============================================================================
# 3. NAVIGATION
#    (key, file, label). `key` must match the `nav:` value in a page header.
# =============================================================================
NAV = [
    ("services", "services.html", "Services"),
    ("track", "track.html", "Track"),
    ("about", "about.html", "About"),
    ("gallery", "gallery.html", "Gallery"),
    ("contact", "contact.html", "Contact"),
]

# Footer link columns: (heading, [(label, href), ...]).
FOOTER_COLUMNS = [
    ("Services", [
        ("Goods delivery", "services.html#delivery"),
        ("Corporate charter", "services.html#charter"),
        ("Point-to-point", "services.html#transfer"),
        ("Warehouse support", "services.html#warehouse"),
        ("Fleet guide", "services.html#fleet"),
    ]),
    ("Customer tools", [
        ("Instant quote", "quote.html"),
        ("Track a shipment", "track.html"),
        ("Vehicle matcher", "services.html#matcher"),
        ("Business accounts", "index.html#business"),
        ("FAQ", "index.html#faq"),
    ]),
    ("Company", [
        ("About us", "about.html"),
        ("Careers", "careers.html"),
        ("Gallery", "gallery.html"),
        ("Contact", "contact.html"),
        ("Coverage", "index.html#coverage"),
    ]),
]

# Small print links in the footer bottom bar.
LEGAL_LINKS = [
    ("Privacy policy", "privacy.html"),
    ("Terms of service", "terms.html"),
]

# =============================================================================
# 4. BRAND MARK + ICONS
# =============================================================================
# The logo inherits its colours from CSS: `color` (--logo) for the tile and
# --logo-ink for the chevrons, so it adapts to light/dark themes automatically.
LOGO = """<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <rect width="40" height="40" rx="10" fill="currentColor"/>
  <path d="M11 12.5 18.5 20 11 27.5" fill="none" stroke="var(--logo-ink)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
  <path d="M19.5 12.5 27 20l-7.5 7.5" fill="none" stroke="var(--logo-ink)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

# Line icons on a 24 x 24 grid (stroke-based, Feather/Lucide style).
# Every icon is output once in a hidden <svg> sprite and referenced with
# <use href="#i-name">, so adding one here makes it available as
# {{icon:name}} in pages and as '#i-name' from JavaScript.
ICONS = {
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "tag": '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    "truck": '<path d="M1 4h14v12H1z"/><path d="M15 8h4l4 4v4h-8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    "car": '<path d="M5 17h14M3 13l2-6a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 7l2 6v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
    "bus": '<rect x="3" y="3" width="18" height="15" rx="2"/><path d="M3 11h18M8 18v3M16 18v3M7 14.5h.01M17 14.5h.01"/>',
    "warehouse": '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35a2 2 0 0 1 1.26-1.86l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12M6 14h12M6 22V10h12v12"/>',
    "box": '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    "route": '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    "headset": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
    "pin": '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    "mail": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    "whatsapp": '<path d="M3 21l1.65-4.8A8.5 8.5 0 1 1 7.8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.2-1.9-1-.8.7a4 4 0 0 1-2.5-2.5l.7-.8-1-1.9z"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
    "menu": '<path d="M3 6h18M3 12h18M3 18h18"/>',
    "close": '<path d="M18 6 6 18M6 6l12 12"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "minus": '<path d="M5 12h14"/>',
    "chev-left": '<path d="m15 18-6-6 6-6"/>',
    "chev-right": '<path d="m9 18 6-6-6-6"/>',
    "chev-down": '<path d="m6 9 6 6 6-6"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    "users": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    "up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "license": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.6-1.8 2-2.8 3.5-2.8s2.9 1 3.5 2.8M15 9h3M15 13h3"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    "building": '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    "bolt": '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    "layers": '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    "expand": '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "star": '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    "thermo": '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    "signature": '<path d="M3 17c3-1 4-7 6-7s1 6 3 6 2-3 4-3 2 2 5 2M3 21h18"/>',
    "briefcase": '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "home": '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    "heart": '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    "linkedin": '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    "facebook": '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    "instagram": '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z"/><path d="M17.5 6.5h.01"/>',
}


# =============================================================================
# 5. HELPERS
# =============================================================================
def esc(value):
    """HTML-escape a value for use in text or attributes (& < > ")."""
    return html.escape(str(value), quote=True)


def abs_url(path):
    """Turn a site-relative path ("assets/x.jpg", "index.html") into an absolute URL."""
    if path.startswith("http"):
        return path
    if path in ("", "index.html"):
        return SITE["url"] + "/"
    return f"{SITE['url']}/{path.lstrip('/')}"


def sprite():
    """Hidden SVG sprite containing every icon as a <symbol id="i-name">."""
    symbols = "".join(
        f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()
    )
    return f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{symbols}</svg>'


def icon(name, cls="icon"):
    """Markup for one sprite icon. Raises KeyError for unknown names, so typos fail the build."""
    if name not in ICONS:
        raise KeyError(f"Unknown icon '{name}'. Add it to ICONS in _tools/build.py.")
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


def current_attr(is_current):
    """aria-current attribute for the active nav item (kept out of f-strings for Python < 3.12)."""
    return ' aria-current="page"' if is_current else ""


def schema_org():
    """schema.org structured data (JSON-LD) describing the business, shared by every page."""
    data = {
        "@context": "https://schema.org",
        "@type": "MovingCompany",
        "@id": SITE["url"] + "/#organization",
        "name": COMPANY["name"],
        "url": SITE["url"] + "/",
        "logo": abs_url("assets/images/icon-512.png"),
        "image": abs_url(SITE["og_image"]),
        "description": "LTA-licensed transport and logistics provider in Singapore: goods delivery, "
                       "corporate charter, point-to-point transfers and warehouse support.",
        "telephone": COMPANY["phone"],
        "email": COMPANY["email"],
        "foundingDate": COMPANY["founded"],
        "priceRange": "$$",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": COMPANY["street"],
            "addressLocality": "Singapore",
            "postalCode": COMPANY["postal"],
            "addressCountry": "SG",
        },
        "openingHours": "Mo-Su 00:00-23:59",
        "areaServed": {"@type": "Country", "name": "Singapore"},
    }
    same_as = [u for u in SOCIAL.values() if u.startswith("http")]
    if same_as:
        data["sameAs"] = same_as
    # "</" must not appear inside a <script> block.
    return json.dumps(data, indent=2, ensure_ascii=False).replace("</", "<\\/")


def analytics():
    """Google Analytics 4 tag, only when SITE['ga4_id'] is set."""
    gid = SITE["ga4_id"]
    if not gid:
        return ""
    return f"""
  <!-- Google Analytics 4 (set SITE["ga4_id"] in _tools/build.py; leave empty to remove) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={esc(gid)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() {{ dataLayer.push(arguments); }}
    gtag('js', new Date());
    gtag('config', '{esc(gid)}');
  </script>"""


def root_links(page_html):
    """Prefix relative href/src/srcset values with SITE['base_path'] (for pages with `rootlinks: yes`).

    In-page anchors (#top), absolute URLs, mailto:, tel: and data: URIs are left alone.
    Used instead of <base href>, which would turn "#top" into a link to the home page.
    """
    base = SITE["base_path"]
    return re.sub(
        r'\b(href|src|srcset)="(?!(?:[a-z]+:|#|/))([^"]+)"',
        lambda m: f'{m.group(1)}="{base}{m.group(2)}"',
        page_html,
    )


def pictures(body):
    """Wrap photo <img> tags in <picture> with a WebP source when a .webp copy exists."""
    def repl(m):
        tag, src = m.group(0), m.group(1)
        webp = src[:-4] + ".webp"
        if not (ROOT / webp).exists():
            return tag
        return f'<picture><source srcset="{webp}" type="image/webp">{tag}</picture>'
    return re.sub(r'<img\b[^>]*?\bsrc="(assets/images/photos/[^"]+\.jpg)"[^>]*>', repl, body)


# =============================================================================
# 6. SHARED PAGE PARTS
# =============================================================================
def head(page, meta, extra=""):
    """<!DOCTYPE>, <html> and the full <head> for one page."""
    title, description = meta["title"], meta["description"]
    url = abs_url(page)
    image = abs_url(meta.get("image") or SITE["og_image"])
    noindex = "noindex" in meta.get("robots", "")
    seo = (
        f'\n  <meta name="robots" content="{esc(meta["robots"])}">' if noindex
        else f'\n  <link rel="canonical" href="{url}">'
    )
    return f"""<!DOCTYPE html>
<html lang="{SITE['lang']}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">{seo}
  <meta name="theme-color" content="{SITE['theme_color']}">

  <!-- Social share preview (Facebook, LinkedIn, WhatsApp, X) -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{esc(SITE['name'])}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="{SITE['locale']}">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Icons and installable-app manifest -->
  <link rel="icon" type="image/svg+xml" href="assets/images/favicon.svg">
  <link rel="apple-touch-icon" href="assets/images/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">

  <!-- Fonts: General Sans (headings) from Fontshare, Roboto + Roboto Mono from Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://api.fontshare.com" crossorigin>
  <link href="https://api.fontshare.com/v2/css?f[]=general-sans@500,600&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/styles.css">

  <!-- Runs before first paint: marks JS as available (enables reveal animations)
       and picks the theme from ?theme= or the visitor's system setting, so the
       page never flashes the wrong colours. -->
  <script>
    (function () {{
      var d = document.documentElement;
      d.classList.add('js');
      var t = new URLSearchParams(location.search).get('theme');
      if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      d.setAttribute('data-theme', t);
    }})();
  </script>

  <!-- config.js (business data) must load before main.js (shared behaviour). -->
  <script src="assets/js/config.js" defer></script>
  <script src="assets/js/main.js" defer></script>{extra}{analytics()}

  <!-- Structured data for search engines (generated from COMPANY in build.py) -->
  <script type="application/ld+json">
{schema_org()}
  </script>
</head>"""


def header(active):
    """Skip link, utility bar (status, licence, contacts) and the sticky site header."""
    c = COMPANY
    links = "".join(
        f'<li><a href="{href}"{current_attr(key == active)}>{label}</a></li>'
        for key, href, label in NAV
    )
    return f"""
  <a class="skip-link" href="#main">Skip to content</a>

  <!-- Utility bar. The status text and dot are updated by main.js from
       `dispatch.hours` in config.js; the clock shows Singapore time. -->
  <div class="utility-bar">
    <div class="container utility-inner">
      <p class="utility-status"><span class="live-dot" aria-hidden="true" data-dispatch-dot></span><span data-dispatch-status>Dispatch online</span><span class="utility-sep" aria-hidden="true">·</span><span data-sg-clock>Singapore time</span></p>
      <ul class="utility-list">
        <li class="hide-sm">LTA Licence <strong>{c['licence']}</strong></li>
        <li><a href="mailto:{c['email']}">{icon('mail')}<span class="hide-sm">{c['email']}</span><span class="show-sm">Email</span></a></li>
        <li><a href="tel:{c['tel']}">{icon('phone')}{c['phone']}</a></li>
      </ul>
    </div>
  </div>

  <header class="site-header" id="top">
    <div class="container header-inner">
      <a class="brand" href="index.html" aria-label="SwiftLink Logistics &amp; Transport, home">
        {LOGO}
        <span class="brand-text"><strong>SwiftLink</strong><small>Logistics &amp; Transport</small></span>
      </a>

      <!-- Main navigation. Below 960px it becomes a full-screen menu opened by .nav-toggle (main.js). -->
      <nav class="main-nav" id="main-nav" aria-label="Main">
        <ul>{links}</ul>
        <div class="nav-mobile-extra">
          <a class="btn btn-primary btn-block" href="quote.html">Get an instant quote {icon('arrow')}</a>
          <a class="btn btn-ghost btn-block" href="tel:{c['tel']}">{icon('phone')} Call {c['phone']}</a>
        </div>
      </nav>

      <div class="header-actions">
        <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark theme">
          {icon('moon', 'icon icon-moon')}{icon('sun', 'icon icon-sun')}
        </button>
        <a class="btn btn-primary header-cta" href="quote.html"{current_attr(active == "quote")}>Get a quote</a>
        <button class="icon-btn nav-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Open menu">
          {icon('menu', 'icon icon-open')}{icon('close', 'icon icon-close')}
        </button>
      </div>
    </div>
  </header>
"""


def footer():
    """Footer call-to-action band, link columns, legal bar, mobile quick-action bar and back-to-top."""
    c = COMPANY
    columns = "".join(
        f"""
      <nav class="footer-col" aria-label="Footer: {heading.lower()}">
        <h3>{heading}</h3>
        <ul>{"".join(f'<li><a href="{href}">{label}</a></li>' for label, href in items)}</ul>
      </nav>"""
        for heading, items in FOOTER_COLUMNS
    )
    social = "".join(
        f'<li><a href="{esc(url)}" target="_blank" rel="noopener" aria-label="SwiftLink on {name.title()}">{icon(name)}</a></li>'
        for name, url in SOCIAL.items() if url
    )
    social = f'\n        <ul class="footer-social" aria-label="Social media">{social}</ul>' if social else ""
    legal = "".join(f'<li><a href="{href}">{label}</a></li>' for label, href in LEGAL_LINKS)
    return f"""
  <!-- Footer call to action (hidden on the quote page via CSS: body[data-page="quote"]) -->
  <section class="footer-cta" aria-labelledby="footer-cta-title">
    <div class="container footer-cta-inner">
      <div>
        <p class="eyebrow eyebrow-light">Ready when you are</p>
        <h2 id="footer-cta-title">Get a price in under a minute.</h2>
        <p>Tell us what's moving and where. You'll see an indicative price straight away, and dispatch confirms your booking, usually within 15 minutes.</p>
      </div>
      <div class="footer-cta-actions">
        <a class="btn btn-primary btn-lg" href="quote.html">Start a quote {icon('arrow')}</a>
        <a class="btn btn-outline-light btn-lg" href="https://wa.me/{c['whatsapp']}" target="_blank" rel="noopener">{icon('whatsapp')} WhatsApp dispatch</a>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="brand brand-light" href="index.html" aria-label="SwiftLink home">
          {LOGO}
          <span class="brand-text"><strong>SwiftLink</strong><small>Logistics &amp; Transport</small></span>
        </a>
        <p>Licensed, insured transport and logistics across Singapore, run by one team that's reachable 24 hours a day.</p>
        <!-- Licence number and registered office must stay visible on every page (brand requirement). -->
        <dl class="footer-reg">
          <div><dt>LTA Licence</dt><dd>{c['licence']}</dd></div>
          <div><dt>Registered office</dt><dd>{c['address']}</dd></div>
        </dl>{social}
      </div>
{columns}

      <div class="footer-col">
        <h3>24/7 dispatch</h3>
        <ul class="footer-contact">
          <li><a href="tel:{c['tel']}">{icon('phone')}{c['phone']}</a></li>
          <li><a href="https://wa.me/{c['whatsapp']}" target="_blank" rel="noopener">{icon('whatsapp')}WhatsApp</a></li>
          <li><a href="mailto:{c['email']}">{icon('mail')}{c['email']}</a></li>
        </ul>
      </div>
    </div>

    <div class="container footer-bottom">
      <p>© <span data-year>{datetime.date.today().year}</span> {esc(c['name'])}. UEN {c['uen']}.</p>
      <ul class="footer-legal">{legal}</ul>
    </div>
  </footer>

  <!-- Mobile quick-action bar (visible below 720px only) -->
  <nav class="mobile-bar" aria-label="Quick actions">
    <a href="tel:{c['tel']}">{icon('phone')}<span>Call</span></a>
    <a href="https://wa.me/{c['whatsapp']}" target="_blank" rel="noopener">{icon('whatsapp')}<span>WhatsApp</span></a>
    <a href="track.html">{icon('search')}<span>Track</span></a>
    <a class="mobile-bar-cta" href="quote.html">{icon('bolt')}<span>Quote</span></a>
  </nav>

  <a class="back-to-top" href="#top" aria-label="Back to top">{icon('up')}</a>
"""


# =============================================================================
# 7. BUILD
# =============================================================================
def parse_page(path):
    """Split a source page into (settings dict, body HTML)."""
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--(.*?)-->", raw, re.S)
    if not m:
        raise ValueError(f"{path.name}: missing the <!-- title/description/nav --> header block")
    meta = {}
    for line in m.group(1).strip().splitlines():
        k, _, v = line.partition(":")
        if k.strip():
            meta[k.strip()] = v.strip()
    for required in ("title", "description", "nav"):
        if required not in meta:
            raise ValueError(f"{path.name}: header block needs a '{required}:' line")
    return meta, raw[m.end():]


def render_body(body, sgmap):
    """Replace {{icon:..}}, {{c:..}}, {{s:..}} and {{sgmap}} placeholders."""
    body = re.sub(r"\{\{icon:([a-z-]+)\}\}", lambda mm: icon(mm.group(1)), body)
    body = body.replace("{{sgmap}}", sgmap)
    body = re.sub(r"\{\{c:([a-z_]+)\}\}", lambda mm: esc(COMPANY[mm.group(1)]), body)
    body = re.sub(r"\{\{s:([a-z_0-9]+)\}\}", lambda mm: esc(SITE[mm.group(1)]), body)
    return pictures(body)


def write_sitemap(entries):
    """sitemap.xml listing every indexable page (submit it in Google Search Console)."""
    today = datetime.date.today().isoformat()
    urls = "".join(
        f"\n  <url><loc>{abs_url(name)}</loc><lastmod>{today}</lastmod></url>"
        for name in entries
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}\n</urlset>\n'
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    print("built sitemap.xml")


def write_robots():
    """robots.txt: allow everything except the build sources, and point to the sitemap."""
    txt = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /_src/\n"
        "Disallow: /_tools/\n\n"
        f"Sitemap: {SITE['url']}/sitemap.xml\n"
    )
    (ROOT / "robots.txt").write_text(txt, encoding="utf-8")
    print("built robots.txt")


def build():
    sgmap = (SRC / "sgmap.svg").read_text(encoding="utf-8")
    sitemap = []
    # index.html first so it heads the sitemap, then the rest alphabetically.
    pages = sorted((SRC / "pages").glob("*.html"), key=lambda p: (p.name != "index.html", p.name))
    for page in pages:
        meta, body = parse_page(page)
        extra = f'\n  <script src="assets/js/{meta["script"]}" defer></script>' if meta.get("script") else ""
        out = (
            head(page.name, meta, extra)
            + f'\n<body data-page="{meta["nav"]}">\n  '
            + sprite()
            + header(meta["nav"])
            + '\n  <main id="main">'
            + render_body(body, sgmap).rstrip()
            + "\n  </main>\n"
            + footer()
            + "</body>\n</html>\n"
        )
        if meta.get("rootlinks") == "yes":
            out = root_links(out)
        (ROOT / page.name).write_text(out, encoding="utf-8")
        print("built", page.name)
        if "noindex" not in meta.get("robots", "") and meta.get("sitemap") != "no":
            sitemap.append(page.name)
    write_sitemap(sitemap)
    write_robots()


if __name__ == "__main__":
    build()
