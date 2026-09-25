/* Smaller screens: wallet, notifications, the reviewer reader, and not-found. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  const S = () => G.store.sync;
  G.views = G.views || {};

  // ---- Wallet ------------------------------------------------------------------------
  G.views.wallet = {
    title: 'Wallet', back: true, tab: 'profile',
    async mount(ctx) {
      async function draw() {
        const me = await G.store.me();
        const w = me.wallet;
        ctx.render(html`<div class="page wallet" data-view="wallet">
          <div class="wallet-hero">
            <span class="small">Available</span>
            <strong class="wallet-big">${UI.money(w.available)}</strong>
            <button type="button" class="btn btn-white" data-action="cashout" ${w.available < 50 ? 'disabled' : ''}>${UI.ic('wallet', { size: 18 })}Cash out to GCash</button>
            <span class="xsmall">Demo: no real money moves.</span>
          </div>
          <div class="notice mt-4">${UI.ic('info', { size: 18 })}<span>Earnings from GCash bookings land here after the hand-off, plus reimbursements for items you bought. On cash jobs, the ${UI.money(C.SERVICE_FEE)} service fee is taken from here.</span></div>
          ${UI.section('History', w.tx.length ? html`<ul class="txlist card">${w.tx.map((t) => html`<li>
              <span class="tx-icon ${t.amount < 0 ? 'neg' : ''}">${UI.ic(t.amount < 0 ? 'arrow-right' : 'hand-coins', { size: 16 })}</span>
              <span class="grow"><span class="tx-label">${t.label}</span><span class="xsmall muted">${U.fmtWhen(t.at)}</span></span>
              <span class="tx-amt ${t.amount < 0 ? 'neg' : 'pos'}">${t.amount > 0 ? '+' : ''}${UI.money(t.amount)}</span></li>`)}</ul>`
            : UI.empty({ icon: 'wallet', title: 'No earnings yet', text: 'Go online as a go-runner or list something to start earning.' }))}
        </div>`);
      }
      await draw();
      ctx.on('click', '[data-action="cashout"]', async () => {
        const me = await G.store.me();
        UI.sheet({
          title: 'Cash out to GCash (demo)',
          body: html`<form data-form="cashout" novalidate>
            <label class="field"><span class="label">Amount</span><span class="input-group"><span class="prefix">₱</span>
              <input class="input" type="number" name="amount" min="50" max="${me.wallet.available}" value="${Math.floor(me.wallet.available)}" inputmode="numeric"></span>
              <span class="hint">Minimum ₱50. Arrives in your GCash within a day in the real app.</span></label>
            <p class="error-text" data-error hidden></p>
            <div class="sheet-actions"><button class="btn btn-primary btn-block btn-lg" type="submit">Cash out</button></div>
          </form>`,
          onMount(el, close) {
            el.querySelector('form').addEventListener('submit', async (e) => {
              e.preventDefault();
              try {
                const amt = Number(U.formData(e.target).amount);
                await G.store.cashOut(amt);
                close();
                UI.toast(`${UI.money(amt)} is on its way to your GCash (demo).`, { icon: 'wallet' });
              } catch (err) {
                const x = el.querySelector('[data-error]');
                x.textContent = err.message; x.hidden = false;
              }
            });
          },
        });
      });
      ctx.watch(draw);
    },
  };

  // ---- Notifications -----------------------------------------------------------------------
  G.views.notifications = {
    title: 'Notifications', back: true,
    async mount(ctx) {
      const list = await G.store.notifications();
      const iconFor = (t) => (/earned|wallet|₱/.test(t) ? 'hand-coins' : /rated|star/i.test(t) ? 'star' : /report|ticket|support/i.test(t) ? 'life-buoy'
        : /accepted|on the way|delivered|printed|bought|picked/i.test(t) ? 'bike' : /review/i.test(t) ? 'shield-check' : /:/.test(t) ? 'message-circle' : 'bell');
      ctx.render(html`<div class="page notifs" data-view="notifications">
        <h1 class="h-page">Notifications</h1>
        ${list.length ? html`<ul class="nlist card">${list.map((n) => html`<li class="${n.read ? '' : 'is-new'}">
            <a href="${n.href && n.href.startsWith('#/') ? n.href : '#/home'}">
              <span class="n-icon">${UI.ic(iconFor(n.text), { size: 18 })}</span>
              <span class="grow"><span class="n-text">${n.text}</span><span class="xsmall muted">${U.timeAgo(n.at)}</span></span>
              ${n.read ? '' : html`<span class="n-dot" aria-label="New"></span>`}
            </a></li>`)}</ul>`
          : UI.empty({ icon: 'bell', title: 'You’re all caught up', text: 'Updates about your bookings show up here.' })}
      </div>`);
      ctx.timeout(() => G.store.markAllRead(), 1200);
    },
  };

  // ---- Reader (digital notes you bought) -------------------------------------------------------
  G.views.reader = {
    title: 'Reader', back: true, tab: 'activity',
    async mount(ctx) {
      const o = await G.store.order(ctx.params.id);
      const me = await G.store.me();
      if (!o || o.requesterId !== me.id || o.kind !== 'purchase' || o.status !== 'unlocked') {
        ctx.render(UI.empty({ icon: 'lock', title: 'No access', text: 'Only the student who bought this can open it.' }));
        return;
      }
      const l = await G.store.listing(o.listingId);
      const ended = o.purchase.expiresAt && o.purchase.expiresAt < U.now();
      if (ended) { ctx.render(UI.empty({ icon: 'clock', title: 'Your 7-day access ended', action: html`<a class="btn btn-primary" href="#/listing/${l.id}">Buy it to keep</a>` })); return; }
      const mark = `${UI.name(me)} · ${o.id}`;
      const topics = ['Key terms and definitions', 'Summary tables', 'Worked examples', 'Practice problems', 'Answers and explanations'];
      ctx.render(html`<div class="page reader" data-view="reader">
        <div class="row-between"><h1 class="h-page mb-0">${l.subject || l.title}</h1><span class="badge">${o.purchase.access === 'rent7' ? 'Until ' + U.fmtDay(o.purchase.expiresAt) : 'Yours to keep'}</span></div>
        <p class="small muted">${l.title} · ${l.pages} pages · by ${UI.name(S().user(l.ownerId))}</p>
        ${[1, 2].map((p) => html`<article class="rpage" data-mark="${mark}">
          <header><strong>${l.subject || 'Reviewer'}</strong><span>Page ${p} of ${l.pages}</span></header>
          <h2>${p === 1 ? 'Overview' : topics[1]}</h2>
          <ul>${topics.slice(p === 1 ? 0 : 2, p === 1 ? 3 : 5).map((t) => html`<li>${t}</li>`)}</ul>
          <i></i><i></i><i class="short"></i><i></i><i></i><i class="short"></i><i></i>
          <footer>${mark}</footer>
        </article>`)}
        <div class="notice">${UI.ic('info', { size: 18 })}<span>Demo reader: in the real app the seller’s PDF opens here, watermarked with your name and booking ID so it isn’t shared around.</span></div>
      </div>`);
    },
  };

  G.views.notFound = {
    title: 'Not found', back: true,
    async mount(ctx) {
      ctx.render(UI.empty({ icon: 'search', title: 'Page not found', text: 'That link doesn’t go anywhere in the demo.', action: html`<a class="btn btn-primary" href="#/home">Go home</a>` }));
    },
  };
})(window.Gopher = window.Gopher || {});
