/* Home: quick errands (printing first — the #1 need in the survey), my active
 * bookings, the go-runner card, and rows of things students forget. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  function greeting() {
    const h = new Date(U.now()).getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  G.views.home = {
    title: '', tab: 'home',
    async mount(ctx) {
      async function draw() {
        const me = await G.store.me();
        if (!me) return;
        const [mine, jobs, forgot, reviewers] = await Promise.all([
          G.store.myOrders(),
          G.store.openJobs(),
          G.store.listings({ kind: 'rental' }),
          G.store.listings({ kind: 'academic', cat: 'reviewer', sort: 'new' }),
        ]);
        const active = mine.filter((o) => ['you', 'them'].includes(G.store.sync.nextMove(o, me.id)) || (G.store.sync.nextMove(o, me.id) === 'rate' && U.now() - o.statusAt < U.DAY));
        const forgotPick = ['ls_umbrella_navy', 'ls_calc991', 'ls_powerbank', 'ls_labgown', 'ls_raincoat', 'ls_extcord']
          .map((id) => forgot.find((l) => l.id === id)).filter(Boolean).filter((l) => l.ownerId !== me.id);
        const reviewerPick = reviewers.filter((l) => l.ownerId !== me.id).slice(0, 6);

        ctx.render(html`<div class="page home" data-view="home">
          <div class="home-hello">
            <h1>${greeting()}, ${me.first} 👋</h1>
            <p class="muted">What do you need today?</p>
            <form class="search" data-form="search" role="search">
              ${UI.ic('search', { size: 18 })}
              <input class="search-input" name="q" type="search" placeholder="Search reviewers, calculators, umbrellas…" aria-label="Search Gopher">
            </form>
          </div>

          ${me.verified ? '' : html`<div class="notice notice-warn mt-4">${UI.ic('clock', { size: 18 })}<span>We’re checking your ${me.verification ? (C.VERIFY_METHODS[me.verification.method] || {}).short : 'student ID'}. You can look around now. Booking, listing and earning unlock once you’re verified, usually within a few minutes.</span></div>`}

          <section class="sec">
            <div class="sec-head"><h2 class="sec-title">Book an errand</h2><span class="sec-note">from ${UI.money(Math.min(...Object.values(C.ERRAND_TYPES).map((t) => t.fee)))}</span></div>
            <div class="tiles">
              ${C.ERRAND_ORDER.map((k) => {
                const t = C.ERRAND_TYPES[k];
                return html`<a class="tile ${k === 'print' ? 'tile-hero' : ''}" href="#/errand/new?type=${k}">
                  <span class="tile-icon">${UI.ic(t.icon, { size: k === 'print' ? 26 : 22 })}</span>
                  <span class="tile-label">${t.label}</span>
                  <span class="tile-price">from ${UI.money(t.fee)}</span>
                </a>`;
              })}
            </div>
          </section>

          ${active.length ? UI.section('Your bookings', html`<div class="stack">${active.slice(0, 3).map((o) => UI.orderRow(o, me.id))}</div>`,
            html`<a class="sec-link" href="#/activity">See all</a>`) : ''}

          <section class="sec">
            ${me.online
              ? html`<div class="runner-card is-online">
                  <div class="row-between"><div><h2 class="sec-title">You’re online</h2><p class="small muted mb-0">Take an errand between classes. You keep 100% of the fee.</p></div>
                  <label class="switch"><input type="checkbox" data-action="online" checked aria-label="Available as a go-runner"></label></div>
                </div>
                <div class="stack">${jobs.slice(0, 3).map((o) => UI.jobCard(o))}</div>
                ${jobs.length > 3 ? html`<a class="btn btn-soft btn-block mt-3" href="#/explore?tab=jobs">See all ${jobs.length} jobs</a>` : ''}`
              : html`<div class="runner-card">
                  <span class="runner-icon">${UI.ic('hand-coins', { size: 26 })}</span>
                  <div class="grow"><h2 class="sec-title">Free period? Earn as a go-runner</h2>
                    <p class="small muted">${U.plural(jobs.length, 'errand job')} open near you right now.</p></div>
                  <label class="switch"><input type="checkbox" data-action="online" aria-label="Go online as a go-runner"><span class="sr-only">Go online</span></label>
                </div>`}
          </section>

          ${forgotPick.length ? UI.section('Forgot something?', html`<div class="hscroll">${forgotPick.map((l) => UI.listingCard(l))}</div>`,
            html`<a class="sec-link" href="#/explore?tab=rentals">All rentals</a>`) : ''}

          ${reviewerPick.length ? UI.section('Fresh reviewers', html`<div class="hscroll">${reviewerPick.map((l) => UI.listingCard(l))}</div>`,
            html`<a class="sec-link" href="#/explore?tab=notes&cat=reviewer">See all</a>`) : ''}

          <p class="page-foot">Pilot at Ateneo de Naga · Class project prototype · No real payments</p>
        </div>`);
      }
      await draw();
      ctx.on('submit', 'form[data-form="search"]', (e, form) => {
        e.preventDefault();
        const q = String(U.formData(form).q || '').trim();
        ctx.go('/explore', { tab: /calc|umbrella|tripod|camera|mic|light|power|gown|raincoat/i.test(q) ? 'rentals' : 'notes', q });
      });
      ctx.on('change', '[data-action="online"]', async (e, el) => {
        try {
          await G.store.updateMe({ online: el.checked });
          UI.toast(el.checked ? 'You’re online. Errand jobs near you are below.' : 'You’re offline. No new jobs will be offered.', { icon: el.checked ? 'zap' : 'circle-check' });
        } catch (err) { el.checked = false; UI.errorToast(err); }
      });
      ctx.watch(() => {
        // Don't redraw while someone is typing in the search box.
        if (ctx.root.contains(document.activeElement) && document.activeElement.matches('input')) return;
        draw();
      });
    },
  };
})(window.Gopher = window.Gopher || {});
