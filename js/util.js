/* Gopher — small helpers shared by every other script. Load this first. */
(function (G) {
  'use strict';

  // ---- Escaping -----------------------------------------------------------
  // Everything a user types goes through esc() before it touches the DOM.
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  // Markup that is already safe (built by html``, or a trusted constant like an icon).
  class Safe {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
  }
  const raw = (s) => new Safe(String(s == null ? '' : s));

  function toHtml(v) {
    if (v == null || v === false || v === true) return '';
    if (v instanceof Safe) return v.s;
    if (Array.isArray(v)) return v.map(toHtml).join('');
    return esc(v);
  }

  // html`<p>${text}</p>` escapes every interpolated value unless it is Safe
  // (nested html`` results, raw(), icons). Arrays are joined; null/false/true
  // render nothing, so `${cond && html`…`}` works.
  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += toHtml(values[i]) + strings[i + 1];
    return new Safe(out);
  }

  // Escape for attribute values that hold JSON or free text.
  const attr = (v) => esc(v);

  // ---- Money & numbers -----------------------------------------------------
  function peso(n) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    const neg = v < 0;
    const s = Math.abs(v).toLocaleString('en-PH', {
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return (neg ? '−₱' : '₱') + s;
  }
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  // ---- Time ----------------------------------------------------------------
  // Tests replace G.clock.now to control time.
  G.clock = G.clock || { now: () => Date.now() };
  const now = () => G.clock.now();
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }
  function fmtDay(ts) {
    const d = new Date(ts), today = new Date(now());
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(d) - start(today)) / DAY);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const fmtWhen = (ts) => fmtDay(ts) + ', ' + fmtTime(ts);
  function timeAgo(ts) {
    const s = Math.round((now() - ts) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return plural(h, 'hr') + ' ago';
    const d = Math.round(h / 24);
    if (d < 7) return plural(d, 'day') + ' ago';
    return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }
  function inMinutes(ts) {
    const m = Math.round((ts - now()) / MIN);
    if (m <= 0) return 'now';
    if (m < 60) return 'in ' + m + ' min';
    const h = Math.round(m / 60);
    return h < 24 ? 'in ' + plural(h, 'hr') : 'in ' + plural(Math.round(h / 24), 'day');
  }

  // ---- Seeded random (mulberry32) -----------------------------------------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- DOM -----------------------------------------------------------------
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // Delegated events: on(root, 'click', '[data-action]', fn) → fn(event, matchedEl). Returns an unbind function.
  function on(root, type, selector, fn, opts) {
    const handler = (e) => {
      const el = e.target.closest ? e.target.closest(selector) : null;
      if (el && root.contains(el)) fn(e, el);
    };
    root.addEventListener(type, handler, opts);
    return () => root.removeEventListener(type, handler, opts);
  }

  function formData(form) {
    const out = {};
    new FormData(form).forEach((v, k) => {
      if (k in out) out[k] = [].concat(out[k], v);
      else out[k] = v;
    });
    return out;
  }

  function parseQuery(q) {
    const out = {};
    new URLSearchParams(q || '').forEach((v, k) => { out[k] = v; });
    return out;
  }
  function toQuery(obj) {
    const p = new URLSearchParams();
    Object.keys(obj || {}).forEach((k) => {
      if (obj[k] !== '' && obj[k] != null) p.set(k, obj[k]);
    });
    const s = p.toString();
    return s ? '?' + s : '';
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Shrink a user-picked image to a small JPEG data URL (fits localStorage).
  function resizeImage(file, max, quality) {
    max = max || 640;
    quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('That image could not be opened.'));
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  const isImageData = (s) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s);

  G.util = {
    esc, raw, html, attr, Safe,
    peso, plural, clamp,
    now, MIN, HOUR, DAY, fmtTime, fmtDay, fmtWhen, timeAgo, inMinutes,
    rng,
    qs, qsa, on, formData, parseQuery, toQuery, debounce,
    resizeImage, isImageData,
  };
})(window.Gopher = window.Gopher || {});
