/*
  =====================================================================
  SwiftLink — shipment tracking (track.html only)
  =====================================================================
  Looks up a booking number and renders status, route progress, timeline,
  booking details and proof of delivery.

  DATA SOURCE
    The template reads DEMO records from config.js → shipments. To connect
    a real dispatch/TMS system, replace lookup() below so it returns a
    Promise for a record in the same shape, for example:

      function lookup(key) {
        return fetch('https://api.example.com/track/' + encodeURIComponent(key))
          .then(function (r) { return r.ok ? r.json() : null; });
      }

    Record shape (see config.js for full examples):
      { status: 'in-transit' | 'delivered' | 'scheduled', service, vehicle,
        from, to, eta, items, driver, plate, progress: 0…1,
        events: [{ t, title, note, done }], pod?: { signedBy, photos } }

    All text from the record is escaped with esc() before it is inserted,
    so API data cannot inject HTML.

  URLS
    track.html?id=SL-240918 opens a booking directly; the "Copy tracking
    link" button shares that URL. Numbers without the "SL-" prefix are
    accepted (e.g. 240918).
*/
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var SL = window.SL, CFG = window.SWIFTLINK, $ = SL.$;
  var form = $('[data-track-form]'), out = $('[data-track-output]');
  if (!form) return;
  var input = form.elements.id;

  /* Status key → [label, chip colour class]. Add new statuses here. */
  var STATUS = {
    'in-transit': ['In transit', 'chip-signal'],
    delivered: ['Delivered', 'chip-ok'],
    scheduled: ['Scheduled', 'chip-accent']
  };
  function ic(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Normalise what the visitor typed: " sl 240918 " → "SL-240918". */
  function normalise(id) {
    var key = id.trim().toUpperCase().replace(/\s+/g, '');
    if (key && key.indexOf('SL-') !== 0 && /^\d+$/.test(key)) key = 'SL-' + key;
    return key;
  }

  /* DATA SOURCE: returns a Promise for the record, or null when not found. Replace for a live API. */
  function lookup(key) {
    return Promise.resolve((CFG.shipments || {})[key] || null);
  }

  /* "Not found" panel with call / WhatsApp shortcuts. */
  function renderMissing(key) {
    out.innerHTML = '<div class="track-empty">' + ic('search') + '<h2>We couldn’t find ' + esc(key || 'that number') + '</h2>' +
      '<p>Check the number in your confirmation, or contact dispatch and we’ll look it up for you.</p>' +
      '<div class="page-hero-actions" style="justify-content:center"><a class="btn btn-navy" href="tel:' + CFG.company.tel + '">' + ic('phone') + ' Call dispatch</a>' +
      '<a class="btn btn-ghost" href="https://wa.me/' + CFG.company.whatsapp + '?text=' + encodeURIComponent('Hi, I’d like an update on booking ' + key) + '" target="_blank" rel="noopener">' + ic('whatsapp') + ' WhatsApp</a></div></div>';
  }

  /* Full result: status card with route + timeline, and a side column with details and help. */
  function renderShipment(key, s) {
    var st = STATUS[s.status] || [s.status, ''];
    // Events are listed in the order given: newest first for delivered/in-transit, chronological for scheduled
    var tl = s.events.map(function (e) {
      return '<li class="' + (e.done ? 'is-done' : '') + '"><span class="dot"></span><div><strong>' + esc(e.title) + '</strong>' + (e.note ? '<p>' + esc(e.note) + '</p>' : '') + '</div><time>' + esc(e.t) + '</time></li>';
    }).join('');
    var pct = Math.round(s.progress * 100);
    var share = location.pathname.split('/').pop() + '?id=' + encodeURIComponent(key);

    out.innerHTML =
      '<div class="track-result">' +
        '<article class="track-card">' +
          '<header class="track-card-head"><div><span class="chip ' + st[1] + '">' + esc(st[0]) + '</span><p class="track-id" style="margin-top:.6rem">' + esc(key) + '</p><p class="muted" style="font-size:var(--text-sm)">' + esc(s.service) + ' · ' + esc(s.vehicle) + '</p></div>' +
          '<div class="track-eta"><small>' + (s.status === 'delivered' ? 'Completed' : s.status === 'scheduled' ? 'Scheduled' : 'Estimated arrival') + '</small><strong>' + esc(s.eta) + '</strong></div></header>' +
          '<div class="route"><div class="route-ends"><div><small>From</small><strong>' + esc(s.from) + '</strong></div><div><small>To</small><strong>' + esc(s.to) + '</strong></div></div>' +
          '<div class="route-line" role="progressbar" aria-label="Journey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span data-route-fill></span><i data-route-dot>' + ic(/charter/i.test(s.service) ? 'bus' : 'truck') + '</i></div>' +
          '<p class="muted" style="font-size:var(--text-xs);text-align:center">' + pct + '% of journey complete</p></div>' +
          '<ol class="timeline">' + tl + '</ol>' +
        '</article>' +
        '<aside>' +
          '<div class="side-card"><h3>Booking details</h3><dl class="kv">' +
            '<div><dt>Load</dt><dd>' + esc(s.items) + '</dd></div>' +
            '<div><dt>Driver</dt><dd>' + esc(s.driver) + '</dd></div>' +
            '<div><dt>Vehicle plate</dt><dd class="mono">' + esc(s.plate) + '</dd></div>' +
          '</dl>' + (s.pod ? '<div class="pod">' + ic('signature') + '<span>Signed by ' + esc(s.pod.signedBy) + ' · ' + esc(s.pod.photos) + ' photos</span></div>' : '') + '</div>' +
          '<div class="side-card"><h3>Need help with this booking?</h3><div style="display:grid;gap:.6rem">' +
            '<a class="btn btn-navy btn-block" href="tel:' + CFG.company.tel + '">' + ic('phone') + ' Call dispatch</a>' +
            '<a class="btn btn-ghost btn-block" href="https://wa.me/' + CFG.company.whatsapp + '?text=' + encodeURIComponent('Hi, about booking ' + key + ':') + '" target="_blank" rel="noopener">' + ic('whatsapp') + ' WhatsApp about ' + esc(key) + '</a>' +
            '<button class="btn btn-ghost btn-block" type="button" data-share="' + esc(share) + '">' + ic('copy') + ' Copy tracking link</button>' +
          '</div></div>' +
          // TEMPLATE NOTE: remove this line once lookup() is connected to the live system.
          '<p class="rates-note">' + ic('info') + ' Demo data for the website template. Connect your dispatch system to show live bookings.</p>' +
        '</aside>' +
      '</div>';

    // In-transit: the most recent completed event (first .is-done) is the "now" marker
    if (s.status === 'in-transit') {
      var lis = out.querySelectorAll('.timeline li.is-done');
      if (lis[0]) lis[0].classList.add('is-now');
    }
    // Animate the route bar on the next frame so the CSS transition runs
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        out.querySelector('[data-route-fill]').style.width = pct + '%';
        out.querySelector('[data-route-dot]').style.left = pct + '%';
      });
    });
    var sb = out.querySelector('[data-share]');
    sb.addEventListener('click', function () {
      var url = new URL(sb.getAttribute('data-share'), location.href).href;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { SL.toast('Tracking link copied'); }, function () { SL.toast(url); });
    });
  }

  function render(id) {
    var key = normalise(id);
    lookup(key).then(function (s) {
      SL.track('track_shipment', { found: !!s });
      if (s) renderShipment(key, s); else renderMissing(key);
    }).catch(function () { renderMissing(key); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    render(input.value);
    // Put the number in the URL so the page can be bookmarked or shared
    try { history.replaceState(null, '', '?id=' + encodeURIComponent(input.value.trim().toUpperCase())); } catch (err) {}
  });
  var initial = new URLSearchParams(location.search).get('id');
  if (initial) { input.value = initial.toUpperCase(); render(initial); }
});
