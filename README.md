# SwiftLink Logistics & Transport — Website Template

A responsive, three-page business website for a transport and logistics company.
It uses plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Pages

| Page | Contents |
|---|---|
| `index.html` | Home: hero, key numbers, about summary, services, why us, coverage, process, photo preview, testimonials carousel, FAQ, contact form |
| `about.html` | About Us: company story, mission & vision, values, milestones timeline, teams, industries served, credentials |
| `gallery.html` | Photo documentation: filterable gallery (Fleet / Warehouse / Operations / Team) with a full-screen photo viewer |

## Files

```
index.html, about.html, gallery.html
assets/css/styles.css      All styling; brand colours are tokens at the top
assets/js/main.js          Menu, scroll effects, testimonials carousel, gallery viewer, contact form
assets/images/photos/      Photographs (JPG) used across all pages
assets/images/*.svg        Logo mark (favicon.svg), hero illustration, spare service illustrations
_previous-version/         The old flyer-based files; safe to delete
```

## Preview and deploy

Open `index.html` in any modern browser. No server is needed.

To publish, upload the whole folder (keeping `index.html` at the root) to any static host:

- **Netlify:** drag the folder onto app.netlify.com/drop
- **GitHub Pages:** push to a repo, then Settings → Pages
- **cPanel / shared hosting:** upload into `public_html/`

Leave out `_previous-version/` and this README when you upload.

## Customising

| What | Where |
|---|---|
| Colours | `:root` tokens at the top of `assets/css/styles.css` (`--navy`, `--teal`, `--grey`) |
| Company details (name, phone, email, address, licence) | Search all three HTML files for `SwiftLink`, `6777 4599`, `enquiry@`, `609876`, `LTA/TS`. Also update the JSON-LD block in the `<head>` of `index.html` |
| Header, footer and icons | Repeated in each HTML file. If you change the menu, change it in all three |
| Logo | Replace `assets/images/favicon.svg`. It is used in the header, the footer and the browser tab |
| Photos | Replace files in `assets/images/photos/` with the same names, or update the `src`, `alt`, `width` and `height` in the HTML |

### Testimonials (`index.html`, section `#testimonials`)

Each testimonial is one `<li class="quote-card">` inside the carousel. Copy one to add more; the dots and arrows update automatically.
Fill in the service tag, the quote, the name, the role and company type, and the initials in the avatar.

### Gallery (`gallery.html`)

Each photo is one `<figure class="gallery-item">`:

- `data-category`: `fleet`, `warehouse`, `operations` or `team`. This controls which filter button shows the photo.
- Add `is-wide` (two columns) or `is-tall` (two rows) to make a photo bigger. Mixing one wide or tall photo with two normal ones per block keeps the grid free of gaps.
- Update the `aria-label` on the button, the `alt` text and the caption.

### Contact form

- **Default (no setup):** submitting opens the visitor's email app with the request pre-filled, addressed to the form's `data-email`.
- **Background submit:** put a form-service endpoint (for example Formspree) in the form's `action="..."`. The script then posts the form and shows a thank-you message.

## Before going live: replace sample content

These parts are realistic **placeholders** written for the template. Replace or confirm them with the client before publishing:

- **Testimonials:** the six client names, roles and quotes are samples. Use only real, approved client feedback.
- **About page:** the company story, the founding year and milestones (2014–2023), mission, vision and the list of industries.
- **Photos:** these are stock photos from Unsplash, showing generic logistics scenes rather than SwiftLink's own fleet, staff or premises. Swap them for the company's real photo documentation as soon as it is available.
- **Numbers:** 12+ years, 24/7 and 100% coverage come from the original brief.

The licence number and registered office address must stay visible on the site (brand requirement).

## Photo credits

All photos are from [Unsplash](https://unsplash.com) and are free to use under the [Unsplash License](https://unsplash.com/license). Credit is not required but appreciated.

| File | Photographer | Unsplash ID |
|---|---|---|
| van-parcels.jpg | Claudio Schwarz | a85IYeAXgxU |
| truck-singapore-street.jpg | CHUTTERSNAP | rbEas9k2TUg |
| warehouse-forklift.jpg | Bernd Dittrich | F2C_mSrb6iM |
| chauffeur-driving.jpg | Thibault Penin | a8r2KKLSntA |
| executive-vehicle.jpg | George Sargiannidis | NFxlLt9xkuQ |
| van-open-road.jpg | Andrew Charney | FvxQPSFMJr0 |
| singapore-port.jpg | CHUTTERSNAP | eqwFWHfQipg |
| container-yard-aerial.jpg | CHUTTERSNAP | 9cCeS9Sg6nU |
| container-stacks.jpg | CHUTTERSNAP | Q4bmoSPJM18 |
| team-planning.jpg | Vitaly Gariev | _4tpElFQemQ |
| team-discussion.jpg | Vitaly Gariev | 5V6KbvRcnV8 |
| operations-meeting.jpg | Sable Flow | KHpjeuaWOec |
| singapore-skyline.jpg | Sigrid | 3GRENNknIsw |
| singapore-sunset.jpg | Peter Nguyen | CQhgno3yhv8 |

A photo's page is `https://unsplash.com/photos/<Unsplash ID>`.

## Brand spec

| Role | Colour |
|---|---|
| Primary: Deep Navy Blue | `#0A2463` |
| Secondary: Bright Teal | `#247BA0` |
| Accent: Warm Grey | `#E0E0E0` |
| Accent: White | `#FFFFFF` |

Typography: Roboto (Google Fonts), falling back to Helvetica / Arial / Calibri.

## Included

- Responsive layouts for desktop, tablet and phone, with a mobile menu
- Testimonials carousel (swipe, arrow buttons, dots, keyboard arrows)
- Gallery filters and a full-screen viewer (click, arrow keys, Esc to close)
- Scroll-in animations that turn off when the visitor prefers reduced motion
- Accessibility: skip link, labelled form fields, keyboard focus styles, AA colour contrast
- SEO: page titles and descriptions, Open Graph tags, LocalBusiness structured data
