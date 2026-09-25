/* Activity: every booking I'm part of, grouped by whose move it is. */
(function (G) {
  'use strict';
  const U = G.util, UI = G.ui, html = U.html;
  const S = () => G.store.sync;
  G.views = G.views || {};

  const FILTERS = [['all', 'All'], ['errand', 'Errands'], ['rental', 'Rentals'], ['purchase', 'Notes & Books'], ['provider', 'As provider']];

  G.views.activity = {
    title: 'Activity', tab: 'activity',
    async mount(ctx) {
      ctx.render(html`<div class="page activity" data-view="activity">
        <h1 class="h-page">Activity</h1>
        <div class="chips" data-region="filters"></div>
        <div data-region="list"></div>
      </div>`);
      await G.views.activity.update(ctx, ctx.query);
      ctx.on('click', '[data-f]', (e, el) => ctx.go('/activity', el.dataset.f === 'all' ? {} : { f: el.dataset.f }, true));
      ctx.watch(() => G.views.activity.update(ctx, ctx.query));
    },
    async update(ctx, query) {
      const f = query.f || 'all';
      const me = await G.store.me();
      const all = await G.store.myOrders();
      const list = all.filter((o) => f === 'all' || (f === 'provider' ? o.providerId === me.id : o.kind === f));
      const groups = { you: [], them: [], done: [] };
      list.forEach((o) => {
        const m = S().nextMove(o, me.id);
        if (m === 'you' || m === 'rate') groups.you.push(o);
        else if (m === 'them') groups.them.push(o);
        else groups.done.push(o);
      });
      ctx.region('filters', html`${FILTERS.map(([k, l]) => html`<button type="button" class="chip" aria-pressed="${String(f === k)}" data-f="${k}">${l}</button>`)}`);
      const block = (title, items, note) => (items.length ? html`<section class="sec">
          <div class="sec-head"><h2 class="sec-title">${title} <span class="count-badge">${items.length}</span></h2>${note ? html`<span class="sec-note">${note}</span>` : ''}</div>
          <div class="stack">${items.map((o) => UI.orderRow(o, me.id))}</div></section>` : '');
      ctx.region('list', list.length ? html`
          ${block('Needs your action', groups.you)}
          ${block('In progress', groups.them, 'Waiting on the other student')}
          ${block('Past', groups.done)}`
        : UI.empty({ icon: 'clipboard-list', title: 'Nothing here yet', text: 'Book an errand, rent something, or grab a reviewer. It’ll show up here.',
          action: html`<a class="btn btn-primary" href="#/home">Find something</a>` }));
    },
  };
})(window.Gopher = window.Gopher || {});
