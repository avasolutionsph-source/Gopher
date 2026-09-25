/* Gopher — starts the demo app: data, routes, app bar, tab bar, badges,
 * notification toasts, the N shortcut, and URL options:
 *   app.html?as=bea|migs        log in as a persona
 *   app.html?scenario=print     start a scenario (print, tripod, reviewer, runner, lend, problem)
 *   app.html?sim=auto|manual|off  pacing of the other students
 *   app.html?reset=1            start from fresh sample data
 *   app.html?ns=name            keep this session's data separate (used by tests)
 */
(function (G) {
  'use strict';
  const U = G.util, UI = G.ui, html = U.html, R = G.router;
  const S = () => G.store.sync;
  const app = {};
  let bootAt = 0;
  const seen = new Set();

  function routes() {
    R.add('/welcome', 'welcome', { public: true, guestOnly: true });
    R.add('/login', 'login', { public: true });
    R.add('/signup', 'signup', { public: true });
    R.add('/home', 'home');
    R.add('/explore', 'explore');
    R.add('/errand/new', 'errandNew');
    R.add('/listing/:id', 'listing');
    R.add('/checkout/:id', 'checkout');
    R.add('/order/:id', 'order');
    R.add('/activity', 'activity');
    R.add('/list/new', 'listNew');
    R.add('/profile', 'profile');
    R.add('/user/:id', 'user');
    R.add('/wallet', 'wallet');
    R.add('/notifications', 'notifications');
    R.add('/reader/:id', 'reader');
  }

  function readBootParams() {
    const p = new URLSearchParams(location.search);
    const out = { as: p.get('as'), scenario: p.get('scenario'), sim: p.get('sim'), reset: p.get('reset') };
    // Keep ?ns= so reloads stay in the same data namespace; drop the one-time options.
    const keep = p.get('ns') ? '?ns=' + encodeURIComponent(p.get('ns')) : '';
    if (location.search !== keep) history.replaceState(null, '', location.pathname + keep + location.hash);
    return out;
  }

  function shell() {
    document.getElementById('tabbar').innerHTML = String(html`
      <a data-tab="home" href="#/home">${UI.ic('house', { size: 22 })}<span>Home</span></a>
      <a data-tab="explore" href="#/explore">${UI.ic('compass', { size: 22 })}<span>Explore</span></a>
      <button type="button" data-tab="new" class="tab-plus" data-action="plus" aria-label="Create: request an errand or list something">${UI.ic('plus', { size: 26 })}</button>
      <a data-tab="activity" href="#/activity">${UI.ic('clipboard-list', { size: 22 })}<span>Activity</span><span class="tab-badge" data-badge="activity" hidden></span></a>
      <a data-tab="profile" href="#/profile">${UI.ic('user', { size: 22 })}<span>Profile</span></a>`);
    document.getElementById('appbar-right').innerHTML = String(html`
      <a class="btn btn-icon appbar-bell" href="#/notifications" aria-label="Notifications" data-bell>${UI.ic('bell', { size: 22 })}<span class="bell-dot" data-badge="bell" hidden></span></a>
      <button type="button" class="demo-chip" data-action="demo" aria-haspopup="dialog">DEMO</button>`);
    document.addEventListener('click', (e) => {
      const plus = e.target.closest('[data-action="plus"]');
      if (plus) { e.preventDefault(); plusSheet(); return; }
      if (e.target.closest('[data-action="demo"]')) { e.preventDefault(); G.demo.openSheet(); return; }
      if (e.target.closest('[data-action="back"]')) { e.preventDefault(); R.back(backFallback()); return; }
      if (e.target.closest('[data-skip]')) { e.preventDefault(); const v = document.getElementById('view'); v.focus(); }
    });
  }
  function backFallback() {
    const cur = R.current();
    const name = cur && cur.route && cur.route.name;
    return { order: '/activity', listing: '/explore', checkout: '/home', user: '/explore', wallet: '/profile', reader: '/activity', signup: '/welcome', login: '/welcome' }[name] || '/home';
  }

  function plusSheet() {
    UI.sheet({
      title: 'What do you want to do?',
      body: html`<div class="plus-list">
        <a href="#/errand/new" data-close>${UI.ic('bike', { size: 22 })}<span><strong>Request an errand</strong><small>Printing, food, pick-ups, supplies</small></span></a>
        <a href="#/list/new?kind=rental" data-close>${UI.ic('umbrella', { size: 22 })}<span><strong>Rent out an item</strong><small>Calculators, umbrellas, camera gear</small></span></a>
        <a href="#/list/new?kind=academic" data-close>${UI.ic('book-open', { size: 22 })}<span><strong>Share notes or a book</strong><small>Reviewers you made, secondhand books</small></span></a>
      </div>`,
    });
  }

  // Called by the router before each screen mounts.
  app.frame = function (opts) {
    const body = document.body;
    body.classList.toggle('is-bare', !!opts.bare);
    const left = document.getElementById('appbar-left');
    left.innerHTML = opts.back
      ? String(html`<button type="button" class="btn btn-icon" data-action="back" aria-label="Back">${UI.ic('chevron-left', { size: 24 })}</button>`)
      : String(html`<a class="appbar-brand" href="#/home" aria-label="Gopher home"><img src="assets/brand/logo.svg" alt="Gopher" width="92" height="27"></a>`);
    app.setTitle(opts.title || '');
    document.querySelectorAll('[data-tab]').forEach((el) => {
      if (el.dataset.tab === opts.tab) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    badges();
  };
  app.setTitle = function (t) {
    const el = document.getElementById('appbar-title');
    if (el) el.textContent = t || '';
    document.title = (t ? t + ' · ' : '') + 'Gopher demo';
  };

  function badges() {
    const me = S().me();
    const bell = document.querySelector('[data-badge="bell"]');
    const act = document.querySelector('[data-badge="activity"]');
    if (!me) { if (bell) bell.hidden = true; if (act) act.hidden = true; return; }
    const unread = S().unreadCount();
    if (bell) { bell.hidden = !unread; bell.textContent = unread > 9 ? '9+' : String(unread); }
    const bellLink = document.querySelector('[data-bell]');
    if (bellLink) bellLink.setAttribute('aria-label', unread ? `Notifications, ${unread} new` : 'Notifications');
    const todo = S().myOrders().filter((o) => S().nextMove(o, me.id) === 'you').length;
    if (act) { act.hidden = !todo; act.textContent = String(todo); }
  }

  // Pop a toast for new notifications (not the ones that existed at start-up).
  function toastNew() {
    const me = S().me();
    if (!me) return;
    let shown = 0;
    S().notifications().slice().reverse().forEach((n) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      if (n.read || n.at < bootAt || shown >= 2) return;
      const cur = R.current();
      if (cur && cur.route && cur.route.name === 'notifications') return;
      shown += 1;
      UI.toast(n.text, { href: n.href && n.href.startsWith('#/') ? n.href : '', icon: 'bell' });
    });
  }

  function onStore(evt) {
    badges();
    toastNew();
    if (evt.type === 'reset' || evt.type === 'session') {
      S().notifications().forEach((n) => seen.add(n.id));
      bootAt = U.now();
    }
    if (evt.type === 'remote' || evt.type === 'reset') {
      const cur = R.current();
      if (evt.type === 'reset' || !cur) R.refresh();
    }
    if (evt.type === 'storage-blocked') UI.toast('This browser blocks saving, so the demo resets when you reload.', { tone: 'bad' });
    if (evt.type === 'quota') UI.toast('Browser storage is full. Remove a photo or reset the demo.', { tone: 'bad' });
  }

  function keys() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target && e.target.matches && e.target.matches('input,textarea,select,[contenteditable]'))) return;
      const cur = R.current();
      const s = G.sim.next(cur && cur.route && cur.route.name === 'order' ? cur.params.id : null);
      UI.toast(s ? 'Demo: ' + s.label : 'Nothing is waiting on the other students.', { icon: 'sparkles' });
    });
  }

  app.init = function () {
    const ns = new URLSearchParams(location.search).get('ns');
    const info = S().init(ns && /^[a-z0-9-]{1,20}$/i.test(ns) ? { key: 'gopher.' + ns + '.v1' } : {});
    const bp = readBootParams();
    if (bp.reset) S().reset();
    if (bp.sim && ['auto', 'manual', 'off'].includes(bp.sim)) S().setSetting('sim', bp.sim);
    if (bp.as) {
      const id = bp.as.startsWith('u_') ? bp.as : 'u_' + bp.as;
      if (S().user(id)) S().login(id);
    }
    routes();
    shell();
    G.demo.mount();
    bootAt = U.now();
    S().notifications().forEach((n) => seen.add(n.id));
    G.store.on(onStore);
    if (bp.scenario) G.demo.start(bp.scenario, { boot: true, quiet: true });
    if (info.memoryOnly) UI.toast('This browser blocks saving, so the demo resets when you reload.', { tone: 'bad' });
    G.sim.start();
    R.start();
    keys();
    badges();
    document.documentElement.classList.add('booted');
  };

  G.app = app;
  app.init();
})(window.Gopher = window.Gopher || {});
