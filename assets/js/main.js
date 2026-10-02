/* SwiftLink Logistics & Transport — site interactions */
document.addEventListener('DOMContentLoaded', function () {
  // Footer year
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // ---------- Mobile navigation ----------
  var nav = document.getElementById('main-nav');
  var toggle = document.querySelector('.nav-toggle');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false);
    });
  }

  // ---------- Header shadow + back-to-top ----------
  var header = document.querySelector('.site-header');
  var backToTop = document.querySelector('.back-to-top');

  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (backToTop) backToTop.classList.toggle('is-visible', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Active nav link + reveal on scroll ----------
  if ('IntersectionObserver' in window) {
    // Highlight the menu link for the section in view (only links that point into this page).
    var navTargets = [];
    document.querySelectorAll('.main-nav a:not(.btn)').forEach(function (link) {
      var url = new URL(link.href, location.href);
      if (url.pathname !== location.pathname) return;
      var target = url.hash ? document.querySelector(url.hash) : document.querySelector('.hero');
      if (target) navTargets.push({ link: link, target: target });
    });

    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navTargets.forEach(function (item) {
          item.link.classList.toggle('is-active', item.target === entry.target);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navTargets.forEach(function (item) { navObserver.observe(item.target); });

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    document.querySelectorAll('.reveal').forEach(function (el) {
      // Stagger siblings in the same grid for a smoother entrance
      var index = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.transitionDelay = Math.min(index, 5) * 70 + 'ms';
      revealObserver.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---------- Testimonials carousel ----------
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var slides = track.children;
    var section = carousel.closest('section');
    var prev = section.querySelector('[data-carousel-prev]');
    var next = section.querySelector('[data-carousel-next]');
    var dotsWrap = carousel.querySelector('[data-carousel-dots]');
    var dots = [];

    function step() {
      return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth;
    }
    function perView() {
      return Math.max(1, Math.round(track.clientWidth / step()));
    }
    function pageCount() {
      return Math.max(1, slides.length - perView() + 1);
    }
    function current() {
      return Math.round(track.scrollLeft / step());
    }
    function goTo(index) {
      track.scrollTo({ left: index * step() });
    }

    function buildDots() {
      dotsWrap.innerHTML = '';
      dots = [];
      for (var i = 0; i < pageCount(); i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Show testimonial ' + (i + 1));
        dot.addEventListener('click', goTo.bind(null, i));
        dotsWrap.appendChild(dot);
        dots.push(dot);
      }
      update();
    }

    function update() {
      var index = current();
      dots.forEach(function (dot, i) { dot.setAttribute('aria-current', String(i === index)); });
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }

    if (prev) prev.addEventListener('click', function () { goTo(Math.max(0, current() - 1)); });
    if (next) next.addEventListener('click', function () { goTo(Math.min(pageCount() - 1, current() + 1)); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.min(pageCount() - 1, current() + 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.max(0, current() - 1)); }
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildDots, 150);
    });
    buildDots();
  });

  // ---------- Gallery: filters + lightbox ----------
  var gallery = document.querySelector('.gallery-grid');
  if (gallery) {
    var items = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-item'));
    var filterButtons = document.querySelectorAll('.filter-btn');
    var emptyNote = document.querySelector('.gallery-empty');

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.dataset.filter;
        filterButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        var shown = 0;
        items.forEach(function (item) {
          var match = filter === 'all' || item.dataset.category === filter;
          item.hidden = !match;
          if (match) shown++;
        });
        if (emptyNote) emptyNote.hidden = shown > 0;
      });
    });

    var lightbox = document.querySelector('.lightbox');
    if (lightbox && typeof lightbox.showModal === 'function') {
      var lbImg = lightbox.querySelector('img');
      var lbCaption = lightbox.querySelector('.lightbox-caption');
      var lbCount = lightbox.querySelector('.lightbox-count');
      var visible = [];
      var index = 0;
      var opener = null;

      function show(i) {
        index = (i + visible.length) % visible.length;
        var item = visible[index];
        var img = item.querySelector('img');
        var caption = item.querySelector('figcaption').cloneNode(true);
        var label = caption.querySelector('small');
        if (label) label.remove();
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        lbCaption.textContent = caption.textContent.trim();
        lbCount.textContent = (index + 1) + ' / ' + visible.length;
      }

      items.forEach(function (item) {
        item.querySelector('.gallery-open').addEventListener('click', function (e) {
          opener = e.currentTarget;
          visible = items.filter(function (it) { return !it.hidden; });
          show(visible.indexOf(item));
          lightbox.showModal();
        });
      });

      lightbox.querySelector('.lightbox-prev').addEventListener('click', function () { show(index - 1); });
      lightbox.querySelector('.lightbox-next').addEventListener('click', function () { show(index + 1); });
      lightbox.querySelector('.lightbox-close').addEventListener('click', function () { lightbox.close(); });
      lightbox.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') show(index + 1);
        if (e.key === 'ArrowLeft') show(index - 1);
      });
      // Click on the dark background closes the viewer
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) lightbox.close();
      });
      lightbox.addEventListener('close', function () {
        if (opener) opener.focus();
      });
    }
  }

  // ---------- Contact form ----------
  var form = document.querySelector('.contact-form');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(message, type) {
    status.textContent = message;
    status.className = 'form-status' + (type ? ' is-' + type : '');
  }

  function clearError(field) {
    field.classList.remove('has-error');
    var msg = field.querySelector('.field-error');
    if (msg) msg.remove();
  }

  function validate() {
    var firstInvalid = null;
    form.querySelectorAll('[required]').forEach(function (input) {
      var field = input.closest('.field');
      clearError(field);
      input.removeAttribute('aria-invalid');
      if (input.checkValidity()) return;

      var msg = document.createElement('span');
      msg.className = 'field-error';
      msg.id = input.id + '-error';
      msg.textContent = input.validity.typeMismatch ? 'Please enter a valid email address.' : 'This field is required.';
      field.classList.add('has-error');
      field.appendChild(msg);
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', msg.id);
      if (!firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field');
    if (field && field.classList.contains('has-error') && e.target.checkValidity()) clearError(field);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      setStatus('Please complete the highlighted fields.', 'error');
      return;
    }

    var data = new FormData(form);
    if (data.get('_gotcha')) return; // spam bot filled the hidden field

    var endpoint = form.getAttribute('action');

    // No endpoint configured: open the visitor's email app with the request pre-filled.
    if (!endpoint || endpoint === '#') {
      var lines = [
        'Name: ' + data.get('name'),
        'Company: ' + (data.get('company') || '-'),
        'Email: ' + data.get('email'),
        'Phone: ' + (data.get('phone') || '-'),
        'Service: ' + data.get('service'),
        '',
        data.get('message')
      ];
      var subject = 'Quote request: ' + data.get('service') + ' (' + data.get('name') + ')';
      window.location.href = 'mailto:' + form.dataset.email +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\n'));
      setStatus('Your email app should now open with your request ready to send.', 'success');
      return;
    }

    // Endpoint configured (e.g. Formspree): submit in the background.
    submitBtn.disabled = true;
    setStatus('Sending your request…');
    fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        setStatus('Thank you! Our team will get back to you shortly.', 'success');
      })
      .catch(function () {
        setStatus('Sorry, something went wrong. Please call +65 6777 4599 or email ' + form.dataset.email + '.', 'error');
      })
      .then(function () {
        submitBtn.disabled = false;
      });
  });
});
