/* Explore: Notes & Books (default — the top single service in the survey),
 * Rentals, and Errand jobs (what go-runners pick from). */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  const TABS = [
    { id: 'notes', label: 'Notes & Books', icon: 'book-open' },
    { id: 'rentals', label: 'Rentals', icon: 'umbrella' },
    { id: 'jobs', label: 'Errand jobs', icon: 'bike' },
  ];
  const SORTS = [['relevant', 'Recommended'], ['price', 'Lowest price'], ['rating', 'Top rated'], ['new', 'Newest']];

  function cats(tab) {
    if (tab === 'notes') return Object.entries(C.ACADEMIC_CATS).map(([k, v]) => [k, v.label]);
    if (tab === 'rentals') return Object.entries(C.RENTAL_CATS).map(([k, v]) => [k, v.label]);
    return C.ERRAND_ORDER.map((k) => [k, C.ERRAND_TYPES[k].short]);
  }

  G.views.explore = {
    title: 'Explore', tab: 'explore',
    async mount(ctx) {
      const q0 = ctx.query;
      ctx.render(html`<div class="page explore" data-view="explore">
        <h1 class="sr-only">Explore</h1>
        <div class="tabs" role="tablist" aria-label="What to browse" data-region="tabs"></div>
        <form class="search mt-3" data-form="search" role="search">
          ${UI.ic('search', { size: 18 })}
          <input class="search-input" name="q" type="search" value="${q0.q || ''}" placeholder="Search by title, subject or student" aria-label="Search">
        </form>
        <div class="chips mt-3" data-region="chips"></div>
        <div data-region="results" aria-live="polite"></div>
      </div>`);
      await G.views.explore.update(ctx, ctx.query);

      const setQuery = (patch) => {
        const next = Object.assign({}, ctx.query, patch);
        Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] == null) delete next[k]; });
        ctx.go('/explore', next, true);
      };
      ctx.on('click', '[data-tab-id]', (e, el) => setQuery({ tab: el.dataset.tabId, cat: '', sort: '' }));
      ctx.on('click', '[data-cat]', (e, el) => setQuery({ cat: el.dataset.cat === ctx.query.cat ? '' : el.dataset.cat }));
      ctx.on('change', 'select[name="sort"]', (e, el) => setQuery({ sort: el.value === 'relevant' ? '' : el.value }));
      ctx.on('submit', 'form[data-form="search"]', (e) => e.preventDefault());
      ctx.on('input', 'input[name="q"]', U.debounce((e, el) => setQuery({ q: el.value.trim() }), 250));
      ctx.on('change', '[data-action="online"]', async (e, el) => {
        try {
          await G.store.updateMe({ online: el.checked });
          UI.toast(el.checked ? 'You’re online. Tap a job to accept it.' : 'You’re offline.', { icon: 'zap' });
        } catch (err) { el.checked = false; UI.errorToast(err); }
      });
      ctx.watch(() => G.views.explore.update(ctx, ctx.query, true));
    },

    async update(ctx, query, fromStore) {
      const tab = TABS.some((t) => t.id === query.tab) ? query.tab : 'notes';
      const me = await G.store.me();
      ctx.region('tabs', html`${TABS.map((t) => html`<button type="button" role="tab" aria-selected="${String(t.id === tab)}" data-tab-id="${t.id}">${UI.ic(t.icon, { size: 16 })}<span>${t.label}</span></button>`)}`);
      const cs = cats(tab);
      ctx.region('chips', html`<button type="button" class="chip" aria-pressed="${String(!query.cat)}" data-cat="">All</button>
        ${cs.map(([k, label]) => html`<button type="button" class="chip" aria-pressed="${String(query.cat === k)}" data-cat="${k}">${label}</button>`)}`);

      let body;
      if (tab === 'jobs') {
        const jobs = await G.store.openJobs({ type: query.cat || '' });
        const q = (query.q || '').toLowerCase();
        const list = q ? jobs.filter((o) => (o.errand.title + ' ' + o.errand.from + ' ' + o.errand.to).toLowerCase().includes(q)) : jobs;
        body = html`${me.online ? '' : html`<div class="notice notice-warn mb-3">${UI.ic('zap', { size: 18 })}
            <span class="grow">You’re offline. Go online to accept errand jobs.</span>
            <label class="switch"><input type="checkbox" data-action="online" aria-label="Go online"></label></div>`}
          <p class="result-count">${U.plural(list.length, 'open job')} · earn the full errand fee</p>
          ${list.length ? html`<div class="stack">${list.map((o) => UI.jobCard(o))}</div>`
            : UI.empty({ icon: 'bike', title: 'No open jobs right now', text: 'New errands show up here the moment students post them.' })}`;
      } else {
        const items = await G.store.listings({ kind: tab === 'notes' ? 'academic' : 'rental', cat: query.cat || '', q: query.q || '', sort: query.sort || 'relevant' });
        body = html`<div class="row-between result-bar">
            <p class="result-count">${U.plural(items.length, 'result')}${query.q ? html` for “${query.q}”` : ''}</p>
            <label class="sort"><span class="sr-only">Sort by</span>
              <select class="select select-sm" name="sort">${SORTS.map(([v, l]) => html`<option value="${v}" ${(query.sort || 'relevant') === v ? 'selected' : ''}>${l}</option>`)}</select></label>
          </div>
          ${tab === 'notes' ? html`<p class="small muted ip-note">${UI.ic('shield-check', { size: 15 })} Original student work only. Every listing is checked before it goes live.</p>` : ''}
          ${items.length ? html`<div class="grid">${items.map((l) => UI.listingCard(l))}</div>`
            : UI.empty({ icon: 'search', title: 'Nothing matches yet', text: 'Try another word or category.',
              action: html`<a class="btn btn-soft" href="#/list/new?kind=${tab === 'notes' ? 'academic' : 'rental'}">List one yourself</a>` })}`;
      }
      ctx.region('results', body);
      if (!fromStore) ctx.setTitle('Explore');
    },
  };
})(window.Gopher = window.Gopher || {});
