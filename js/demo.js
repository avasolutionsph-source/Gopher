/* Gopher — Demo panel for presenters: switch persona, start a scenario,
 * choose Auto/Manual pacing, press Next step (or N), reset the data.
 * On a laptop it sits beside the phone; on a phone the DEMO chip opens it. */
(function (G) {
  'use strict';
  const U = G.util, UI = G.ui, html = U.html;
  const S = () => G.store.sync;
  const MIN = U.MIN;

  const PERSONAS = [['u_bea', 'Books errands, rents, buys notes'], ['u_migs', 'Go-runner & lender']];
  const SCENARIOS = [
    { id: 'print', title: 'Print it before class', who: 'u_bea', icon: 'printer', text: 'Bea books a go-runner to print and deliver her report.', go: ['/errand/new', { type: 'print' }] },
    { id: 'tripod', title: 'Rent a tripod', who: 'u_bea', icon: 'tripod', text: 'Bea rents Migs’s tripod for a group vlog and returns it.', go: ['/listing/ls_tripod'] },
    { id: 'reviewer', title: 'Buy a reviewer', who: 'u_bea', icon: 'file-text', text: 'Bea buys a Financial Accounting reviewer before midterms.', go: ['/explore', { tab: 'notes', q: 'Financial' }] },
    { id: 'runner', title: 'Earn between classes', who: 'u_migs', icon: 'bike', text: 'Migs goes online, takes a food run, and cashes out.', go: ['/home'] },
    { id: 'lend', title: 'List a ring light', who: 'u_migs', icon: 'lightbulb', text: 'Migs lists his ring light and gets a rental request.', go: ['/list/new', { kind: 'rental' }] },
    { id: 'problem', title: 'When something goes wrong', who: 'u_bea', icon: 'life-buoy', text: 'A drink was missing. Bea reports it and support refunds her.', setup: problemSetup },
  ];

  // A food run Mika delivered 10 minutes ago, with one iced tea missing.
  function problemSetup() {
    const now = U.now();
    const d = S().createDraft('errand', {
      type: 'food', title: '2 siomai rice + 2 iced tea', details: { items: '2 siomai rice, 2 iced tea (less ice)' },
      from: 'Food stalls outside Back Gate', to: 'Room 204', neededBy: now - 5 * MIN, rush: false, fee: 25, budget: 180,
    }, 'u_bea');
    const o = S().pay(d, 'gcash', 'u_bea');
    S().act(o.id, 'accept', { skipCode: true }, 'u_mika');
    S().act(o.id, 'buy', { actual: 164 }, 'u_mika');
    S().act(o.id, 'depart', {}, 'u_mika');
    S().act(o.id, 'deliver', { skipCode: true }, 'u_mika');
    const raw = S().order(o.id);
    const times = [-42, -40, -25, -18, -10].map((m) => now + m * MIN);
    raw.createdAt = times[0];
    raw.timeline.forEach((t, i) => { t.at = times[Math.min(i, times.length - 1)]; });
    raw.statusAt = times[4];
    raw.chat = [
      { id: 'm_p1', from: 'u_mika', text: 'Hi Bea! On my way to get your food.', at: times[1] + MIN },
      { id: 'm_p2', from: 'u_mika', text: 'Got everything! Receipt is ₱164 🧾', at: times[2] },
      { id: 'm_p3', from: 'u_mika', text: 'On my way to Room 204. About 3 minutes!', at: times[3] },
    ];
    raw.rated.provider = true;
    S().raw().notifs.forEach((n) => {
      if (n.href === '#/order/' + o.id) { n.at = times[4]; n.read = !/Delivered/.test(n.text); }
    });
    S().touch();
    return o.id;
  }

  function start(id, opts) {
    const sc = SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    S().reset();
    S().login(sc.who);
    const target = sc.setup ? ['/order/' + sc.setup()] : sc.go;
    UI.closeAllSheets();
    const hash = G.router.href(target[0], target[1] || {});
    if (opts && opts.boot) history.replaceState(null, '', location.pathname + location.search + hash);
    else if (location.hash === hash) G.router.refresh();
    else location.hash = hash;
    if (!(opts && opts.quiet)) UI.toast('Scenario ready: ' + sc.title, { icon: 'sparkles' });
  }

  function panel() {
    const st = S().raw();
    const me = S().me();
    const mode = G.sim.mode();
    return html`<div class="demo" data-demo-root>
      <div class="demo-head"><span class="badge badge-demo">DEMO</span><strong>Presenter controls</strong></div>
      <p class="xsmall muted">Everything is simulated. No real money moves, and data stays on this device.</p>

      <h3 class="demo-h">Playing as</h3>
      <div class="demo-personas">
        ${PERSONAS.map(([id, tag]) => {
          const u = st.users[id];
          return html`<button type="button" class="demo-persona ${me && me.id === id ? 'is-on' : ''}" data-demo="as" data-id="${id}" aria-pressed="${String(!!(me && me.id === id))}">
            ${UI.avatar(u, 30)}<span><strong>${u.first} ${u.last[0]}.</strong><small>${tag}</small></span></button>`;
        })}
        <button type="button" class="demo-persona" data-demo="new">${UI.ic('plus', { size: 18 })}<span><strong>New student</strong><small>Try sign-up</small></span></button>
      </div>

      <h3 class="demo-h">Scenarios</h3>
      <div class="demo-scen">
        ${SCENARIOS.map((s, i) => html`<button type="button" data-demo="scenario" data-id="${s.id}">
          <span class="demo-scen-n">${i + 1}</span><span class="grow"><strong>${s.title}</strong><small>${s.text}</small></span>${UI.ic(s.icon, { size: 18 })}</button>`)}
      </div>

      <h3 class="demo-h">Other students</h3>
      <fieldset class="seg demo-mode"><legend class="sr-only">Pacing</legend>
        <label><input type="radio" name="demo-mode" value="auto" ${mode === 'auto' ? 'checked' : ''}><span>Auto</span></label>
        <label><input type="radio" name="demo-mode" value="manual" ${mode === 'manual' ? 'checked' : ''}><span>Manual</span></label>
      </fieldset>
      <p class="xsmall muted">${mode === 'manual' ? 'They act when you press Next step. Chat replies stay automatic.' : 'They act on their own after a few seconds.'}</p>
      <button type="button" class="btn btn-primary btn-block" data-demo="next">${UI.ic('sparkles', { size: 16 })}Next step <kbd>N</kbd></button>
      <p class="demo-up" data-demo-up>${upNext()}</p>

      <div class="demo-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-demo="reset">${UI.ic('refresh-ccw', { size: 15 })}Reset demo data</button>
        <a class="btn btn-ghost btn-sm" href="index.html">${UI.ic('house', { size: 15 })}Landing page</a>
      </div>
    </div>`;
  }
  function upNext() {
    if (!S().me()) return 'Pick someone to play as.';
    const s = G.sim.peek();
    if (!s) return 'Up next: nothing. Start a booking or a scenario.';
    const secs = Math.max(0, Math.ceil((s.dueAt - U.now()) / 1000));
    const when = s.manual ? '(on Next)' : G.sim.mode() === 'manual' && !s.always ? '(on Next)' : secs ? `(in ${secs}s)` : '(now)';
    return `Up next: ${s.label} ${when}`;
  }

  async function handle(e, el) {
    const what = el.dataset.demo;
    if (what === 'as') {
      S().login(el.dataset.id);
      UI.closeAllSheets();
      UI.toast('Now playing as ' + S().shortName(S().me()), { icon: 'user' });
      G.router.go('/home');
      if (location.hash === '#/home') G.router.refresh();
    } else if (what === 'new') {
      S().logout();
      UI.closeAllSheets();
      G.router.go('/signup');
    } else if (what === 'scenario') {
      start(el.dataset.id);
    } else if (what === 'next') {
      const cur = G.router.current();
      const s = G.sim.next(cur && cur.route && cur.route.name === 'order' ? cur.params.id : null);
      UI.toast(s ? 'Demo: ' + s.label : 'Nothing is waiting on the other students.', { icon: 'sparkles' });
    } else if (what === 'reset') {
      const ok = await UI.confirm({ title: 'Reset the demo?', text: 'All bookings, listings and messages go back to the sample data.', ok: 'Reset', danger: true });
      if (!ok) return;
      S().reset();
      UI.toast('Demo data reset.', { icon: 'refresh-ccw' });
      G.router.refresh();
    }
  }

  function wire(root) {
    const off1 = U.on(root, 'click', '[data-demo]', handle);
    const off2 = U.on(root, 'change', 'input[name="demo-mode"]', (e, el) => { S().setSetting('sim', el.value); });
    return () => { off1(); off2(); };
  }

  function redraw() {
    const aside = document.getElementById('demo-panel');
    if (aside) aside.innerHTML = String(panel());
  }
  function openSheet() {
    UI.sheet({
      title: 'Demo controls', className: 'demo-sheet', body: panel(),
      onMount(el) { wire(el); },
    });
  }
  function mount() {
    const aside = document.getElementById('demo-panel');
    if (aside) { redraw(); wire(aside); }
    G.store.on((evt) => { if (['session', 'reset', 'settings', 'remote'].includes(evt.type)) redraw(); });
    setInterval(() => {
      document.querySelectorAll('[data-demo-up]').forEach((el) => { el.textContent = upNext(); });
    }, 1000);
  }

  G.demo = { mount, start, openSheet, SCENARIOS };
})(window.Gopher = window.Gopher || {});
