/* Gopher site pages (index, help, terms, privacy).
 * Mobile nav toggle, demo form handlers, small niceties. No dependencies.
 * Every feature checks for its elements first, so it is safe on any page.
 */
(function () {
  'use strict';

  var doc = document;

  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- Mobile nav ------------------------------------------------------ */
  function initNav() {
    var toggle = doc.querySelector('.nav-toggle');
    var nav = doc.getElementById('site-nav');
    if (!toggle || !nav) return;

    function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    }

    toggle.addEventListener('click', function () { setOpen(!isOpen()); });

    // Close after choosing a link (the page scrolls to the section).
    nav.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('a')) setOpen(false);
    });

    doc.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Click or tap outside closes it.
    doc.addEventListener('click', function (e) {
      if (isOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });

    // Reset when the layout switches to the desktop nav.
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 960px)');
      var onChange = function () { if (mq.matches) setOpen(false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---- Demo forms (nothing is sent anywhere) --------------------------- */
  function fieldError(field, message) {
    var id = field.id + '-error';
    var err = doc.getElementById(id);
    var describedBy = (field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);

    if (message) {
      if (!err) {
        err = doc.createElement('span');
        err.className = 'error-text';
        err.id = id;
        field.parentNode.appendChild(err);
      }
      err.textContent = message;
      field.setAttribute('aria-invalid', 'true');
      if (describedBy.indexOf(id) === -1) describedBy.push(id);
    } else {
      if (err) err.parentNode.removeChild(err);
      field.removeAttribute('aria-invalid');
      describedBy = describedBy.filter(function (x) { return x !== id; });
    }

    if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
    else field.removeAttribute('aria-describedby');
  }

  function checkField(field) {
    var value = (field.value || '').trim();
    var bad = false;
    if (field.required && !value) bad = true;
    else if (value && field.checkValidity && !field.checkValidity()) bad = true;
    fieldError(field, bad ? (field.getAttribute('data-error') || 'Please check this field.') : '');
    return !bad;
  }

  function validate(form) {
    var firstBad = null;
    each(form.querySelectorAll('input, select, textarea'), function (field) {
      if (field.type === 'hidden' || field.disabled || !field.id) return;
      if (!checkField(field) && !firstBad) firstBad = field;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function formatReplyBy(date) {
    try {
      return date.toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch (e) {
      return date.toString();
    }
  }

  var CHECK_ICON = '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';

  var handlers = {
    notify: function (form, status) {
      status.innerHTML = '<div class="notice notice-ok">' + CHECK_ICON +
        '<div><p><strong>Thanks! (Demo — nothing was sent.)</strong></p>' +
        '<p>In the real app, we’d email you when Gopher opens at your school.</p></div></div>';
      form.reset();
    },
    support: function (form, status) {
      var ticket = 'GPH-S-' + String(Math.floor(1000 + Math.random() * 9000));
      var replyBy = formatReplyBy(new Date(Date.now() + 24 * 60 * 60 * 1000));
      var topic = form.querySelector('[name="topic"]');
      var topicText = topic && topic.selectedIndex > 0 ? topic.options[topic.selectedIndex].text : '';
      status.innerHTML = '<div class="notice notice-ok">' + CHECK_ICON +
        '<div><p><strong>Message received. Your ticket is ' + esc(ticket) + '.</strong></p>' +
        (topicText ? '<p>Topic: ' + esc(topicText) + '</p>' : '') +
        '<p>We’d reply by <strong>' + esc(replyBy) + '</strong> (within 24 hours).</p>' +
        '<p><span class="badge badge-demo">DEMO</span> Demo — nothing was sent.</p></div></div>';
      form.reset();
    }
  };

  function initForms() {
    each(doc.querySelectorAll('form[data-demo]'), function (form) {
      var kind = form.getAttribute('data-demo');
      var status = form.querySelector('[data-status]');
      form.setAttribute('novalidate', '');

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate(form)) return;
        if (status && handlers[kind]) handlers[kind](form, status);
      });

      // Clear an error as soon as the field is fixed.
      each(form.querySelectorAll('input, select, textarea'), function (field) {
        var evt = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(evt, function () {
          if (field.getAttribute('aria-invalid') === 'true') checkField(field);
        });
      });

      // Typing again after a confirmation hides the old confirmation.
      form.addEventListener('input', function () {
        if (status && status.innerHTML) status.innerHTML = '';
      });
    });
  }

  /* ---- Help: open a question when the URL points at it ----------------- */
  function openTargetDetails() {
    var id = '';
    try { id = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { return; }
    if (!id) return;
    var el = doc.getElementById(id);
    if (!el) return;
    var details = el.tagName === 'DETAILS' ? el : (el.closest ? el.closest('details') : null);
    if (details) details.open = true;
  }

  /* ---- Terms / privacy: highlight the section in view ------------------ */
  function initTocSpy() {
    var links = doc.querySelectorAll('.toc-desktop a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    each(links, function (a) {
      var id = a.getAttribute('href').slice(1);
      (byId[id] = byId[id] || []).push(a);
    });

    var visible = {};
    var sections = [];
    each(Object.keys(byId), function (id) {
      var s = doc.getElementById(id);
      if (s) sections.push(s);
    });
    if (!sections.length) return;

    function setCurrent(id) {
      each(links, function (a) { a.removeAttribute('aria-current'); });
      each(byId[id] || [], function (a) { a.setAttribute('aria-current', 'true'); });
    }

    var io = new IntersectionObserver(function (entries) {
      each(entries, function (en) { visible[en.target.id] = en.isIntersecting; });
      for (var i = 0; i < sections.length; i++) {
        if (visible[sections[i].id]) { setCurrent(sections[i].id); return; }
      }
    }, { rootMargin: '-80px 0px -55% 0px', threshold: 0 });

    each(sections, function (s) { io.observe(s); });
  }

  /* ---- Little things --------------------------------------------------- */
  function initMisc() {
    each(doc.querySelectorAll('[data-year]'), function (el) {
      el.textContent = String(new Date().getFullYear());
    });
    // Placeholder links (socials) shouldn't jump to the top of the page.
    each(doc.querySelectorAll('a[data-soon]'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); });
    });
  }

  function init() {
    initNav();
    initForms();
    initTocSpy();
    initMisc();
    openTargetDetails();
    window.addEventListener('hashchange', openTargetDetails);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
