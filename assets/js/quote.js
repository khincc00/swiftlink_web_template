/*
  =====================================================================
  SwiftLink — instant quote wizard (quote.html only)
  =====================================================================
  Five steps, each a <fieldset class="step" data-step="N"> in
  _src/pages/quote.html:
    1 Service    radio name="service"   (keys of config.js → services)
    2 Details    vehicle radios (built here), hours / pallets / weeks, route
    3 Schedule   date, time, priority, public holiday, frequency
    4 Extras     add-on checkboxes (built here from config.js → addons), notes
    5 Review     contact details, PDPA consent, summary, send

  The price is recalculated on every change with SL.calc() (main.js) and
  shown in the sticky summary (<aside class="summary">) and, on small
  screens, in the bottom navigation bar.

  URL PARAMETERS (set by the hero estimate, services page and matcher)
    ?service=delivery|charter|transfer|warehouse   (jumps straight to step 2)
    &vehicle=lorry10  &from=west  &to=east  &hours=4  &pallets=6  &weeks=3

  SENDING
    • config.js → forms.quote set: "Send request" POSTs the form, plus a
      readable `summary`, `reference` and `estimate`, to that endpoint.
    • Otherwise: the email app (mailto:) or WhatsApp opens with the full
      request written out. Both paths end on the "done" panel with a
      reference number (SL-Q + last 6 digits of the timestamp).
*/
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var SL = window.SL, CFG = window.SWIFTLINK, $ = SL.$, $$ = SL.$$;
  var form = $('[data-wizard-form]');
  if (!form) return;

  var endpoint = (CFG.forms && CFG.forms.quote) || '';
  var params = new URLSearchParams(location.search);

  /* Single source of truth for the wizard. readState() refreshes it from the form. */
  var state = {
    service: CFG.services[params.get('service')] ? params.get('service') : 'delivery',
    vehicle: params.get('vehicle') || '',
    from: params.get('from') || 'west', to: params.get('to') || 'central',
    hours: +params.get('hours') || 3, pallets: +params.get('pallets') || 4, weeks: +params.get('weeks') || 2,
    date: '', time: '10:00', priority: 'standard', holiday: false, frequency: 'One-off', addons: {}
  };
  var step = 1, total = 5;
  var steps = $$('.step', form), stepLis = $$('[data-steps] li', form);
  var prev = $('[data-prev]', form), next = $('[data-next]', form);

  /* ---- One-time setup of the static controls ---- */
  $$('[data-region-select]', form).forEach(function (s) { SL.fillRegions(s, state[s.name]); });
  SL.fillRange(form.elements.pallets, 2, 40, 'pallet', state.pallets);
  SL.fillRange(form.elements.weeks, 1, 12, 'week', state.weeks);
  var radio = $('input[name="service"][value="' + state.service + '"]', form);
  if (radio) radio.checked = true;
  if (endpoint) $('[data-send-label]', form).textContent = 'Send request';

  // Dates: no past dates; default is tomorrow, in Singapore time
  var today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  form.elements.date.min = iso(today);
  var tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
  form.elements.date.value = state.date = iso(tmr);
  syncHoliday();

  function svc() { return CFG.services[state.service]; }

  /* Tick (and lock) the "public holiday" box automatically when the chosen
     date is in config.js → publicHolidays. For any other date the visitor
     can still tick it manually, e.g. for a newly announced holiday. */
  function syncHoliday() {
    var name = SL.isHoliday(form.elements.date.value);
    form.elements.holiday.checked = !!name;
    form.elements.holiday.disabled = !!name;
    var hint = $('[data-holiday-name]', form);
    if (hint) hint.textContent = name ? ' (' + name + ')' : '';
  }

  /* ---- Step 2: vehicle cards, or pallets/weeks for storage, plus hours for people services ---- */
  function buildStep2() {
    var s = svc(), box = $('[data-s2-vehicles]', form);
    var isStorage = s.type === 'storage', isPeople = s.type === 'people';
    $('[data-s2-title]', form).textContent = isStorage ? 'How much do you need to store?' : 'Choose a vehicle';
    $('[data-s2-sub]', form).innerHTML = isStorage ? 'Storage is at our West region facility. Delivery in or out can be added after.' : 'Not sure? <a href="services.html#matcher">Use the vehicle matcher</a>.';
    box.hidden = isStorage;
    $('[data-s2-storage]', form).hidden = !isStorage;
    $('[data-s2-hours]', form).hidden = !isPeople;
    $('[data-route-label]', form).textContent = isStorage ? 'Pickup for storage (optional)' : 'Route';
    if (!isStorage) {
      // Keep the chosen vehicle if this service offers it, else pick the default
      if (s.vehicles.indexOf(state.vehicle) < 0) state.vehicle = s.vehicles[s.type === 'goods' ? 1 : 0] || s.vehicles[0];
      box.innerHTML = s.vehicles.map(function (id) {
        var v = SL.vehicle(id);
        return '<label class="choice"><input type="radio" name="vehicle" value="' + id + '"' + (id === state.vehicle ? ' checked' : '') + '>' +
          '<span class="choice-icon"><svg class="icon" aria-hidden="true"><use href="#i-' + v.icon + '"/></svg></span>' +
          '<span><strong>' + v.name + '</strong><small>' + (v.capacity ? v.capacity + ' · ' + v.payload : v.seats + ' seats · ' + v.luggage) + '</small></span>' +
          '<span class="choice-price">from<b>' + SL.money(v.rate) + '</b>/' + v.unit + '</span></label>';
      }).join('');
      var min = s.minHours || 1;
      SL.fillRange(form.elements.hours, min, 12, 'hour', Math.max(min, state.hours));
      state.hours = +form.elements.hours.value;
      $('[data-min-hours]', form).textContent = min > 1 ? 'Minimum ' + min + ' hours for charter.' : 'Charged per hour, minimum 1 hour.';
    }
  }

  /* ---- Step 4: add-ons that apply to the chosen service type ---- */
  function buildAddons() {
    var type = svc().type;
    var list = CFG.addons.filter(function (a) { return a.appliesTo.indexOf(type) > -1; });
    // Drop add-ons picked earlier for a different service
    Object.keys(state.addons).forEach(function (k) { if (!list.some(function (a) { return a.id === k; })) delete state.addons[k]; });
    $('[data-addons]', form).innerHTML = list.map(function (a) {
      var on = state.addons[a.id];
      return '<label class="choice choice-addon"><input type="checkbox" name="addon" value="' + a.id + '"' + (on ? ' checked' : '') + '><span class="choice-check"></span>' +
        '<span><strong>' + a.label + '</strong><small>' + a.detail + '</small></span><span class="choice-price"><b>+' + SL.money(a.price) + '</b>' + (a.per ? 'per ' + a.per : '') + '</span></label>';
    }).join('') || '<p class="muted">No extras for this service.</p>';
  }

  /* ---- Copy the current form values into `state` ---- */
  function readState() {
    var f = form.elements;
    state.service = (form.querySelector('input[name="service"]:checked') || {}).value || state.service;
    var v = form.querySelector('input[name="vehicle"]:checked'); if (v) state.vehicle = v.value;
    state.from = f.from.value; state.to = f.to.value;
    state.hours = +f.hours.value || state.hours; state.pallets = +f.pallets.value; state.weeks = +f.weeks.value;
    state.date = f.date.value; state.time = f.time.value;
    state.priority = (form.querySelector('input[name="priority"]:checked') || {}).value;
    state.frequency = (form.querySelector('input[name="frequency"]:checked') || {}).value;
    state.holiday = f.holiday.checked;
    var ad = {};
    // "Extra mover" is booked as 2 people; every other add-on is quantity 1
    $$('input[name="addon"]:checked', form).forEach(function (c) { ad[c.value] = c.value === 'mover' ? 2 : 1; });
    if (step >= 4 || $$('input[name="addon"]', form).length) state.addons = ad;
  }

  function regionName(k) { return CFG.regions[k] ? CFG.regions[k].name : '—'; }
  function niceDate() {
    if (!state.date) return '—';
    var d = new Date(state.date + 'T' + (state.time || '00:00'));
    return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + (state.time || '');
  }

  /* Rows for the summary panel and review list: [label, value] */
  function summaryRows() {
    var s = svc(), v = SL.vehicle(state.vehicle);
    var rows = [['Service', s.name]];
    if (s.type === 'storage') rows.push(['Storage', state.pallets + ' pallets · ' + state.weeks + ' wk']);
    else rows.push(['Vehicle', v ? v.name : '—']);
    if (s.type === 'people') rows.push(['Duration', state.hours + ' hours']);
    if (s.type !== 'storage') rows.push(['Route', regionName(state.from) + ' → ' + regionName(state.to)]);
    rows.push(['When', step >= 3 ? niceDate() : '—']);
    if (state.frequency && state.frequency !== 'One-off') rows.push(['Frequency', state.frequency]);
    return rows;
  }

  /* ---- Recalculate the price and redraw the summary. Returns the calc() result. ---- */
  function render() {
    readState();
    var r = SL.calc(state);
    $('[data-sum-total]').textContent = SL.rangeText(r);
    $('[data-nav-price]').textContent = SL.rangeText(r);
    $('[data-sum-basis]').textContent = r.basis ? r.basis.charAt(0).toUpperCase() + r.basis.slice(1) : '';
    $('[data-sum-lines]').innerHTML = summaryRows().map(function (x) {
      return '<li' + (x[1] === '—' ? ' class="is-empty"' : '') + '><span>' + x[0] + '</span><span>' + x[1] + '</span></li>';
    }).join('');
    var bd = r.lines.map(function (l) { return '<div><span>' + l[0] + ' · ' + l[1] + '</span><span>' + SL.money(l[2]) + '</span></div>'; });
    r.surcharges.forEach(function (l) { bd.push('<div><span>' + l[0] + '</span><span>+' + SL.money(l[1]) + '</span></div>'); });
    r.addons.forEach(function (l) { bd.push('<div><span>' + l[0] + '</span><span>+' + SL.money(l[1]) + '</span></div>'); });
    $('[data-sum-breakdown]').innerHTML = bd.join('');

    // Yellow note in step 3 when a surcharge applies
    var note = $('[data-surcharge-note]', form);
    if (r.surcharges.length) {
      note.hidden = false;
      $('span', note).textContent = r.surcharges.map(function (x) { return x[0]; }).join(', ') + ' surcharge applied: +' + SL.money(r.surcharges.reduce(function (a, b) { return a + b[1]; }, 0)) + '.';
    } else note.hidden = true;
    return r;
  }

  /* Step 5 review list. Third value = the step the "Edit" button jumps to (0 = no button). */
  function reviewHTML(r) {
    var rows = summaryRows().map(function (x) { return [x[0], x[1], x[0] === 'Service' ? 1 : x[0] === 'When' || x[0] === 'Frequency' ? 3 : 2]; });
    var ad = r.addons.map(function (a) { return a[0]; }).join(', ');
    rows.push(['Extras', ad || 'None', 4]);
    var addr = [form.elements.fromAddress.value, form.elements.toAddress.value].filter(Boolean).join(' → ');
    if (addr) rows.push(['Addresses', addr, 2]);
    rows.push(['Indicative price', SL.rangeText(r) + ' (before GST)', 0]);
    return rows.map(function (x) {
      return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>' + (x[2] ? '<button type="button" data-goto="' + x[2] + '">Edit</button>' : '<span></span>') + '</div>';
    }).join('');
  }

  /* ---- Go to step n. `focus` moves keyboard focus to the step heading and scrolls up. ---- */
  function go(n, focus) {
    step = Math.max(1, Math.min(total, n));
    if (step === 2) buildStep2();
    if (step === 4) buildAddons();
    steps.forEach(function (s) { s.hidden = +s.getAttribute('data-step') !== step; });
    stepLis.forEach(function (li, i) {
      li.classList.toggle('is-current', i + 1 === step);
      li.classList.toggle('is-done', i + 1 < step);
      if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('[data-progress]', form).style.width = (step / total * 100) + '%';
    prev.style.visibility = step === 1 ? 'hidden' : 'visible';
    next.hidden = step === total;
    var r = render();
    if (step === total) $('[data-review]', form).innerHTML = reviewHTML(r);
    if (focus) {
      var h = $('.step:not([hidden]) h2', form);
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
      var top = form.getBoundingClientRect().top + scrollY - 100;
      if (scrollY > top) scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  /* Validation before leaving a step (only step 3 has required fields; step 5 is checked in send()). */
  function stepValid() {
    if (step === 3) return SL.validate(form, ['date', 'time']);
    return true;
  }

  /* ---- Events ---- */
  next.addEventListener('click', function () { if (stepValid()) go(step + 1, true); });
  prev.addEventListener('click', function () { go(step - 1, true); });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') { state.vehicle = ''; state.addons = {}; }
    if (e.target.name === 'date') syncHoliday();
    render();
  });
  form.addEventListener('input', function (e) {
    if (e.target.type === 'date') syncHoliday();
    if (e.target.type === 'date' || e.target.type === 'time') render();
  });
  form.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto]');
    if (g) go(+g.getAttribute('data-goto'), true);
  });
  // Enter in a text field moves to the next step instead of submitting
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && step < total) { e.preventDefault(); next.click(); }
  });

  /* Plain-text version of the request (email body, WhatsApp text, endpoint `summary`). */
  function message(r, ref) {
    var f = form.elements, rows = summaryRows();
    var lines = ['SwiftLink quote request ' + ref, ''];
    rows.forEach(function (x) { lines.push(x[0] + ': ' + x[1]); });
    if (f.fromAddress.value) lines.push('Pickup address: ' + f.fromAddress.value);
    if (f.toAddress.value) lines.push('Drop-off address: ' + f.toAddress.value);
    lines.push('Priority: ' + (state.priority === 'urgent' ? 'Urgent (within 3 h)' : 'Standard'));
    if (r.addons.length) lines.push('Extras: ' + r.addons.map(function (a) { return a[0]; }).join(', '));
    lines.push('Indicative price: ' + SL.rangeText(r) + ' before GST');
    if (f.notes.value) lines.push('', 'Notes: ' + f.notes.value);
    lines.push('', 'Name: ' + f.name.value, 'Company: ' + (f.company.value || '-'), 'Email: ' + f.email.value, 'Mobile: ' + f.phone.value);
    return lines.join('\n');
  }

  /* Show the success panel with the reference number. */
  function done(ref, text) {
    steps.forEach(function (s) { s.hidden = true; });
    $('[data-wizard-nav]', form).hidden = true;
    $('[data-steps]', form).hidden = true;
    var panel = $('[data-done]', form); panel.hidden = false;
    $('[data-ref]', panel).textContent = ref;
    if (text) $('[data-done-msg]', panel).textContent = text;
    panel.focus();
  }

  /* ---- Send the request: channel = 'email' (submit button) or 'whatsapp' ---- */
  function send(channel) {
    if (form.elements._gotcha.value) return;   // honeypot filled → spam bot
    var status = $('[data-form-status]', form);
    if (!SL.validate(form, ['name', 'email', 'phone', 'consent'])) { status.className = 'form-status is-error'; status.textContent = 'Please check the highlighted fields.'; return; }
    var r = render();
    var ref = 'SL-Q' + String(Date.now()).slice(-6);
    var body = message(r, ref);
    SL.track('generate_lead', { form: 'quote', method: channel, service: state.service, value: Math.round(r.total), currency: 'SGD' });

    if (channel === 'email' && endpoint) {
      var d = new FormData(form);
      d.append('reference', ref);
      d.append('estimate', SL.rangeText(r) + ' before GST');
      d.append('summary', body);
      var btns = $$('[data-send]', form);
      btns.forEach(function (b) { b.disabled = true; });
      status.className = 'form-status'; status.textContent = 'Sending…';
      SL.post(endpoint, d).then(function () {
        status.textContent = '';
        done(ref, 'Thank you. Dispatch has your request and replies with a fixed quotation, usually within 15 minutes.');
      }).catch(function () {
        status.className = 'form-status is-error';
        status.textContent = 'We couldn’t send your request. Please try WhatsApp or call ' + CFG.company.phone + '.';
      }).then(function () { btns.forEach(function (b) { b.disabled = false; }); });
      return;
    }

    if (channel === 'whatsapp') {
      window.open('https://wa.me/' + CFG.company.whatsapp + '?text=' + encodeURIComponent(body), '_blank', 'noopener');
    } else {
      location.href = 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent('Quote request ' + ref + ' – ' + svc().name) + '&body=' + encodeURIComponent(body);
    }
    done(ref);
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send('email'); });
  $('[data-send="whatsapp"]', form).addEventListener('click', function () { send('whatsapp'); });
  $('[data-copy-ref]', form).addEventListener('click', function () {
    var t = $('[data-ref]', form).textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { SL.toast('Reference copied'); }, function () { SL.toast(t); });
  });

  // Arriving with ?service= (from the hero estimate or a service page) skips step 1
  go(params.get('service') ? 2 : 1, false);
});
