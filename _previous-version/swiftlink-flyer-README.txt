SWIFTLINK LOGISTICS & TRANSPORT — A5 FLYER (DIGITAL PREVIEW)
Project reference: SLT-FLY-2026-002
Client: SwiftLink Logistics & Transport Pte Ltd, Singapore

--------------------------------------------------------------------
1. FILES
--------------------------------------------------------------------
swiftlink-flyer.html    Markup only. Loads Google Fonts (Roboto),
                         swiftlink-flyer.css, and swiftlink-flyer.js.
                         No inline <style> or <script>.
swiftlink-flyer.css     All visual styling: colours, typography,
                         page/print layout, and print rules.
swiftlink-flyer.js      Wires up the "Print / Export PDF" button
                         (calls window.print()).
swiftlink-flyer-README.txt   This file.

--------------------------------------------------------------------
2. HOW TO PREVIEW
--------------------------------------------------------------------
- Open swiftlink-flyer.html directly in any modern browser
  (Chrome, Edge, Safari, Firefox). No build step or server needed.
- The page shows the FRONT and BACK sides stacked, each rendered
  at true A5 proportions (148mm x 210mm).
- Click "Print / Export PDF" in the top bar to open the browser
  print dialog. The dark preview bar and page labels are hidden
  automatically when printing (@media print in the CSS).

--------------------------------------------------------------------
3. PRINT / PRODUCTION NOTES
--------------------------------------------------------------------
- This HTML/CSS file is the RGB / on-screen reference only.
  It is NOT the print-ready deliverable.
- Final production files must still be prepared in Illustrator /
  InDesign as:
    - Print-ready PDF, CMYK, 300 DPI, 2mm bleed, 3mm safe margin
    - Editable .AI / .INDD source
    - RGB JPG/PNG at 72 DPI for digital/web use
- Paper stock: 157-200 gsm art paper, matte lamination.
- @page is set to size:148mm 210mm; margin:0 so a browser PDF
  export approximates trim size, but it does NOT add bleed or
  registration/trim marks — those must be added in the print
  layout application.

--------------------------------------------------------------------
4. BRAND SPEC (do not change without client approval)
--------------------------------------------------------------------
Colours:
  Primary    Deep Navy Blue   #0A2463
  Secondary  Bright Teal      #247BA0
  Accent     Warm Grey        #E0E0E0
  Accent     White            #FFFFFF

Typography:
  Headings   Bold sans-serif — Roboto (loaded), fallback
             Helvetica / Arial / Calibri
  Body       Minimum 9pt equivalent, clear line spacing

Must remain visible on every version:
  - Company name / logo
  - LTA License No.: LTA/TS/2023/01987
  - Registered office address: 456 Logistics Avenue, #03-22,
    Singapore 609876

--------------------------------------------------------------------
5. CUSTOMISING
--------------------------------------------------------------------
- Colours: edit the CSS custom properties at the top of
  swiftlink-flyer.css (:root { --navy; --teal; --grey; --white }).
- Logo: replace the inline SVG in the .logo-row block (HTML) with
  the client's actual logo file once supplied.
- Hero photo: the .hero-photo block currently shows an SVG
  placeholder (skyline silhouette + line-art truck) tagged
  "PLACEHOLDER". Replace with a real fleet photo, e.g.:
    <div class="hero-photo" style="background-image:url('fleet.jpg')">
  and remove the placeholder <svg> and .placeholder-tag element.
- Icons: all service/contact/checklist icons are inline SVG line
  icons (single colour, teal). Swap for a licensed icon set if the
  studio uses one; keep the same stroke-based, single-colour style.
- Copy: all text is taken verbatim from the approved brief. Do not
  alter claims, license numbers, or contact details without sign-off.

--------------------------------------------------------------------
6. PROJECT TIMELINE
--------------------------------------------------------------------
First draft:   within 3 working days
Revisions:     up to 2 rounds
Production:    requires final client approval before print
