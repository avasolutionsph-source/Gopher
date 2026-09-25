/* Gopher — UI helpers and shared pieces (cards, pills, sheets, toasts).
 * Everything returns escaped html`` (G.util.Safe) unless noted.
 * Display lookups use G.store.sync (a real backend would keep the same cache).
 */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, html = U.html, raw = U.raw;
  const S = () => G.store.sync;

  const ic = (name, opts) => raw(G.icon(name, opts));
  const money = U.peso;
  const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#0B67AD');

  function name(u) { return u ? (u.first + (u.last ? ' ' + u.last[0] + '.' : '')) : 'Someone'; }
  function avatar(u, size) {
    size = size || 40;
    const initials = u ? ((u.first || '?')[0] + ((u.last || '')[0] || '')).toUpperCase() : '?';
    return html`<span class="avatar" style="--size:${size}px;background:${safeColor(u && u.color)}" aria-hidden="true">${initials}</span>`;
  }
  function verified(u) {
    return u && u.verified ? html`<span class="verified" title="Verified student">${ic('badge-check', { size: 16, label: 'Verified student' })}</span>` : '';
  }
  function stars(r, opts) {
    opts = opts || {};
    if (!r || !r.count) return html`<span class="badge badge-gray">New</span>`;
    return html`<span class="stars">${ic('star', { size: opts.size || 15 })}<span aria-hidden="true">${r.avg.toFixed(1)}</span>${opts.noCount ? '' : html`<span class="count" aria-hidden="true">(${r.count})</span>`}<span class="sr-only">Rated ${r.avg.toFixed(1)} out of 5 from ${U.plural(r.count, 'rating')}</span></span>`;
  }
  function starRow(n) {
    return html`<span class="star-row" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => html`<span class="${i <= n ? 'on' : ''}">${ic('star', { size: 14 })}</span>`)}</span>`;
  }

  // ---- orders ------------------------------------------------------------------------
  function statusLabel(o) {
    const meta = (C.STATUS[o.kind] || {})[o.status] || { label: o.status, tone: 'gray' };
    let label = meta.label, tone = meta.tone;
    if (o.kind === 'errand' && o.status === 'bought') label = C.ERRAND_TYPES[o.errand.type].doneLabel;
    if (o.kind === 'rental' && o.status === 'confirmed' && o.listingId) label = 'Confirmed · meetup';
    if (o.kind === 'rental' && o.status === 'in_use' && o.rental && o.rental.returnBy && o.rental.returnBy < U.now()) { label = 'Overdue'; tone = 'bad'; }
    if (o.kind === 'purchase' && o.status === 'unlocked' && o.purchase && o.purchase.expiresAt && o.purchase.expiresAt < U.now()) { label = 'Access ended'; tone = 'gray'; }
    return { label, tone };
  }
  function statusPill(o) {
    const s = statusLabel(o);
    return html`<span class="pill pill-${s.tone}">${s.label}</span>`;
  }
  function orderTitle(o) {
    if (o.kind === 'errand') return o.errand.title;
    const l = S().listing(o.listingId);
    return l ? l.title : 'Listing removed';
  }
  function orderIcon(o) {
    if (o.kind === 'errand') return (C.ERRAND_TYPES[o.errand.type] || {}).icon || 'package';
    const l = S().listing(o.listingId);
    return l ? artIcon(l) : 'package';
  }
  // Short line about who's on the other side, from my point of view.
  function orderWho(o, meId) {
    const other = S().user(S().otherParty(o, meId));
    const role = S().roleOf(o, meId);
    if (o.kind === 'errand') {
      if (role === 'requester') return other ? 'Go-runner: ' + name(other) : 'Looking for a go-runner';
      return 'Errand for ' + name(other);
    }
    if (o.kind === 'rental') return role === 'requester' ? 'Renting from ' + name(other) : 'Lending to ' + name(other);
    return role === 'requester' ? 'From ' + name(other) : 'Sold to ' + name(other);
  }
  function nextHint(o, meId) {
    const m = S().nextMove(o, meId);
    const other = S().user(S().otherParty(o, meId));
    if (m === 'you') {
      const k = o.kind + ':' + o.status;
      const map = {
        'errand:accepted': 'Your turn: buy or print it', 'errand:bought': 'Your turn: start delivery', 'errand:on_the_way': 'Your turn: enter their code',
        'rental:requested': 'Your turn: accept or decline', 'rental:confirmed': 'Your turn: hand it over', 'rental:in_use': 'Your turn: return it',
        'rental:returned': 'Your turn: check it', 'purchase:requested': 'Your turn: confirm the order', 'purchase:confirmed': 'Your turn: hand it over',
      };
      return { tone: 'you', text: map[k] || 'Your turn' };
    }
    if (m === 'them') return { tone: 'them', text: other ? 'Waiting for ' + other.first : 'Waiting for a go-runner' };
    if (m === 'rate') return { tone: 'you', text: 'Rate ' + (other ? other.first : 'them') };
    return null;
  }
  function orderRow(o, meId) {
    const hint = nextHint(o, meId);
    return html`<a class="orow card card-link" href="#/order/${o.id}">
      <span class="orow-icon">${ic(orderIcon(o), { size: 22 })}</span>
      <span class="orow-main">
        <span class="orow-top"><span class="orow-title">${orderTitle(o)}</span>${statusPill(o)}</span>
        <span class="orow-sub">${orderWho(o, meId)} · ${o.id}</span>
        ${hint ? html`<span class="orow-hint orow-hint-${hint.tone}">${hint.tone === 'you' ? ic('circle-check', { size: 14 }) : ic('clock', { size: 14 })}${hint.text}</span>` : ''}
      </span>
      <span class="orow-time">${U.timeAgo(o.statusAt)}</span>
    </a>`;
  }

  // ---- listings -----------------------------------------------------------------------
  function artIcon(l) {
    const t = (l.title || '').toLowerCase();
    const rules = [['umbrella', 'umbrella'], ['raincoat', 'cloud-rain'], ['poncho', 'cloud-rain'], ['calculator', 'calculator'],
      ['tripod', 'tripod'], ['camera', 'camera'], ['mic', 'mic'], ['ring light', 'lightbulb'], ['powerbank', 'battery-charging'],
      ['cord', 'plug'], ['gown', 'shirt'], ['drafting', 'ruler'], ['arts', 'pencil-ruler']];
    const hit = rules.find((r) => t.includes(r[0]));
    if (hit) return hit[1];
    const cats = l.kind === 'rental' ? C.RENTAL_CATS : C.ACADEMIC_CATS;
    return (cats[l.cat] || {}).icon || 'package';
  }
  function coverTone(l) {
    let h = 0;
    for (const ch of l.subject || l.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 5;
  }
  // Thumbnail: the lender's photo, a generated "cover" for notes/books, or category art.
  function thumb(l, size) {
    const src = l.photo ? G.store.photoSrc(l.photo) : '';
    if (src) return html`<img class="thumb" src="${src}" alt="" loading="lazy">`;
    if (l.kind === 'academic') {
      const kind = ((C.ACADEMIC_CATS[l.cat] || {}).label || 'Notes').replace(/s$/, '');
      return html`<span class="thumb cover cover-${coverTone(l)}" aria-hidden="true">
        <span class="cover-kind">${l.format === 'book' ? 'Book' : kind}</span>
        <span class="cover-title">${l.subject || l.title}</span>
        <span class="cover-foot">${l.format === 'digital' ? ic('file-text', { size: 12 }) : l.format === 'printed' ? ic('printer', { size: 12 }) : ic('book-open', { size: 12 })}${l.format === 'digital' ? 'PDF' : l.format === 'printed' ? 'Printed' : 'Book'}${l.pages ? ' · ' + l.pages + ' pp' : ''}</span>
      </span>`;
    }
    return html`<span class="thumb thumb-art thumb-${l.cat}" aria-hidden="true">${ic(artIcon(l), { size: size || 34, stroke: 1.75 })}</span>`;
  }
  function priceText(l) {
    const parts = [];
    if (l.rent) parts.push(html`<b>${money(l.rent.price)}</b><span class="per">/${l.rent.per === 'day' ? 'day' : l.rent.per === 'week' ? 'week' : '7 days'}</span>`);
    if (l.buy != null) parts.push(html`${l.rent ? html`<span class="per"> · buy </span>` : ''}<b>${money(l.buy)}</b>`);
    return parts;
  }
  function listingCard(l) {
    const owner = S().user(l.ownerId);
    const r = S().ratingOf(l.ownerId, 'provider');
    return html`<a class="lcard card card-link" href="#/listing/${l.id}">
      <span class="lcard-media">${thumb(l)}${l.deposit ? html`<span class="badge badge-warn lcard-flag">${money(l.deposit)} deposit</span>` : ''}</span>
      <span class="lcard-body">
        <span class="lcard-title">${l.title}</span>
        <span class="lcard-price">${priceText(l)}</span>
        <span class="lcard-meta">${avatar(owner, 20)}<span class="truncate">${name(owner)}</span>${verified(owner)}${stars(r, { noCount: true, size: 13 })}</span>
      </span>
    </a>`;
  }
  function jobCard(o) {
    const t = C.ERRAND_TYPES[o.errand.type];
    const req = S().user(o.requesterId);
    const earn = S().earning(o);
    return html`<a class="jcard card card-link" href="#/order/${o.id}">
      <span class="jcard-top">
        <span class="jcard-icon">${ic(t.icon, { size: 22 })}</span>
        <span class="grow"><span class="jcard-title">${o.errand.title}</span><span class="jcard-type">${t.label}</span></span>
        <span class="jcard-earn"><b>${money(earn)}</b><span>you earn</span></span>
      </span>
      <span class="jcard-route">${ic('map-pin', { size: 15 })}<span>${o.errand.from} <span aria-hidden="true">→</span><span class="sr-only">to</span> ${o.errand.to}</span></span>
      <span class="jcard-meta">
        <span>${ic('clock', { size: 14 })} Needed ${U.inMinutes(o.errand.neededBy)}</span>
        <span class="badge ${o.money.method === 'cash' ? 'badge-warn' : 'badge-ok'}">${o.money.method === 'cash' ? 'Cash' : 'Gopher Hold'}</span>
        <span class="jcard-who">${avatar(req, 18)}${name(req)}</span>
      </span>
    </a>`;
  }

  function userLine(u, opts) {
    opts = opts || {};
    const r = S().ratingOf(u.id, opts.role || 'provider');
    return html`<a class="uline" href="#/user/${u.id}">
      ${avatar(u, opts.size || 44)}
      <span class="grow">
        <span class="uline-name">${u.first} ${u.last ? u.last[0] + '.' : ''} ${verified(u)}</span>
        <span class="uline-sub">${u.program || 'Student'}${u.year ? ' · ' + u.year : ''}</span>
      </span>
      ${stars(r)}
    </a>`;
  }

  // "Verified with student ID" / "Verified with matriculation form" / "Verification in review"
  function verifyNote(u) {
    const v = u && u.verification;
    if (!v) return u && u.verified ? 'Verified student' : '';
    if (v.status === 'pending') return 'Verification in review';
    return 'Verified with ' + ((C.VERIFY_METHODS[v.method] || {}).short || 'student ID');
  }

  function empty(o) {
    return html`<div class="empty">
      <div class="empty-icon">${ic(o.icon || 'sparkles', { size: 26 })}</div>
      <h3>${o.title}</h3>
      ${o.text ? html`<p>${o.text}</p>` : ''}
      ${o.action || ''}
    </div>`;
  }
  function section(title, body, link) {
    return html`<section class="sec">
      <div class="sec-head"><h2 class="sec-title">${title}</h2>${link || ''}</div>
      ${body}
    </section>`;
  }

  // ---- toasts ----------------------------------------------------------------------------
  function toast(text, opts) {
    opts = opts || {};
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement(opts.href ? 'a' : 'div');
    el.className = 'toast' + (opts.tone ? ' toast-' + opts.tone : '');
    if (opts.href) el.href = opts.href;
    el.innerHTML = G.icon(opts.icon || (opts.tone === 'bad' ? 'triangle-alert' : 'circle-check'), { size: 18 }) + '<span></span>';
    el.querySelector('span').textContent = text;
    root.appendChild(el);
    const ms = opts.ms || 3400;
    setTimeout(() => el.classList.add('is-out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  }
  function errorToast(e) {
    toast((e && e.message) || 'Something went wrong. Try again.', { tone: 'bad' });
    if (e && !e.code) console.error(e);
  }

  // ---- sheets (bottom sheet on phones, card in the phone frame on desktop) -------------------
  let sheetSeq = 0;
  const openSheets = [];
  function sheet(opts) {
    const host = document.getElementById('sheets');
    const id = 'sheet-' + (++sheetSeq);
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet-backdrop" data-close></div>'
      + '<div class="sheet ' + (opts.className || '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">'
      + '<div class="sheet-grip" aria-hidden="true"></div>'
      + '<div class="sheet-head"><h2 class="sheet-title" id="' + id + '-t"></h2>'
      + '<button type="button" class="btn btn-icon" data-close aria-label="Close">' + G.icon('x') + '</button></div>'
      + '<div class="sheet-body"></div></div>';
    wrap.querySelector('.sheet-title').textContent = opts.title || '';
    wrap.querySelector('.sheet-body').innerHTML = String(opts.body || '');
    host.appendChild(wrap);
    const el = wrap.querySelector('.sheet');
    let closed = false, resolveDone;
    const done = new Promise((r) => { resolveDone = r; });
    function close(result) {
      if (closed) return;
      closed = true;
      wrap.classList.add('is-closing');
      wrap.removeEventListener('keydown', onKey);
      const i = openSheets.indexOf(api);
      if (i >= 0) openSheets.splice(i, 1);
      setTimeout(() => wrap.remove(), 180);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      resolveDone(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'))
        .filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
    wrap.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    const api = { el, close, done };
    openSheets.push(api);
    if (opts.onMount) opts.onMount(el, close);
    const auto = el.querySelector('[autofocus]') || el.querySelector('.sheet-body input,.sheet-body button,.sheet-body a') || el.querySelector('[data-close]');
    if (auto) setTimeout(() => auto.focus({ preventScroll: true }), 30);
    return api;
  }
  function closeAllSheets() { openSheets.slice().forEach((s) => s.close()); }

  function confirm(opts) {
    const s = sheet({
      title: opts.title,
      body: html`${opts.text ? html`<p class="sheet-text">${opts.text}</p>` : ''}${opts.extra || ''}
        <div class="sheet-actions">
          <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'} btn-block" data-ok>${opts.ok || 'Confirm'}</button>
          <button type="button" class="btn btn-ghost btn-block" data-close>${opts.cancel || 'Go back'}</button>
        </div>`,
      onMount(el, close) { el.querySelector('[data-ok]').addEventListener('click', () => close(true)); },
    });
    return s.done.then((v) => v === true);
  }

  // A small "demo" hint used where the real app would need the other student's phone.
  function demoHint(text, fillValue, target) {
    return html`<button type="button" class="demo-hint" data-fill="${fillValue}" data-target="${target || ''}">${ic('sparkles', { size: 14 })}<span>${text}</span></button>`;
  }

  G.ui = {
    ic, money, name, avatar, verified, stars, starRow, statusLabel, statusPill, orderTitle, orderIcon, orderWho, nextHint, orderRow,
    artIcon, thumb, priceText, listingCard, jobCard, userLine, verifyNote, empty, section,
    toast, errorToast, sheet, closeAllSheets, confirm, demoHint, safeColor,
  };
})(window.Gopher = window.Gopher || {});
