/* Listing detail: rent gear, or buy/rent notes and books. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  const REPORT_REASONS = ['Copied content (not the seller’s own work)', 'Exam answer key or graded work', 'Not as described', 'Unsafe or not allowed', 'Something else'];

  G.views.listing = {
    title: 'Listing', back: true, tab: 'explore',
    async mount(ctx) {
      const l = await G.store.listing(ctx.params.id);
      if (!l || l.status === 'removed') {
        ctx.render(UI.empty({ icon: 'search', title: 'This listing is gone', text: 'It may have been removed, or the demo was reset.',
          action: html`<a class="btn btn-primary" href="#/explore">Browse Explore</a>` }));
        return;
      }
      const me = await G.store.me();
      const owner = await G.store.user(l.ownerId);
      const mine = l.ownerId === me.id;
      const reviews = (await G.store.reviewsFor(l.ownerId, 'provider')).filter((r) => r.listingId === l.id).slice(0, 3);
      const lr = await G.store.listingRating(l.id);
      const st = {
        days: Math.max(1, parseInt(ctx.query.days, 10) || 1),
        access: l.buy != null && l.format === 'digital' ? 'keep' : l.rent ? 'rent' : 'buy',
      };
      if (l.format === 'book' && l.rent) st.access = 'rent';
      const catLabel = ((l.kind === 'rental' ? C.RENTAL_CATS : C.ACADEMIC_CATS)[l.cat] || {}).label || '';

      function draftFor() {
        if (l.kind === 'rental' || (l.format === 'book' && st.access === 'rent')) {
          return { kind: 'rental', input: { listingId: l.id, days: l.format === 'book' ? Math.max(7, st.days) : st.days } };
        }
        return { kind: 'purchase', input: { listingId: l.id, access: st.access === 'rent7' ? 'rent7' : 'keep' } };
      }
      function options() {
        if (l.kind === 'rental') {
          return html`<div class="field"><span class="label">How many days?</span>
            <div class="row-between"><div class="stepper" role="group" aria-label="Days">
              <button type="button" data-days="-1" aria-label="One day less">−</button><output aria-live="polite">${U.plural(st.days, 'day')}</output><button type="button" data-days="1" aria-label="One day more">+</button>
            </div><span class="small muted">${UI.money(l.rent.price)} a day</span></div></div>`;
        }
        const opts = [];
        if (l.buy != null) opts.push(['keep', l.format === 'digital' ? 'Buy · keep it' : l.format === 'book' ? 'Buy the book' : 'Buy the printed copy', l.buy]);
        if (l.rent && l.rent.per === '7 days') opts.push(['rent7', 'Rent · 7 days of access', l.rent.price]);
        if (l.rent && l.rent.per === 'week') opts.push(['rent', 'Borrow for a week', l.rent.price]);
        if (opts.length < 2) return '';
        return html`<fieldset class="seg seg-stack"><legend>Choose an option</legend>
          ${opts.map(([v, label, p]) => html`<label><input type="radio" name="access" value="${v}" ${st.access === v ? 'checked' : ''}><span><span class="grow">${label}</span><b>${UI.money(p)}</b></span></label>`)}
        </fieldset>`;
      }
      function summary() {
        const q = G.store.sync.quote(draftFor());
        return html`<ul class="breakdown">
          ${q.lines.map(([k, v]) => html`<li><span>${k}</span><span>${UI.money(v)}</span></li>`)}
          <li class="total"><span>Total</span><span>${UI.money(q.total)}</span></li>
        </ul>
        ${q.deposit ? html`<p class="small muted">${UI.ic('shield-check', { size: 15 })} You get the ${UI.money(q.deposit)} deposit back after ${owner.first} checks the item. Late returns take one day’s rate per day from it.</p>` : ''}`;
      }
      function ctaLabel() {
        const q = G.store.sync.quote(draftFor());
        const d = draftFor();
        if (d.kind === 'rental') return 'Request to ' + (l.format === 'book' ? 'borrow' : 'rent') + ' · ' + UI.money(q.total);
        return (st.access === 'rent7' ? 'Rent' : 'Buy') + ' · ' + UI.money(q.total);
      }

      function draw() {
        ctx.render(html`<div class="page detail" data-view="listing">
          <div class="detail-media">${UI.thumb(l, 64)}</div>
          <div class="detail-head">
            <span class="badge">${catLabel}</span>
            ${l.status === 'review' ? html`<span class="badge badge-warn">In review</span>` : ''}
            <h1 class="detail-title">${l.title}</h1>
            <p class="detail-price">${UI.priceText(l)}</p>
            ${lr.count ? html`<p class="small">${UI.stars(lr)} <span class="muted">for this item</span></p>` : ''}
          </div>

          <div class="facts">
            ${l.kind === 'academic' ? html`
              <span class="fact">${UI.ic(l.format === 'digital' ? 'file-text' : l.format === 'printed' ? 'printer' : 'book-open', { size: 16 })}${l.format === 'digital' ? 'Digital (PDF)' : l.format === 'printed' ? 'Printed copy' : 'Physical book'}</span>
              ${l.pages ? html`<span class="fact">${UI.ic('notebook-pen', { size: 16 })}${l.pages} pages</span>` : ''}
              ${l.subject ? html`<span class="fact">${UI.ic('graduation-cap', { size: 16 })}${l.subject}</span>` : ''}` : html`
              <span class="fact">${UI.ic('sparkles', { size: 16 })}${l.condition} condition</span>
              ${l.deposit ? html`<span class="fact">${UI.ic('shield-check', { size: 16 })}${UI.money(l.deposit)} refundable deposit</span>` : html`<span class="fact">${UI.ic('check', { size: 16 })}No deposit</span>`}`}
            ${l.format !== 'digital' ? html`<span class="fact">${UI.ic('map-pin', { size: 16 })}Meet at ${l.spot}</span>` : ''}
          </div>

          <p class="detail-desc">${l.desc}</p>

          ${l.kind === 'academic' ? html`<div class="notice notice-ok">${UI.ic('badge-check', { size: 18 })}
            <span><strong>Original work.</strong> ${owner.first} declared these are ${l.format === 'book' ? 'their own copy of the book' : 'notes they made themselves'}, with no exam answer keys or copied textbook pages.</span></div>` : ''}

          ${l.format === 'digital' ? html`<div class="preview card">
            <div class="preview-page"><strong>${l.subject || l.title}</strong><span>Page 1 of ${l.pages || '—'}</span>
              <i></i><i></i><i class="short"></i><i></i><i class="short"></i></div>
            <div class="preview-blur" aria-hidden="true"><i></i><i></i><i></i></div>
            <p class="preview-note">${UI.ic('lock', { size: 14 })} The rest unlocks after you pay.</p>
          </div>` : ''}

          <section class="sec">
            <h2 class="sec-title">${l.kind === 'rental' ? 'Lender' : 'Seller'}</h2>
            <div class="card card-pad">${UI.userLine(owner)}</div>
          </section>

          ${mine ? html`<div class="notice mt-4">${UI.ic('info', { size: 18 })}<span>This is your listing. ${l.status === 'review' ? 'It goes live after a quick originality check.' : 'Students can find it in Explore now.'}</span></div>`
            : html`<section class="sec" data-region="book">
              <h2 class="sec-title">${l.kind === 'rental' ? 'Book it' : 'Get it'}</h2>
              <div class="card card-pad">${options()}<div data-region="summary">${summary()}</div></div>
            </section>`}

          ${reviews.length ? UI.section('Reviews', html`<div class="stack">${reviews.map((r) => {
            const a = G.store.sync.user(r.fromId);
            return html`<div class="review card card-pad"><div class="row">${UI.avatar(a, 32)}<strong>${UI.name(a)}</strong>${UI.starRow(r.stars)}<span class="xsmall muted grow right">${U.timeAgo(r.at)}</span></div>${r.text ? html`<p class="mt-2 mb-0">${r.text}</p>` : ''}</div>`;
          })}</div>`) : ''}

          ${!mine && l.kind === 'academic' ? html`<button type="button" class="btn btn-ghost btn-sm mt-4" data-action="report-listing">${UI.ic('flag', { size: 15 })} Report this listing</button>` : ''}

          ${mine ? '' : html`<div class="actionbar">
            <div class="actionbar-total grow"><span class="xsmall muted">${l.kind === 'rental' ? 'Free to cancel until pickup' : l.format === 'digital' ? 'Instant access after paying' : 'Free to cancel until confirmed'}</span></div>
            <button type="button" class="btn btn-primary" data-action="book">${ctaLabel()}</button>
          </div>`}
        </div>`);
      }
      draw();
      ctx.setTitle(l.kind === 'rental' ? 'Rent' : 'Notes & Books');

      ctx.on('click', '[data-days]', (e, el) => {
        st.days = Math.max(1, Math.min(7, st.days + Number(el.dataset.days)));
        draw();
      });
      ctx.on('change', 'input[name="access"]', (e, el) => { st.access = el.value; draw(); });
      ctx.on('click', '[data-action="book"]', async () => {
        try {
          const d = draftFor();
          const id = await G.store.createDraft(d.kind, d.input);
          ctx.go('/checkout/' + id);
        } catch (e) { UI.errorToast(e); }
      });
      ctx.on('click', '[data-action="report-listing"]', () => {
        const s = UI.sheet({
          title: 'Report this listing',
          body: html`<p class="sheet-text">We hide reported notes while we check them. If the report stands, buyers get refunds and the seller gets a strike.</p>
            <form data-form="rl">${REPORT_REASONS.map((r, i) => html`<label class="check"><input type="radio" name="reason" value="${r}" ${i === 0 ? 'checked' : ''}><span>${r}</span></label>`)}
            <div class="sheet-actions"><button class="btn btn-primary btn-block" type="submit">Send report</button><button class="btn btn-ghost btn-block" type="button" data-close>Cancel</button></div></form>`,
          onMount(el, close) {
            el.querySelector('form').addEventListener('submit', (e) => {
              e.preventDefault();
              close();
              UI.toast('Thanks. We’ll review it within 24 hours. (Demo: nothing was sent.)', { icon: 'flag' });
            });
          },
        });
        return s;
      });
    },
  };
})(window.Gopher = window.Gopher || {});
