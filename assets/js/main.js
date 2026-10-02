/*
  =====================================================================
  SwiftLink Logistics & Transport — shared site behaviour (main.js)
  =====================================================================
  Loaded on every page after config.js. Plain ES5, no dependencies, so it
  runs on any static host and older mobile browsers.

  HOW IT IS ORGANISED
    1. Helpers + pricing engine  → exposed as window.SL for quote.js / track.js
    2. Global behaviour          → year, clock, dispatch status, theme, menu,
                                   scroll effects, reveal animation, analytics
    3. Page modules (init*)      → each one looks for its own data-* hook and
                                   returns immediately if the page doesn't have it,
                                   so every module is safe to run on every page.

  HTML HOOKS (data attributes) → MODULE
    [data-console]          initConsole   hero estimate + quick tracking (index)
    [data-sg-map]           initMap       coverage map (index)
    [data-faq-list]         initFaq       FAQ search and filters (index)
    [data-fleet-grid]       initFleet     fleet cards (services)
    [data-matcher]          initMatcher   vehicle matcher (services)
    [data-rates-table]      initRates     rates table (services)
    [data-subnav]           initSubnav    sticky in-page nav highlight (services)
    [data-gallery]          initGallery   filters + lightbox (gallery)
    [data-contact-form]     initContact   contact form (contact)
    [data-legal-toc]        initLegalToc  table-of-contents highlight (privacy, terms)

  To add a feature: write an initSomething() that starts with
  `var el = $('[data-something]'); if (!el) return;` and call it from the
  DOMContentLoaded handler below.
*/
(function () {
  'use strict';

  var CFG = window.SWIFTLINK || {};
  /** $(selector, root?) → first match; $$(selector, root?) → array of matches. */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ==================================================================
     1. PRICING ENGINE
     Shared by the hero estimate (index) and the quote wizard (quote.js).
     All numbers come from config.js, so prices are changed there.
     ================================================================== */

  /** Vehicle object from config.js by id, or undefined. */
  function vehicle(id) {
    return (CFG.vehicles || []).filter(function (v) { return v.id === id; })[0];
  }
  /** 1234.5 → "S$1,235" */
  function money(n) { return (CFG.currency || 'S$') + Math.round(n).toLocaleString('en-SG'); }
  function round5(n) { return Math.round(n / 5) * 5; }

  /**
   * Public holiday name for a 'YYYY-MM-DD' date, or '' if it isn't one.
   * The list lives in config.js → publicHolidays.
   */
  function isHoliday(date) {
    return (date && CFG.publicHolidays && CFG.publicHolidays[date]) || '';
  }

  /**
   * Calculate an indicative price.
   * @param {Object} s  booking state:
   *   service   key of CFG.services            (required)
   *   vehicle   vehicle id                      (goods / people)
   *   from, to  region keys                     (goods: distance factor)
   *   hours     number                          (people)
   *   pallets, weeks                            (storage)
   *   priority  'urgent' | 'standard'
   *   date      'YYYY-MM-DD', time 'HH:MM'      (surcharges)
   *   holiday   true to force the public holiday surcharge
   *   addons    { addonId: quantity }
   * @returns {Object} { base, lines[], surcharges[], addons[], total, low, high, basis }
   *   lines = [label, detail, amount], surcharges/addons = [label, amount]
   */
  function calc(s) {
    var out = { base: 0, lines: [], surcharges: [], addons: [], total: 0, low: 0, high: 0, basis: '' };
    var svc = CFG.services[s.service];
    if (!svc) return out;

    if (svc.type === 'storage') {
      // Storage: pallets × weeks × weekly rate, plus handling in AND out.
      var st = CFG.storage;
      var p = Math.max(st.minPallets, +s.pallets || st.minPallets);
      var w = Math.max(1, +s.weeks || 1);
      out.base = p * w * st.perPalletWeek + p * 2 * st.handlingPerPallet;
      out.lines.push(['Storage', p + ' pallets × ' + w + ' wk', p * w * st.perPalletWeek]);
      out.lines.push(['Handling in / out', p + ' pallets', p * 2 * st.handlingPerPallet]);
      out.basis = 'for ' + w + ' week' + (w > 1 ? 's' : '') + ', before GST';
    } else {
      var v = vehicle(s.vehicle) || vehicle(svc.vehicles[0]);
      if (!v) return out;
      if (v.unit === 'hour') {
        // People: hourly rate × hours, never below the service minimum.
        var h = Math.max(svc.minHours || 1, +s.hours || svc.minHours || 1);
        out.base = v.rate * h;
        out.lines.push([v.name, h + ' h × ' + money(v.rate), out.base]);
        out.basis = 'for ' + h + ' hour' + (h > 1 ? 's' : '') + ', before GST';
      } else {
        // Goods: trip rate × distance factor between regions.
        var f = CFG.regionFactor(s.from, s.to);
        out.base = v.rate * f;
        out.lines.push([v.name, 'Base trip', v.rate]);
        if (f > 1) out.lines.push(['Cross-region distance', '+' + Math.round((f - 1) * 100) + '%', v.rate * (f - 1)]);
        out.basis = 'per trip, before GST';
      }
    }

    // Surcharges are a percentage of the base price and stack.
    var sc = CFG.surcharges;
    if (s.priority === 'urgent') out.surcharges.push(['Urgent (within 3 h)', out.base * sc.urgent]);
    if (s.time) {
      var hr = parseInt(String(s.time).split(':')[0], 10);
      if (hr >= 22 || hr < 7) out.surcharges.push(['After-hours pickup', out.base * sc.afterHours]);
    }
    var isSunday = false;
    if (s.date) { var d = new Date(s.date + 'T12:00:00'); isSunday = d.getDay() === 0; }
    var ph = isHoliday(s.date);
    if (isSunday || ph || s.holiday) {
      out.surcharges.push([isSunday ? 'Sunday' : ph ? 'Public holiday (' + ph + ')' : 'Public holiday', out.base * sc.weekend]);
    }

    // Add-ons are flat prices × quantity.
    (CFG.addons || []).forEach(function (a) {
      var q = s.addons && s.addons[a.id];
      if (q) out.addons.push([a.label + (q > 1 ? ' × ' + q : ''), a.price * q]);
    });

    var sum = out.base;
    out.surcharges.forEach(function (x) { sum += x[1]; });
    out.addons.forEach(function (x) { sum += x[1]; });
    out.total = sum;
    // Show a range rather than one exact figure, because dispatch confirms the final price.
    out.low = round5(sum * (1 - CFG.spread));
    out.high = round5(sum * (1 + CFG.spread));
    return out;
  }

  /** calc() result → "S$95 – 120" (or "S$—" when there is no price yet). */
  function rangeText(r) { return r.total ? money(r.low) + ' – ' + money(r.high).replace(CFG.currency, '') : (CFG.currency || 'S$') + '—'; }

  /** Fill a <select> with the regions from config.js. */
  function fillRegions(select, selected) {
    select.innerHTML = '';
    Object.keys(CFG.regions).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = CFG.regions[k].name;
      if (k === selected) o.selected = true;
      select.appendChild(o);
    });
  }
  /** Fill a <select> with numbers from..to, e.g. "3 hours". */
  function fillRange(select, from, to, suffix, selected, step) {
    select.innerHTML = '';
    for (var i = from; i <= to; i += (step || 1)) {
      var o = document.createElement('option');
      o.value = i; o.textContent = i + ' ' + suffix + (i > 1 && suffix.slice(-1) !== 's' ? 's' : '');
      if (i === selected) o.selected = true;
      select.appendChild(o);
    }
  }

  /** Small temporary message at the bottom of the screen (e.g. "Link copied"). */
  var toastTimer;
  function toast(msg) {
    var t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 2400);
  }

  /**
   * POST a FormData object to a form endpoint (see config.js → forms).
   * Resolves on any 2xx response, rejects otherwise.
   */
  function post(url, data) {
    return fetch(url, { method: 'POST', body: data, headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    });
  }

  /**
   * Send an analytics event. Works with Google Analytics 4 (gtag) or Google
   * Tag Manager (dataLayer) when either is installed, and does nothing
   * otherwise. Enable GA4 with SITE["ga4_id"] in _tools/build.py.
   *   SL.track('generate_lead', { form: 'quote', value: 120 })
   */
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
      else if (window.dataLayer) window.dataLayer.push(Object.assign({ event: name }, params || {}));
    } catch (e) { /* analytics must never break the page */ }
  }

  /* ---------------- Form validation ----------------
     Validates the named fields of a form and shows messages in the matching
     <span class="field-error" data-error-for="name">. Rules:
       • empty → required          • type="email" → basic email pattern
       • type="tel" → ≥ 8 digits   • type="checkbox" → must be ticked
     Focuses the first invalid field. Returns true when everything is valid. */
  function validate(form, names) {
    var ok = true, first = null;
    names.forEach(function (n) {
      var el = form.elements[n]; if (!el) return;
      var f = el.closest('.field'), err = $('[data-error-for="' + n + '"]', form), msg = '';
      if (el.type === 'checkbox') {
        if (!el.checked) msg = el.getAttribute('data-required-msg') || 'Please tick this box to continue.';
      } else {
        var v = (el.value || '').trim();
        if (!v) msg = 'This field is required.';
        else if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Enter a valid email address.';
        else if (el.type === 'tel' && v.replace(/\D/g, '').length < 8) msg = 'Enter a valid phone number.';
      }
      if (f) f.classList.toggle('has-error', !!msg);
      if (err) err.textContent = msg;
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) { ok = false; if (!first) first = el; }
    });
    if (first) first.focus();
    return ok;
  }

  /* Public API used by quote.js and track.js. */
  window.SL = {
    calc: calc, money: money, rangeText: rangeText, vehicle: vehicle, isHoliday: isHoliday,
    fillRegions: fillRegions, fillRange: fillRange, toast: toast, post: post, track: track,
    validate: validate, $: $, $$: $$
  };

  /* ==================================================================
     2. GLOBAL BEHAVIOUR (every page)
     ================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    // Footer copyright year
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // Singapore clock in the utility bar (updates every 20 s)
    var clock = $('[data-sg-clock]');
    if (clock) {
      var fmt = new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
      var tick = function () { clock.textContent = fmt.format(new Date()) + ' SGT'; };
      tick(); setInterval(tick, 20000);
    }
    initDispatchStatus();

    /* Theme toggle. The initial theme is set in <head> (before paint) from
       ?theme= or the system setting. The choice is not stored; instead it
       is carried to the next page through ?theme= on internal links. */
    var root = document.documentElement;
    var tbtn = $('[data-theme-toggle]');
    function syncThemeLabel() {
      var t = root.getAttribute('data-theme');
      if (tbtn) tbtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    if (tbtn) tbtn.addEventListener('click', function () {
      root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      syncThemeLabel();
    });
    syncThemeLabel();
    // Carry an explicitly chosen theme across internal links (only when it differs from the system theme)
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;
      var href = a.getAttribute('href');
      if (!/\.html/.test(href) || /^(https?:|mailto:|tel:)/.test(href)) return;
      var sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
      var cur = root.getAttribute('data-theme');
      if ((cur === 'dark') === sysDark) return;
      var url = new URL(href, location.href);
      url.searchParams.set('theme', cur);
      a.href = url.href;
    });

    /* Analytics: report contact-intent clicks (call, WhatsApp, email) as events. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (/^tel:/.test(href)) track('contact_click', { method: 'phone' });
      else if (/wa\.me\//.test(href)) track('contact_click', { method: 'whatsapp' });
      else if (/^mailto:/.test(href)) track('contact_click', { method: 'email' });
    });

    /* Mobile navigation (below 960px the nav becomes a full-screen panel) */
    var nav = $('#main-nav');
    var toggle = $('.nav-toggle');
    var header = $('.site-header');
    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';   // stop the page scrolling behind the menu
      if (open) {
        var r = header.getBoundingClientRect();
        nav.style.top = r.bottom + 'px';                      // panel starts right under the header
      }
    }
    if (nav && toggle) {
      toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
      });
      window.addEventListener('resize', function () { if (innerWidth > 960 && nav.classList.contains('is-open')) setMenu(false); });
    }

    /* Header shadow after scrolling + back-to-top button */
    var btt = $('.back-to-top');
    function onScroll() {
      var y = scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 40);
      if (btt) btt.classList.toggle('is-visible', y > 700);
    }
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    /* Reveal: elements with class="reveal" fade in when scrolled into view.
       Siblings are staggered by 60ms. Without JS (no .js on <html>) they
       are simply visible. Reduced-motion users get no animation (CSS). */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
      $$('.reveal').forEach(function (el) {
        var i = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.transitionDelay = Math.min(i, 5) * 60 + 'ms';
        io.observe(el);
      });
    } else { $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); }); }

    /* Sample tracking-number chips (data-fill="SL-…") fill the nearest input.
       On the Track page they also submit the form straight away. */
    $$('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var form = b.closest('form') || $('[data-track-form]');
        var input = form && $('input', form);
        if (input) { input.value = b.getAttribute('data-fill'); input.focus(); }
        if (b.closest('.page-hero') && $('[data-track-form]')) $('[data-track-form]').requestSubmit();
      });
    });

    // Page modules: each one exits immediately if its markup isn't on the page.
    initConsole();
    initMap();
    initFaq();
    initFleet();
    initMatcher();
    initRates();
    initSubnav();
    initGallery();
    initContact();
    initLegalToc();
  });

  /* ==================================================================
     3. PAGE MODULES
     ================================================================== */

  /* ---------------- Dispatch status (utility bar) ----------------
     Shows "Dispatch online" or the offline text based on config.js →
     dispatch.hours, evaluated in Singapore time. hours: null = 24/7. */
  function initDispatchStatus() {
    var label = $('[data-dispatch-status]'), dot = $('[data-dispatch-dot]');
    var cfg = CFG.dispatch || {};
    if (!label || !cfg.hours) return;   // 24/7: keep the static "online" markup
    function update() {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var get = function (t) { return (parts.filter(function (p) { return p.type === t; })[0] || {}).value; };
      var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      var now = get('hour') + ':' + get('minute');
      var h = cfg.hours, days = h.days || [0, 1, 2, 3, 4, 5, 6];
      var open = days.indexOf(day) > -1 && now >= h.open && now < h.close;
      label.textContent = open ? (cfg.onlineText || 'Dispatch online') : (cfg.offlineText || 'Dispatch closed');
      if (dot) dot.classList.toggle('is-off', !open);
    }
    update(); setInterval(update, 60000);
  }

  /* ---------------- Hero console (index) ----------------
     Two tabs (ARIA tabs pattern, arrow-key navigation):
       • Instant estimate: a mini version of the quote wizard. The
         "Continue to full quote" link carries the choices to quote.html
         as URL parameters (?service=…&vehicle=…).
       • Track shipment: plain GET form to track.html?id=…           */
  function initConsole() {
    var box = $('[data-console]');
    if (!box) return;
    var tabs = $$('[role="tab"]', box);
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          select(n); n.focus();
        }
      });
    });

    var form = $('[data-quick-quote]', box);
    // Default selection shown on page load
    var state = { service: 'delivery', from: 'west', to: 'central', vehicle: 'lorry10', hours: 3, pallets: 4, weeks: 2 };
    var from = $('#qq-from'), to = $('#qq-to'), veh = $('#qq-vehicle'), hours = $('#qq-hours'), pallets = $('#qq-pallets'), weeks = $('#qq-weeks');
    fillRegions(from, state.from); fillRegions(to, state.to);
    fillRange(pallets, 2, 40, 'pallet', 4); fillRange(weeks, 1, 12, 'week', 2);

    // Rebuild the vehicle + hours selects when the service changes
    function setVehicles() {
      var svc = CFG.services[state.service];
      veh.innerHTML = '';
      (svc.vehicles || []).forEach(function (id) {
        var v = vehicle(id), o = document.createElement('option');
        o.value = id; o.textContent = v.name + ' · ' + (v.capacity || v.seats + ' seats');
        veh.appendChild(o);
      });
      if (svc.type === 'goods') veh.selectedIndex = 1;
      state.vehicle = veh.value;
      var min = svc.minHours || 1;
      fillRange(hours, min, 12, 'hour', Math.max(min, 3));
      state.hours = +hours.value;
    }
    // Show only the fields that matter for the service, update price + continue link
    function render() {
      var svc = CFG.services[state.service];
      $$('[data-qq-route]', form).forEach(function (el) { el.hidden = svc.type !== 'goods'; });
      $('[data-qq-vehicle]', form).hidden = svc.type === 'storage';
      $('[data-qq-hours]', form).hidden = svc.type !== 'people';
      $('[data-qq-pallets]', form).hidden = svc.type !== 'storage';
      $('[data-qq-weeks]', form).hidden = svc.type !== 'storage';
      var r = calc(state);
      $('[data-qq-total]', form).textContent = rangeText(r);
      $('[data-qq-basis]', form).textContent = r.basis.replace(', before GST', '') + (svc.type === 'goods' ? ', before add-ons' : '');
      var q = new URLSearchParams({ service: state.service });
      if (svc.type === 'goods') { q.set('from', state.from); q.set('to', state.to); }
      if (svc.type !== 'storage') q.set('vehicle', state.vehicle);
      if (svc.type === 'people') q.set('hours', state.hours);
      if (svc.type === 'storage') { q.set('pallets', state.pallets); q.set('weeks', state.weeks); }
      $('[data-qq-continue]', form).href = 'quote.html?' + q.toString();
    }
    $$('[data-service]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-service]', form).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        state.service = b.getAttribute('data-service');
        if (CFG.services[state.service].vehicles) setVehicles();
        render();
      });
    });
    [from, to, veh, hours, pallets, weeks].forEach(function (el) {
      el.addEventListener('change', function () { state[el.name] = el.name === 'from' || el.name === 'to' || el.name === 'vehicle' ? el.value : +el.value; render(); });
    });
    setVehicles(); render();

    var tf = $('[data-quick-track]', box);
    if (tf) tf.addEventListener('submit', function (e) {
      var i = $('input', tf);
      if (!i.value.trim()) { e.preventDefault(); i.focus(); }
    });
  }

  /* ---------------- Coverage map (index) ----------------
     The map SVG (_src/sgmap.svg) has one <path class="map-region"
     data-region="key"> per region; keys match config.js → regions.
     Clicking a region or its tab button shows that region's details. */
  function initMap() {
    var wrap = $('[data-sg-map]');
    if (!wrap) return;
    var svg = $('svg', wrap);
    var tabsBox = $('[data-region-tabs]');
    var order = ['central', 'west', 'north', 'northeast', 'east'];   // tab order

    // Nudge label positions (SVG user units) so each sits inside its region
    var labelPos = { central: [470, 405], west: [215, 300], north: [395, 120], northeast: [700, 175], east: [800, 300] };
    $$('.map-label', svg).forEach(function (t) {
      var k = (t.textContent || '').toLowerCase().replace('-', '');
      if (labelPos[k]) { t.setAttribute('x', labelPos[k][0]); t.setAttribute('y', labelPos[k][1]); }
    });
    // Pulsing pins for the hubs [x, y] in SVG units: registered office (West) + central dispatch
    var ns = 'http://www.w3.org/2000/svg';
    [[268, 345], [520, 430]].forEach(function (p) {
      var g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'map-pin');
      g.innerHTML = '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7"/><circle class="ring" cx="' + p[0] + '" cy="' + p[1] + '" r="7"/>';
      svg.appendChild(g);
    });

    order.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'region-tab'; b.textContent = CFG.regions[k].name;
      b.setAttribute('data-region', k); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { pick(k); });
      tabsBox.appendChild(b);
    });

    function pick(k) {
      var r = CFG.regions[k];
      $$('.map-region', svg).forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-region') === k); p.setAttribute('aria-pressed', String(p.getAttribute('data-region') === k)); });
      $$('.region-tab', tabsBox).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-region') === k)); });
      $('[data-rp-name]').textContent = r.name + ' region';
      $('[data-rp-eta]').textContent = r.eta;
      $('[data-rp-hub]').textContent = r.hub;
      $('[data-rp-areas]').innerHTML = r.areas.map(function (a) { return '<li>' + a + '</li>'; }).join('');
    }
    $$('.map-region', svg).forEach(function (p) {
      var k = p.getAttribute('data-region');
      p.addEventListener('click', function () { pick(k); });
      p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } });
    });
    pick('central');
  }

  /* ---------------- FAQ (index) ----------------
     Each <details class="faq-item" data-cat="…"> is filtered by the
     search box (matches question + answer text) and the topic buttons.
     Only one answer is open at a time. */
  function initFaq() {
    var list = $('[data-faq-list]');
    if (!list) return;
    var q = $('[data-faq-search]'), cats = $$('[data-faq-cats] button'), empty = $('[data-faq-empty]');
    var cat = 'all';
    function apply() {
      var term = (q.value || '').trim().toLowerCase(), shown = 0;
      $$('.faq-item', list).forEach(function (d) {
        var ok = (cat === 'all' || d.getAttribute('data-cat') === cat) && (!term || d.textContent.toLowerCase().indexOf(term) > -1);
        d.hidden = !ok; if (ok) shown++;
      });
      empty.hidden = shown > 0;
    }
    q.addEventListener('input', apply);
    cats.forEach(function (b) {
      b.addEventListener('click', function () {
        cat = b.getAttribute('data-cat');
        cats.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply();
      });
    });
    $$('.faq-item', list).forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) $$('.faq-item', list).forEach(function (o) { if (o !== d) o.open = false; }); });
    });
  }

  /* ---------------- Fleet (services) ----------------
     Cards are generated from config.js → vehicles, so adding a vehicle
     there adds a card here, a row in the rates table and a matcher option. */
  function iconSvg(name) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  function initFleet() {
    var grid = $('[data-fleet-grid]');
    if (!grid) return;
    grid.innerHTML = CFG.vehicles.map(function (v) {
      var specs = v.type === 'goods'
        ? [['Capacity', v.capacity], ['Payload', v.payload], ['Volume', v.cbm + ' m³'], ['Cargo space', v.dims]]
        : [['Seats', v.seats + ' passengers'], ['Luggage', v.luggage], ['Billing', 'Per hour'], ['Driver', 'Included']];
      return '<article class="fleet-card reveal is-visible" data-type="' + v.type + '" data-id="' + v.id + '">' +
        '<div class="fleet-card-head"><span class="fleet-icon">' + iconSvg(v.icon) + '</span><span class="chip">' + (v.type === 'goods' ? 'Goods' : 'Passengers') + '</span></div>' +
        '<h3>' + v.name + '</h3><p>' + v.bestFor + '</p>' +
        '<dl class="fleet-specs">' + specs.map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('') + '</dl>' +
        '<p class="fleet-rate">From <strong>' + money(v.rate) + '</strong> / ' + v.unit + '</p></article>';
    }).join('');
    var btns = $$('[data-fleet-filter] button');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-type');
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $$('.fleet-card', grid).forEach(function (c) { c.hidden = t !== 'all' && c.getAttribute('data-type') !== t; });
      });
    });
  }

  /* ---------------- Vehicle matcher (services) ----------------
     Goods: estimates the volume needed and picks the smallest vehicle with
     enough space (85% usable) and pallet slots; if nothing fits, it
     suggests several of the largest vehicle.
     Passengers: the smallest vehicle with enough seats (and luggage room
     for cars/MPVs); otherwise several coaches.
     Each [data-step] stepper has data-max (limit) and data-inc (step size). */
  function initMatcher() {
    var m = $('[data-matcher]');
    if (!m) return;
    var vals = { cartons: 20, pallets: 0, large: 0, pax: 4, bags: 2 };   // initial counts (match the <output> values in the HTML)
    var mode = 'goods';
    $$('[data-step]', m).forEach(function (st) {
      var key = st.getAttribute('data-step'), max = +st.getAttribute('data-max'), inc = +st.getAttribute('data-inc');
      var out = $('output', st), btn = $$('button', st);
      function set(v) { vals[key] = Math.max(0, Math.min(max, v)); out.textContent = vals[key]; render(); }
      btn[0].addEventListener('click', function () { set(vals[key] - inc); });
      btn[1].addEventListener('click', function () { set(vals[key] + inc); });
    });
    var mbtn = $$('[data-matcher-mode] button', m);
    mbtn.forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-mode');
        mbtn.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $('[data-matcher-goods]', m).hidden = mode !== 'goods';
        $('[data-matcher-people]', m).hidden = mode !== 'people';
        render();
      });
    });
    function render() {
      var list = CFG.vehicles.filter(function (v) { return v.type === mode; });
      var pick, need, cap, why, specs, service;
      if (mode === 'goods') {
        // Volume per item in m³, including a stacking allowance. Tune these to your operations.
        need = vals.cartons * 0.08 + vals.pallets * 1.6 + vals.large * 0.9;
        pick = list.filter(function (v) { return v.cbm * 0.85 >= need && v.pallets >= vals.pallets; })[0];
        var multi = 1;
        if (!pick) { pick = list[list.length - 1]; multi = Math.ceil(need / (pick.cbm * 0.85)); }
        cap = pick.cbm * multi;
        why = need === 0 ? 'Add your items to get a recommendation.' : multi > 1
          ? 'Your load needs about ' + need.toFixed(1) + ' m³, so we’d send ' + multi + ' × ' + pick.name + 's.'
          : 'About ' + need.toFixed(1) + ' m³ of space needed. This is the smallest vehicle that fits with room for safe loading.';
        $('[data-m-name]', m).textContent = (multi > 1 ? multi + ' × ' : '') + pick.name;
        $('[data-m-load]', m).textContent = 'Load ' + Math.min(100, Math.round(need / cap * 100)) + '%';
        $('[data-m-cap]', m).textContent = 'Capacity ' + cap + ' m³';
        $('[data-m-bar]', m).style.width = Math.min(100, need / cap * 100) + '%';
        specs = [['Payload', pick.payload], ['Cargo space', pick.dims], ['Fits pallets', pick.pallets], ['From', money(pick.rate * multi) + ' / trip']];
        service = 'delivery';
      } else {
        pick = list.filter(function (v) { return v.seats >= vals.pax && (v.seats >= 13 || vals.bags <= parseInt(v.luggage, 10)); })[0];
        var n = 1;
        if (!pick) { pick = list[list.length - 1]; n = Math.ceil(vals.pax / pick.seats); }
        cap = pick.seats * n;
        why = vals.pax === 0 ? 'Add passengers to get a recommendation.' : n > 1 ? 'For ' + vals.pax + ' passengers we’d run ' + n + ' coaches together.' : 'Seats ' + vals.pax + ' passenger' + (vals.pax > 1 ? 's' : '') + ' and ' + vals.bags + ' large bag' + (vals.bags === 1 ? '' : 's') + ' comfortably.';
        $('[data-m-name]', m).textContent = (n > 1 ? n + ' × ' : '') + pick.name;
        $('[data-m-load]', m).textContent = vals.pax + ' of ' + cap + ' seats';
        $('[data-m-cap]', m).textContent = pick.luggage;
        $('[data-m-bar]', m).style.width = Math.min(100, vals.pax / cap * 100) + '%';
        specs = [['Seats', pick.seats], ['Luggage', pick.luggage], ['Best for', pick.bestFor.split(',')[0]], ['From', money(pick.rate * n) + ' / hour']];
        service = pick.seats >= 13 ? 'charter' : 'transfer';
      }
      $('[data-m-why]', m).textContent = why;
      $('[data-m-specs]', m).innerHTML = specs.map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('');
      $('[data-m-cta]', m).href = 'quote.html?service=' + service + '&vehicle=' + pick.id;
      // Highlight the recommended vehicle in the fleet grid
      $$('.fleet-card').forEach(function (c) { c.classList.toggle('is-match', c.getAttribute('data-id') === pick.id); });
    }
    render();
  }

  /* ---------------- Rates table (services) ----------------
     Built entirely from config.js: vehicles, storage, add-ons, surcharges. */
  function initRates() {
    var t = $('[data-rates-table] tbody');
    if (!t) return;
    var rows = [];
    CFG.vehicles.forEach(function (v) { rows.push([v.name, v.type === 'goods' ? 'Goods delivery' : 'Charter / transfer', v.type === 'goods' ? v.capacity : v.seats + ' seats', money(v.rate) + ' / ' + v.unit]); });
    rows.push(['Pallet storage', 'Warehouse', 'Min. ' + CFG.storage.minPallets + ' pallets', money(CFG.storage.perPalletWeek) + ' / pallet / week']);
    rows.push(['Handling', 'Warehouse', 'In and out', money(CFG.storage.handlingPerPallet) + ' / pallet']);
    CFG.addons.forEach(function (a) { rows.push([a.label, a.appliesTo.indexOf('people') > -1 ? 'Charter / transfer' : 'Goods', a.detail, money(a.price)]); });
    rows.push(['Urgent (within 3 h)', 'All', 'Same-day priority', '+' + CFG.surcharges.urgent * 100 + '%']);
    rows.push(['After-hours pickup', 'All', '22:00 – 07:00', '+' + CFG.surcharges.afterHours * 100 + '%']);
    rows.push(['Sunday / public holiday', 'All', 'Any time', '+' + CFG.surcharges.weekend * 100 + '%']);
    t.innerHTML = rows.map(function (r) { return '<tr><td><strong>' + r[0] + '</strong></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('');
  }

  /* ---------------- Services sub-nav ----------------
     Highlights the link of the section currently in the middle of the
     viewport and keeps it scrolled into view on small screens. */
  function initSubnav() {
    var sn = $('[data-subnav]');
    if (!sn || !('IntersectionObserver' in window)) return;
    var links = $$('a', sn);
    var map = links.map(function (a) { return { a: a, el: $(a.getAttribute('href')) }; }).filter(function (x) { return x.el; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        map.forEach(function (x) {
          var on = x.el === e.target;
          x.a.classList.toggle('is-active', on);
          if (on) x.a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    map.forEach(function (x) { io.observe(x.el); });
  }

  /* ---------------- Gallery ----------------
     Filter buttons (data-filter) show figures with a matching
     data-category; counts are calculated automatically. The lightbox
     cycles through the currently visible photos (buttons, arrow keys,
     swipe) and returns focus to the opened photo when closed. */
  function initGallery() {
    var g = $('[data-gallery]');
    if (!g) return;
    var items = $$('.g-item', g), btns = $$('[data-gallery-filters] button'), count = $('[data-gallery-count]');
    btns.forEach(function (b) {
      var f = b.getAttribute('data-filter');
      $('span', b).textContent = f === 'all' ? items.length : items.filter(function (i) { return i.getAttribute('data-category') === f; }).length;
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        items.forEach(function (i) { i.hidden = f !== 'all' && i.getAttribute('data-category') !== f; });
        update();
      });
    });
    function visible() { return items.filter(function (i) { return !i.hidden; }); }
    function update() { count.textContent = 'Showing ' + visible().length + ' of ' + items.length + ' photos'; }
    update();

    var lb = $('[data-lightbox]'), img = $('img', lb), cap = $('[data-lb-caption]', lb), cnt = $('[data-lb-count]', lb), idx = 0, last;
    function show(i) {
      var v = visible(); idx = (i + v.length) % v.length;
      var it = v[idx], src = $('img', it);
      img.src = src.currentSrc || src.src;   // currentSrc = the WebP when <picture> served one
      img.alt = src.alt;
      cap.textContent = $('figcaption', it).textContent.replace(/^(Fleet|Warehouse|Operations|Team)/, '$1 · ');
      cnt.textContent = (idx + 1) + ' / ' + v.length;
    }
    function open(i) { last = document.activeElement; show(i); lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; $('[data-lb-close]', lb).focus(); }
    function close() { lb.classList.remove('is-open'); document.body.style.overflow = ''; if (last) last.focus(); }
    items.forEach(function (it) { $('button', it).addEventListener('click', function () { open(visible().indexOf(it)); }); });
    $('[data-lb-close]', lb).addEventListener('click', close);
    $('[data-lb-prev]', lb).addEventListener('click', function () { show(idx - 1); });
    $('[data-lb-next]', lb).addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    var sx = null;   // touch swipe start X
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); sx = null; });
  }

  /* ---------------- Contact form ----------------
     URL parameters:  ?topic=account|booking|feedback|careers  preselects the topic
                      ?role=Job%20title                        pre-fills a job application
     Sending:  if config.js → forms.contact (or the form's action="") is set,
               the form is POSTed in the background; otherwise the visitor's
               email app opens with the message ready to send (mailto:).
     A hidden honeypot field (_gotcha) silently drops spam bots. */
  function initContact() {
    var form = $('[data-contact-form]');
    if (!form) return;
    var topic = form.elements.topic, bk = $('[data-booking-field]', form);
    var params = new URLSearchParams(location.search);
    var p = params.get('topic');
    if (p && $('option[value="' + p + '"]', topic)) topic.value = p;
    var role = params.get('role');
    if (role) {
      topic.value = 'careers';
      if (!form.elements.message.value) form.elements.message.value = 'I would like to apply for the ' + role + ' role.\n\nDriving licence class / experience:\n';
    }
    // The booking-number field only appears for booking and feedback topics
    function sync() { bk.hidden = topic.value !== 'booking' && topic.value !== 'feedback'; }
    topic.addEventListener('change', sync); sync();
    var status = $('[data-form-status]', form);
    var endpoint = form.getAttribute('action') || (CFG.forms && CFG.forms.contact) || '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements._gotcha.value) return;
      if (!validate(form, ['name', 'email', 'message', 'consent'])) { status.className = 'form-status is-error'; status.textContent = 'Please check the highlighted fields.'; return; }
      var d = new FormData(form);
      track('generate_lead', { form: 'contact', topic: topic.value });
      if (endpoint) {
        var btn = $('button[type="submit"]', form); btn.disabled = true;
        post(endpoint, d).then(function () {
          form.reset(); sync(); status.className = 'form-status is-ok'; status.textContent = 'Thank you. We’ll reply within 2 working hours.';
        }).catch(function () {
          status.className = 'form-status is-error'; status.textContent = 'Something went wrong. Please call ' + CFG.company.phone + '.';
        }).then(function () { btn.disabled = false; });
        return;
      }
      var label = topic.options[topic.selectedIndex].text;
      var body = ['Topic: ' + label, 'Name: ' + d.get('name'), 'Company: ' + (d.get('company') || '-'), 'Email: ' + d.get('email'), 'Phone: ' + (d.get('phone') || '-')];
      if (!bk.hidden && d.get('booking')) body.push('Booking: ' + d.get('booking'));
      body.push('', d.get('message'));
      location.href = 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent(label + ' – ' + d.get('name')) + '&body=' + encodeURIComponent(body.join('\n'));
      status.className = 'form-status is-ok'; status.textContent = 'Your email app should open with the message ready to send.';
    });
  }

  /* ---------------- Legal pages: table of contents ----------------
     Highlights the TOC link of the section being read (privacy, terms). */
  function initLegalToc() {
    var toc = $('[data-legal-toc]');
    if (!toc || !('IntersectionObserver' in window)) return;
    var links = $$('a[href^="#"]', toc);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    links.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) io.observe(s); });
  }
})();
