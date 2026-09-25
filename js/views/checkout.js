/* Checkout: price breakdown, payment method (GCash-first, cash when allowed),
 * and a clearly-labelled demo payment. It never asks for a phone number, MPIN
 * or OTP and doesn't imitate GCash's own screens. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  function policy(d) {
    if (d.kind === 'errand') return `Free to cancel until a go-runner accepts. After that, ${UI.money(C.ERRAND_CANCEL_FEE)} goes to your go-runner. Once they’ve bought or printed your items, it can’t be cancelled.`;
    if (d.kind === 'rental') return 'Free to cancel until pickup. If the lender declines, you get a full refund. Deposits come back after the return check.';
    return 'Free to cancel until the seller confirms. Digital purchases are final, but you can report them within 24 hours if they’re not as described.';
  }

  G.views.checkout = {
    title: 'Checkout', back: true,
    async mount(ctx) {
      let d;
      try { d = await G.store.getDraft(ctx.params.id); } catch (e) {
        ctx.render(UI.empty({ icon: 'receipt', title: 'This checkout expired', text: e.message, action: html`<a class="btn btn-primary" href="#/home">Go home</a>` }));
        return;
      }
      if (d.orderId) { ctx.go('/order/' + d.orderId, {}, true); return; }
      const q = await G.store.quote(d);
      const opts = await G.store.payOptions(q);
      let method = 'gcash';
      const l = d.input.listingId ? await G.store.listing(d.input.listingId) : null;
      const owner = l ? await G.store.user(l.ownerId) : null;
      const t = d.kind === 'errand' ? C.ERRAND_TYPES[d.input.type] : null;

      function what() {
        if (d.kind === 'errand') {
          return html`<div class="row"><span class="orow-icon">${UI.ic(t.icon, { size: 22 })}</span>
            <div class="grow"><strong>${d.input.title}</strong><div class="small muted">${t.label} · to ${d.input.to} by ${U.fmtTime(d.input.neededBy)}</div></div></div>`;
        }
        return html`<div class="row"><span class="co-thumb">${UI.thumb(l, 26)}</span>
          <div class="grow"><strong>${l.title}</strong><div class="small muted">${d.kind === 'rental' ? `${U.plural(d.input.days, 'day')} · from ${UI.name(owner)}` : (d.input.access === 'rent7' ? '7-day access' : 'Yours to keep') + ' · from ' + UI.name(owner)}</div></div></div>`;
      }
      function draw() {
        ctx.render(html`<div class="page checkout" data-view="checkout">
          <h1 class="h-page">Review and pay</h1>
          <div class="card card-pad">${what()}</div>
          <ul class="breakdown card card-pad mt-3">
            ${q.lines.map(([k, v]) => html`<li><span>${k}</span><span>${UI.money(v)}</span></li>`)}
            <li class="total"><span>Total</span><span>${UI.money(q.total)}</span></li>
          </ul>
          <p class="xsmall muted mt-2">${UI.ic('info', { size: 13 })} The ₱${C.SERVICE_FEE} service fee is how Gopher runs. No markup on items: you pay the receipt price. <a href="help.html#payments">Pilot pricing</a></p>

          <fieldset class="paylist mt-4"><legend class="label">Pay with</legend>
            ${opts.map((o) => html`<label class="payopt ${o.ok ? '' : 'is-off'}">
              <input type="radio" name="method" value="${o.method}" ${method === o.method ? 'checked' : ''} ${o.ok ? '' : 'disabled'}>
              <span class="payopt-icon">${UI.ic(o.method === 'cash' ? 'hand-coins' : 'wallet', { size: 20 })}</span>
              <span class="grow"><span class="payopt-name">${C.PAYMENT_LABELS[o.method]}</span>
                <span class="payopt-sub">${o.ok ? (o.method === 'gcash' ? 'Protected by Gopher Hold: we keep it until the hand-off.' : 'Pay the exact amount in person. Not covered by Gopher Hold.') : o.reason}</span></span>
            </label>`)}
          </fieldset>

          <div class="notice mt-4">${UI.ic('receipt', { size: 18 })}<span>${policy(d)} <a href="terms.html#cancellations">Full rules</a></span></div>
          <p class="xsmall muted mt-3">By paying, you agree to Gopher’s <a href="terms.html">Terms</a>. This is a class-project demo: no real money moves.</p>

          <div class="actionbar">
            <div class="actionbar-total grow"><span class="xsmall muted">Total</span><strong>${UI.money(q.total)}</strong></div>
            <button type="button" class="btn btn-primary btn-lg" data-action="pay">${method === 'cash' ? 'Place booking' : 'Pay ' + UI.money(q.total)}</button>
          </div>
        </div>`);
      }
      draw();

      async function place(m) {
        try {
          const o = await G.store.pay(d.id, m);
          UI.toast(m === 'gcash' ? `${UI.money(q.total)} held by Gopher` : 'Booking placed. Pay in cash on hand-off.', { icon: 'shield-check' });
          ctx.go('/order/' + o.id, {}, true);
        } catch (e) { UI.errorToast(e); }
      }
      ctx.on('change', 'input[name="method"]', (e, el) => { method = el.value; draw(); });
      ctx.on('click', '[data-action="pay"]', () => {
        if (method === 'cash') { place('cash'); return; }
        UI.sheet({
          title: 'GCash (demo)',
          className: 'paysheet',
          body: html`<div class="pay-demo">
              <span class="pay-demo-badge">${UI.ic('lock', { size: 14 })} Demo payment</span>
              <p class="pay-demo-amt">${UI.money(q.total)}</p>
              <p class="pay-demo-to">to Gopher Hold · ${d.kind === 'errand' ? t.label : l.title}</p>
              <p class="small muted">In the real app you’d approve this in your GCash app. Here, no real money moves and nothing leaves this device.</p>
            </div>
            <div class="sheet-actions">
              <button type="button" class="btn btn-primary btn-block btn-lg" data-ok>Confirm demo payment</button>
              <button type="button" class="btn btn-ghost btn-block" data-close>Cancel</button>
            </div>`,
          onMount(el, close) {
            el.querySelector('[data-ok]').addEventListener('click', () => { close(); place('gcash'); });
          },
        });
      });
    },
  };
})(window.Gopher = window.Gopher || {});
