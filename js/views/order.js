/* Booking detail — one screen for every booking type and both sides of it.
 * Also what a go-runner sees on an open errand job (with an Accept button).
 * Live parts are regions redrawn on store changes; the chat box is never redrawn,
 * so typing isn't interrupted.
 */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  const S = () => G.store.sync;
  G.views = G.views || {};

  const PATH = {
    errand: ['open', 'accepted', 'bought', 'on_the_way', 'completed'],
    rental: ['requested', 'confirmed', 'in_use', 'returned', 'completed'],
    purchase: ['requested', 'confirmed', 'completed'],
    digital: ['unlocked'],
  };
  const TAGS = {
    provider: ['On time', 'Friendly', 'Kept me updated', 'Receipt included', 'Item as described'],
    requester: ['Clear instructions', 'Quick to reply', 'Easy hand-off'],
  };
  const REPORT = ['Missing or wrong items', 'Late or didn’t show up', 'Item damaged', 'Charged the wrong amount', 'Something else'];

  function statusName(o, s) {
    if (o.kind === 'errand' && s === 'bought') return C.ERRAND_TYPES[o.errand.type].doneLabel;
    const meta = (C.STATUS[o.kind] || {})[s];
    return meta ? meta.label : s;
  }

  G.views.order = {
    title: 'Booking', back: true, tab: 'activity',
    async mount(ctx) {
      const id = ctx.params.id;
      const me = await G.store.me();
      const first = await G.store.order(id);
      if (!first) {
        ctx.render(UI.empty({ icon: 'search', title: 'Booking not found', text: 'It may have been removed, or the demo was reset.',
          action: html`<a class="btn btn-primary" href="#/activity">Go to Activity</a>` }));
        return;
      }
      if (!S().roleOf(first, me.id) && !(first.kind === 'errand' && first.status === 'open')) {
        ctx.render(UI.empty({ icon: 'lock', title: 'This booking isn’t yours', text: 'Only the two students in a booking can see it.' }));
        return;
      }

      ctx.render(html`<div class="page order" data-view="order">
        <div data-region="head"></div>
        <div data-region="next"></div>
        <div data-region="action"></div>
        <div data-region="timeline"></div>
        <div data-region="details"></div>
        <div data-region="money"></div>
        <div data-region="people"></div>
        <div data-region="ticket"></div>
        <section class="sec chat-sec" data-chat-sec hidden>
          <h2 class="sec-title" data-region="chat-title">Chat</h2>
          <div class="chat" data-region="chat" aria-live="polite"></div>
          <form class="composer" data-form="chat" autocomplete="off">
            <div class="chips quick" data-region="quick"></div>
            <div class="composer-row">
              <label class="sr-only" for="chat-input">Message</label>
              <input class="input" id="chat-input" name="text" maxlength="500" placeholder="Write a message…">
              <button class="btn btn-primary btn-icon-send" type="submit" aria-label="Send">${UI.ic('send', { size: 18 })}</button>
            </div>
            <p class="xsmall muted mt-2">${UI.ic('shield-check', { size: 13 })} Keep chats and payments in Gopher. Never share your GCash MPIN.</p>
          </form>
        </section>
        <div data-region="more"></div>
      </div>`);

      const last = {};
      function set(name, safe) {
        const s = String(safe);
        if (last[name] === s) return;
        last[name] = s;
        ctx.region(name, s);
      }

      function draw() {
        const o = S().order(id);
        if (!o) return;
        const meNow = S().me();
        const role = S().roleOf(o, meNow.id);
        const other = S().user(S().otherParty(o, meNow.id)) || null;
        const l = o.listingId ? S().listing(o.listingId) : null;
        set('head', head(o, role, other, l));
        set('action', actionArea(o, role, other, l, meNow));
        set('timeline', timeline(o));
        set('details', details(o, role, l));
        set('money', moneyCard(o, role, other));
        set('people', people(o, role, other));
        set('ticket', ticketCard(o));
        const chatSec = ctx.root.querySelector('[data-chat-sec]');
        if (chatSec) chatSec.hidden = !(role && other);
        if (role && other) {
          set('chat-title', html`Chat with ${other.first}`);
          const wasBottom = isChatAtBottom();
          set('chat', chat(o, meNow, other));
          set('quick', quick(o, role));
          if (wasBottom) scrollChat();
        }
        set('more', more(o, role, meNow));
        drawNext();
        ctx.setTitle(o.kind === 'errand' ? (role ? 'Errand' : 'Errand job') : o.kind === 'rental' ? 'Rental' : 'Order');
      }
      function drawNext() {
        const o = S().order(id);
        if (!o) return;
        const mode = G.sim.mode();
        const step = mode === 'off' ? null : G.sim.pendingFor(id).filter((s) => s.action !== 'reply')[0];
        if (!step) { set('next', ''); return; }
        const secs = Math.max(0, Math.ceil((step.dueAt - U.now()) / 1000));
        const when = step.manual ? 'tap to do it now' : (!step.always && mode === 'manual') ? 'press N or tap' : secs > 0 ? 'in ' + secs + 's · tap to skip' : 'now';
        set('next', html`<button type="button" class="btn btn-dashed btn-block demo-next" data-action="next">
          ${UI.ic('sparkles', { size: 15 })}<span class="grow">Demo · ${step.label}</span><span class="demo-next-when">${when}</span></button>`);
      }

      // ---- region builders ---------------------------------------------------------------
      function head(o, role, other, l) {
        const e = o.errand;
        let line = '';
        if (o.kind === 'errand') {
          const run = other && role === 'requester' ? other.first : null;
          line = {
            open: role ? `Finding a go-runner · ${U.plural(S().users().filter((u) => u.online && u.id !== o.requesterId).length, 'go-runner')} online` : `${UI.name(S().user(o.requesterId))} needs this ${U.inMinutes(e.neededBy)}`,
            accepted: role === 'provider' ? `Go to ${e.from}` : `${run} is on it`,
            bought: role === 'provider' ? `Bring it to ${e.to}` : `${statusName(o, 'bought')}${e.actual ? ' · receipt ' + UI.money(e.actual) : ''}`,
            on_the_way: role === 'provider' ? `Hand it over at ${e.to}` : `${run} is on the way to ${e.to}`,
            completed: `Delivered ${U.fmtWhen(o.statusAt)}`,
            cancelled: 'This errand was cancelled',
          }[o.status] || '';
        } else if (o.kind === 'rental') {
          line = {
            requested: role === 'provider' ? `${other.first} wants to rent this for ${U.plural(o.rental.days, 'day')}` : `Waiting for ${other.first} to confirm`,
            confirmed: `Meet at the ${l ? l.spot : 'meetup spot'}`,
            in_use: `Return by ${U.fmtWhen(o.rental.returnBy)}`,
            returned: role === 'provider' ? 'Check the item and close the rental' : `${other.first} is checking the item`,
            completed: 'Rental completed',
            declined: 'The lender declined · full refund',
            cancelled: 'Rental cancelled',
          }[o.status] || '';
        } else {
          line = {
            requested: role === 'provider' ? `${other.first} wants to buy this` : `Waiting for ${other.first} to confirm`,
            confirmed: `Meet at the ${l ? l.spot : 'meetup spot'}`,
            completed: 'Completed',
            unlocked: o.purchase.access === 'rent7' ? `Access until ${U.fmtWhen(o.purchase.expiresAt)}` : 'Yours to keep',
            declined: 'Declined · full refund',
            cancelled: 'Cancelled',
          }[o.status] || '';
        }
        return html`<div class="order-head">
          <span class="order-icon">${o.kind === 'errand' ? UI.ic(UI.orderIcon(o), { size: 26 }) : UI.thumb(l || {}, 26)}</span>
          <div class="grow">
            ${UI.statusPill(o)}
            <h1 class="order-title">${UI.orderTitle(o)}</h1>
            <p class="order-line">${line}</p>
            <p class="xsmall muted mb-0">${o.id} · ${o.kind === 'errand' ? C.ERRAND_TYPES[o.errand.type].label : o.kind === 'rental' ? 'Rental' : 'Purchase'} · booked ${U.timeAgo(o.createdAt)}</p>
          </div>
        </div>`;
      }

      function codeCard(title, code, text) {
        return html`<div class="code-card">
          <div class="code-card-top"><span>${UI.ic('lock', { size: 16 })} ${title}</span><span class="xsmall">Only show it in person</span></div>
          <div class="code-digits" aria-label="${title}: ${code.split('').join(' ')}">${code.split('').map((c) => html`<span>${c}</span>`)}</div>
          <p class="small mb-0">${text}</p>
        </div>`;
      }

      function actionArea(o, role, other, l, meNow) {
        const out = [];
        const rq = role === 'requester', pv = role === 'provider';
        const s = o.status;
        // codes the receiver shows
        if (o.kind === 'errand' && rq && ['accepted', 'bought', 'on_the_way'].includes(s)) out.push(codeCard('Your hand-off code', o.code, `Show this to ${other.first} when they arrive. Don’t share it before you have your items.`));
        if (o.kind === 'rental' && rq && s === 'confirmed') out.push(codeCard('Your pickup code', o.code, `Show this to ${other.first} at the ${l.spot} when you get the item.`));
        if (o.kind === 'rental' && pv && s === 'in_use') out.push(codeCard('Your return code', o.returnCode, `${other.first} enters this when they give the item back.`));
        if (o.kind === 'purchase' && rq && s === 'confirmed') out.push(codeCard('Your hand-off code', o.code, `Show this to ${other.first} at the ${l.spot}.`));

        const btn = (action, label, cls, icon) => html`<button type="button" class="btn ${cls || 'btn-primary'} btn-block btn-lg" data-action="${action}">${icon ? UI.ic(icon, { size: 18 }) : ''}${label}</button>`;
        if (o.kind === 'errand') {
          if (s === 'open' && !role) {
            out.push(html`<div class="earn-box"><span>You earn</span><strong>${UI.money(S().earning(o))}</strong>${o.money.items ? html`<span class="small">+ up to ${UI.money(o.money.items)} reimbursed for items, at the receipt price</span>` : ''}</div>`);
            if (!meNow.online) out.push(html`<p class="small muted center">You’re offline. Accepting puts you online.</p>`);
            out.push(btn('accept', 'Accept job', 'btn-primary', 'check'));
          }
          if (s === 'open' && rq) out.push(html`<div class="notice">${UI.ic('clock', { size: 18 })}<span>We’re showing your errand to go-runners nearby. You’ll get a notification when someone accepts.</span></div>`);
          if (pv && s === 'accepted') out.push(btn('buy', 'Mark as ' + statusName(o, 'bought').toLowerCase(), 'btn-primary', o.errand.type === 'print' ? 'printer' : 'receipt'));
          if (pv && s === 'bought') out.push(btn('depart', 'Start delivery', 'btn-primary', 'bike'));
          if (pv && s === 'on_the_way') out.push(btn('deliver', 'Enter hand-off code', 'btn-primary', 'lock'));
        }
        if (o.kind === 'rental') {
          if (pv && s === 'requested') out.push(html`<div class="btn-row">${btn('confirm', 'Accept request', 'btn-primary', 'check')}${btn('decline', 'Decline', 'btn-ghost')}</div>`);
          if (pv && s === 'confirmed') out.push(btn('handover', 'Hand it over', 'btn-primary', 'handshake'));
          if (rq && s === 'in_use') out.push(btn('return', 'Return item', 'btn-primary', 'arrow-left'));
          if (pv && s === 'returned') out.push(html`<div class="btn-row">${btn('close', 'Looks good · close rental', 'btn-primary', 'check')}${btn('report', 'Report damage', 'btn-ghost')}</div>`);
        }
        if (o.kind === 'purchase') {
          if (pv && s === 'requested') out.push(html`<div class="btn-row">${btn('confirm', 'Confirm order', 'btn-primary', 'check')}${btn('decline', 'Decline', 'btn-ghost')}</div>`);
          if (pv && s === 'confirmed') out.push(btn('handover', 'Hand it over', 'btn-primary', 'handshake'));
          if (rq && s === 'unlocked') {
            const ended = o.purchase.expiresAt && o.purchase.expiresAt < U.now();
            out.push(ended ? html`<div class="notice">${UI.ic('clock', { size: 18 })}<span>Your 7-day access ended. <a href="#/listing/${o.listingId}">Buy it to keep</a>.</span></div>`
              : html`<a class="btn btn-primary btn-block btn-lg" href="#/reader/${o.id}">${UI.ic('book-open', { size: 18 })}Open ${l ? l.title.split(' — ')[0] : 'file'}</a>`);
          }
        }
        if (role && ['completed', 'unlocked'].includes(s) && !o.rated[role]) out.push(rateForm(o, role, other));
        if (role && ['completed', 'unlocked'].includes(s) && o.rated[role]) out.push(html`<p class="small muted center">${UI.ic('circle-check', { size: 15 })} You rated this booking. Thanks!</p>`);
        return out.length ? html`<div class="action-area">${out}</div>` : '';
      }

      function rateForm(o, role, other) {
        const tags = TAGS[role === 'requester' ? 'provider' : 'requester'];
        return html`<form class="rate card card-pad" data-form="rate">
          <h2 class="sec-title">Rate ${other.first}</h2>
          <fieldset class="rate-stars"><legend class="sr-only">Stars</legend>
            ${[1, 2, 3, 4, 5].map((n) => html`<label><input type="radio" name="stars" value="${n}" class="sr-only" ${n === 5 ? 'checked' : ''}><span aria-hidden="true">${UI.ic('star', { size: 30 })}</span><span class="sr-only">${n} star${n > 1 ? 's' : ''}</span></label>`)}
          </fieldset>
          <div class="chips wrap">${tags.map((t) => html`<label class="chip chip-check"><input type="checkbox" name="tags" value="${t}" class="sr-only"><span>${t}</span></label>`)}</div>
          <label class="field mt-3"><span class="label">Comment <span class="opt">(optional)</span></span>
            <textarea class="textarea" name="text" rows="2" maxlength="400" placeholder="What went well?"></textarea></label>
          <button class="btn btn-primary btn-block" type="submit">Submit rating</button>
        </form>`;
      }

      function timeline(o) {
        const path = o.kind === 'purchase' && o.purchase.format === 'digital' ? PATH.digital : PATH[o.kind];
        const done = o.timeline;
        const reached = new Set(done.map((t) => t.status));
        const ended = ['cancelled', 'declined'].includes(o.status);
        const upcoming = ended ? [] : path.filter((s) => !reached.has(s) && path.indexOf(s) > path.indexOf(o.status));
        return html`<section class="sec"><h2 class="sec-title">Progress</h2><ol class="timeline">
          ${done.map((t, i) => html`<li class="${i === done.length - 1 && !ended ? 'is-now' : ''}">
            <span class="dot">${UI.ic(t.event === 'report' ? 'flag' : t.status === 'cancelled' || t.status === 'declined' ? 'x' : 'check', { size: 14 })}</span>
            <div class="t-title">${t.event === 'report' ? 'Problem reported' : t.event === 'resolved' ? 'Support replied' : statusName(o, t.status)}</div>
            <div class="t-meta">${U.fmtWhen(t.at)}${t.note ? ' · ' + t.note : ''}</div></li>`)}
          ${upcoming.map((s) => html`<li class="is-next"><span class="dot"></span><div class="t-title">${statusName(o, s)}</div></li>`)}
        </ol></section>`;
      }

      function details(o, role, l) {
        let rows = [];
        if (o.kind === 'errand') {
          const e = o.errand, d = e.details || {};
          if (e.type === 'print') rows = [['File', d.file], ['Print', `${U.plural(Number(d.pages) || 0, 'page')} × ${d.copies || 1}, ${d.color === 'color' ? 'color' : 'B&W'}, ${d.size || 'Short'}${d.staple ? ', stapled' : ''}`]];
          else if (e.type === 'fetch' || e.type === 'deliver') rows = [['Item', d.item]].concat(d.contact ? [['Hand-over by', d.contact]] : []);
          else rows = [['Buy', d.items], ['Item budget', UI.money(o.money.items)]];
          rows = rows.concat([['From', e.from], ['To', e.to], ['Needed by', U.fmtWhen(e.neededBy) + (e.rush ? ' · Rush' : '')]]);
          if (e.note) rows.push(['Note', e.note]);
        } else if (o.kind === 'rental') {
          rows = [['Item', l ? l.title : '—'], ['Days', U.plural(o.rental.days, 'day')], ['Meetup', l ? l.spot : '—']];
          if (o.rental.returnBy) rows.push(['Return by', U.fmtWhen(o.rental.returnBy)]);
        } else {
          rows = [['Item', l ? l.title : '—'], ['Format', o.purchase.format === 'digital' ? 'Digital (PDF)' : o.purchase.format === 'book' ? 'Book' : 'Printed copy'],
            ['Access', o.purchase.access === 'rent7' ? '7 days' : 'Yours to keep']];
          if (o.purchase.format !== 'digital' && l) rows.push(['Meetup', l.spot]);
        }
        return html`<section class="sec"><h2 class="sec-title">Details</h2><div class="card card-pad"><dl class="kv kv-left">
          ${rows.filter((r) => r[1] != null && r[1] !== '').map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}
        </dl>${l ? html`<a class="small" href="#/listing/${l.id}">View listing</a>` : ''}</div></section>`;
      }

      function moneyCard(o, role, other) {
        const m = o.money;
        const provName = role === 'requester' ? (other ? other.first : 'your go-runner') : 'you';
        const stateText = {
          held: [role === 'provider' ? 'Held by Gopher until the hand-off' : 'Held by Gopher', 'info'],
          released: [role === 'provider' ? 'Paid to your wallet' : 'Released to ' + provName, 'ok'],
          refunded: ['Refunded ' + UI.money(m.refund || 0) + ' to GCash', 'gray'],
          due: ['Pay ' + UI.money(m.total) + ' in cash on hand-off', 'warn'],
          paid: ['Paid in cash', 'ok'],
          cancelled: ['Cancelled · nothing to pay', 'gray'],
        }[m.state] || [m.state, 'gray'];
        const items = o.kind === 'errand' ? (o.errand.type === 'print' ? 'Printing (at cost)' : 'Item budget') : '';
        const lines = [
          [o.kind === 'errand' ? 'Errand fee' : o.kind === 'rental' ? 'Rent' : 'Price', m.fee],
          m.rush ? ['Rush', m.rush] : null,
          m.items ? [items, m.items] : null,
          m.deposit ? ['Refundable deposit', m.deposit] : null,
          ['Service fee', m.service],
        ].filter(Boolean);
        const after = [];
        if (o.kind === 'errand' && o.errand.actual != null && m.items && o.errand.type !== 'print') after.push(['Receipt', o.errand.actual]);
        if (m.state === 'released' && m.refund && o.kind === 'errand') after.push(['Unused budget refunded', -m.refund]);
        if (o.kind === 'rental' && m.deposit && o.status === 'completed') after.push(['Deposit refunded', -m.deposit]);
        if (m.cancelFee) after.push(['Cancellation fee to go-runner', m.cancelFee]);
        if (m.supportRefund) after.push(['Refunded by support', -m.supportRefund]);
        return html`<section class="sec"><h2 class="sec-title">Payment</h2><div class="card card-pad">
          <div class="row-between"><span class="row small"><strong>${C.PAYMENT_LABELS[m.method] || m.method}</strong></span><span class="pill pill-${stateText[1]}">${stateText[0]}</span></div>
          <ul class="breakdown mt-2">
            ${lines.map(([k, v]) => html`<li><span>${k}</span><span>${UI.money(v)}</span></li>`)}
            <li class="total"><span>Total</span><span>${UI.money(m.total)}</span></li>
            ${after.map(([k, v]) => html`<li class="sub"><span>${k}</span><span>${UI.money(v)}</span></li>`)}
          </ul>
          ${role === 'provider' ? html`<p class="small mb-0">${UI.ic('hand-coins', { size: 15 })} You earn <strong>${UI.money(S().earning(o))}</strong>${o.kind === 'errand' && m.items ? ' + reimbursement for the receipt' : ''}.</p>` : ''}
        </div></section>`;
      }

      function people(o, role, other) {
        const u = role ? other : S().user(o.requesterId);
        if (!u) return '';
        const label = !role ? 'Requested by' : o.kind === 'errand' ? (role === 'requester' ? 'Your go-runner' : 'Requested by')
          : o.kind === 'rental' ? (role === 'requester' ? 'Lender' : 'Renter') : (role === 'requester' ? 'Seller' : 'Buyer');
        const r = role === 'provider' || !role ? 'requester' : 'provider';
        return html`<section class="sec"><h2 class="sec-title">${label}</h2><div class="card card-pad">${UI.userLine(u, { role: r })}
          <p class="xsmall muted mt-2 mb-0">${UI.ic('badge-check', { size: 13 })} ${UI.verifyNote(u)}</p>
        </div></section>`;
      }

      function ticketCard(o) {
        const t = o.ticketId ? S().ticket(o.ticketId) : null;
        if (!t) return '';
        return html`<section class="sec"><h2 class="sec-title">Support ticket</h2><div class="card card-pad ticket">
          <div class="row-between"><strong>${t.id}</strong><span class="pill ${t.status === 'open' ? 'pill-warn' : 'pill-ok'}">${t.status === 'open' ? 'Open' : 'Resolved'}</span></div>
          <p class="small muted">${t.reason}${t.amount ? ' · ' + UI.money(t.amount) : ''}${t.status === 'open' ? ' · reply by ' + U.fmtWhen(t.replyBy) : ' · resolved ' + U.timeAgo(t.resolvedAt)}</p>
          ${t.messages.map((m) => html`<div class="ticket-msg"><span class="ticket-from">${UI.ic('life-buoy', { size: 14 })}Gopher Support</span><p class="mb-0">${m.text}</p></div>`)}
        </div></section>`;
      }

      function chat(o, meNow, other) {
        if (!o.chat.length) return html`<p class="chat-empty">Say hi to ${other.first} 👋</p>`;
        return html`${o.chat.map((m) => {
          if (m.from === 'system') return html`<p class="bubble-sys">${m.text}</p>`;
          const mine = m.from === meNow.id;
          const u = S().user(m.from);
          return html`<div class="bubble-row ${mine ? 'is-mine' : ''}">
            ${mine ? '' : UI.avatar(u, 28)}
            <div class="bubble"><span class="bubble-text">${m.text}</span><span class="bubble-time">${U.fmtTime(m.at)}</span></div>
          </div>`;
        })}`;
      }
      function quick(o, role) {
        const list = role === 'provider' ? ['On my way!', 'I’m here.', 'Receipt sent 🧾'] : ['Thank you!', 'Where are you?', 'I’m at the spot.'];
        return html`${list.map((q) => html`<button type="button" class="chip" data-quick="${q}">${q}</button>`)}`;
      }
      function isChatAtBottom() {
        const v = document.getElementById('view');
        return !v || v.scrollHeight - v.scrollTop - v.clientHeight < 160;
      }
      function scrollChat() { /* the chat is part of the page; keep the page where it is */ }

      function more(o, role, meNow) {
        if (!role) return '';
        const ci = S().cancelInfo(o, meNow.id);
        const canReport = !['open', 'requested', 'cancelled', 'declined'].includes(o.status) && !(o.ticketId && S().ticket(o.ticketId));
        return html`<div class="more-actions">
          ${ci.allowed ? html`<button type="button" class="btn btn-danger btn-block" data-action="cancel">${UI.ic('x', { size: 16 })}Cancel booking${ci.fee ? ' (' + UI.money(ci.fee) + ' fee)' : ' (free)'}</button>` : ''}
          ${canReport && o.kind !== 'rental' || (canReport && o.kind === 'rental' && role === 'requester') ? html`<button type="button" class="btn btn-ghost btn-block" data-action="report">${UI.ic('flag', { size: 16 })}Report a problem</button>` : ''}
          <a class="btn btn-ghost btn-block" href="help.html#safety">${UI.ic('life-buoy', { size: 16 })}Help & safety tips</a>
        </div>`;
      }

      // ---- actions ----------------------------------------------------------------------------
      async function run(action, data) {
        try {
          await G.store.act(id, action, data || {}, S().me().id);
          return true;
        } catch (e) {
          if (e.code === 'BAD_CODE') throw e;
          UI.errorToast(e);
          return false;
        }
      }
      function codeSheet(title, text, code, hintWho, extra) {
        return UI.sheet({
          title,
          body: html`<p class="sheet-text">${text}</p>${extra || ''}
            <form data-form="code" novalidate>
              <label class="field"><span class="label">4-digit code</span>
                <input class="input code-input" id="sheet-code" name="code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" autofocus></label>
              ${UI.demoHint(`Demo: ${hintWho}’s code is ${code} (tap to fill)`, code, 'sheet-code')}
              <p class="error-text" data-error hidden></p>
              <div class="sheet-actions"><button class="btn btn-primary btn-block btn-lg" type="submit">Confirm</button></div>
            </form>`,
        });
      }
      function wireCode(sheetApi, action, precheck) {
        const el = sheetApi.el;
        el.addEventListener('click', (e) => {
          const h = e.target.closest('.demo-hint');
          if (h) { const t = el.querySelector('#' + h.dataset.target); t.value = h.dataset.fill; t.focus(); }
        });
        el.querySelector('form[data-form="code"]').addEventListener('submit', async (e) => {
          e.preventDefault();
          const errEl = el.querySelector('[data-error]');
          if (precheck) {
            const msg = precheck(el);
            if (msg) { errEl.textContent = msg; errEl.hidden = false; return; }
          }
          try {
            await G.store.act(id, action, { code: el.querySelector('#sheet-code').value }, S().me().id);
            sheetApi.close();
            const o = S().order(id);
            UI.toast(action === 'deliver' ? 'Delivered! Payment released to your wallet.' : action === 'handover' ? (o.kind === 'rental' ? 'Handed over. The rental has started.' : 'Handed over. Sale complete!') : 'Returned. The lender will check it.', { icon: 'circle-check' });
          } catch (err) {
            errEl.textContent = err.message; errEl.hidden = false;
          }
        });
      }

      ctx.on('click', '[data-action]', async (e, el) => {
        const action = el.dataset.action;
        const o = S().order(id);
        const meNow = S().me();
        const other = S().user(S().otherParty(o, meNow.id));
        const l = o.listingId ? S().listing(o.listingId) : null;
        if (action === 'next') { G.sim.next(id); return; }
        if (action === 'accept') {
          try {
            if (!meNow.online) await G.store.updateMe({ online: true });
          } catch (err) { UI.errorToast(err); return; }
          if (await run('accept')) UI.toast(`Job accepted! Head to ${o.errand.from}.`, { icon: 'bike' });
          return;
        }
        if (action === 'buy') {
          const t = o.errand.type;
          const needsAmount = t !== 'fetch' && t !== 'deliver';
          const suggest = t === 'print' ? o.money.items : Math.round((o.money.items || 0) * 0.9);
          const s = UI.sheet({
            title: t === 'print' ? 'Printed?' : needsAmount ? 'Bought everything?' : 'Picked it up?',
            body: html`${needsAmount ? html`<p class="sheet-text">Enter the amount on the receipt. You’ll be reimbursed from ${other.first}’s prepaid ${t === 'print' ? 'printing cost' : 'budget'}.</p>
              <label class="field"><span class="label">Receipt amount</span><span class="input-group"><span class="prefix">₱</span>
                <input class="input" type="number" name="actual" min="0" max="${o.money.items}" value="${suggest}" inputmode="numeric"></span>
                ${t !== 'print' ? html`<span class="hint" data-left>${UI.money(Math.max(0, o.money.items - suggest))} of the budget goes back to ${other.first}.</span>` : ''}</label>
              <label class="check"><input type="checkbox" name="receipt" checked><span>Attach receipt photo <span class="muted">(demo sample)</span></span></label>`
              : html`<p class="sheet-text">Let ${other.first} know you have it.</p>`}
              <div class="sheet-actions"><button class="btn btn-primary btn-block btn-lg" type="button" data-ok>Confirm</button></div>`,
            onMount(sel, close) {
              const inp = sel.querySelector('input[name="actual"]');
              if (inp) inp.addEventListener('input', () => {
                const left = sel.querySelector('[data-left]');
                if (left) left.textContent = UI.money(Math.max(0, o.money.items - (Number(inp.value) || 0))) + ' of the budget goes back to ' + other.first + '.';
              });
              sel.querySelector('[data-ok]').addEventListener('click', async () => {
                const actual = inp ? Math.max(0, Math.min(o.money.items, Math.round(Number(inp.value) || 0))) : 0;
                close();
                if (await run('buy', { actual })) UI.toast(`Marked as ${statusName(o, 'bought').toLowerCase()}.`, { icon: 'receipt' });
              });
            },
          });
          return s;
        }
        if (action === 'depart') { if (await run('depart')) UI.toast(`On your way to ${o.errand.to}.`, { icon: 'bike' }); return; }
        if (action === 'deliver') {
          wireCode(codeSheet('Hand-off code', `Ask ${other.first} for their 4-digit code when you hand over the items at ${o.errand.to}.`, o.code, other.first), 'deliver');
          return;
        }
        if (action === 'confirm') { if (await run('confirm')) UI.toast(o.kind === 'rental' ? 'Request accepted. Meet at ' + l.spot + '.' : 'Order confirmed.', { icon: 'check' }); return; }
        if (action === 'decline') {
          if (await UI.confirm({ title: 'Decline this request?', text: `${other.first} gets a full refund.`, ok: 'Decline', danger: true })) await run('decline');
          return;
        }
        if (action === 'handover') {
          const checklist = o.kind === 'rental' ? html`<fieldset class="checklist"><legend class="label">Check it together</legend>
            <label class="check"><input type="checkbox" name="c1" checked><span>It works</span></label>
            <label class="check"><input type="checkbox" name="c2" checked><span>All parts are included</span></label>
            <label class="check"><input type="checkbox" name="c3" checked><span>Condition photo taken <span class="muted">(demo sample)</span></span></label></fieldset>` : '';
          const sh = codeSheet(o.kind === 'rental' ? 'Hand over the item' : 'Hand it over', `Meet ${other.first} at the ${l.spot}. Enter their code to confirm the hand-off.`, o.code, other.first, checklist);
          wireCode(sh, 'handover', (el2) => (o.kind === 'rental' && el2.querySelectorAll('.checklist input:checked').length < 3 ? 'Check the item together first.' : ''));
          return;
        }
        if (action === 'return') {
          wireCode(codeSheet('Return the item', `Meet ${other.first} at the ${l.spot}. Enter the return code they show you.`, o.returnCode, other.first), 'return');
          return;
        }
        if (action === 'close') {
          if (await UI.confirm({ title: 'Everything okay?', text: o.money.deposit ? `${other.first} gets the ${UI.money(o.money.deposit)} deposit back and you get paid.` : 'You’ll get paid and the rental closes.', ok: 'Looks good' })) {
            if (await run('close')) UI.toast('Rental closed. Payment released to your wallet.', { icon: 'hand-coins' });
          }
          return;
        }
        if (action === 'cancel') {
          const ci = S().cancelInfo(o, meNow.id);
          const text = ci.cash ? 'Nothing was paid, so there’s nothing to refund.'
            : ci.fee ? `${UI.money(ci.fee)} goes to ${other ? other.first : 'your go-runner'} for their time. ${UI.money(ci.refund)} goes back to your GCash.`
              : `You get the full ${UI.money(ci.refund)} back to your GCash.`;
          if (await UI.confirm({ title: 'Cancel this booking?', text, ok: 'Cancel booking', cancel: 'Keep it', danger: true })) {
            if (await run('cancel')) UI.toast('Booking cancelled.', { icon: 'circle-check' });
          }
          return;
        }
        if (action === 'report') {
          UI.sheet({
            title: 'Report a problem',
            body: html`<p class="sheet-text">We pause the payout while we look into it, and reply within 24 hours.</p>
              <form data-form="report" novalidate>
                <fieldset class="checklist"><legend class="label">What happened?</legend>
                ${REPORT.map((r, i) => html`<label class="check"><input type="radio" name="reason" value="${r}" ${i === 0 ? 'checked' : ''}><span>${r}</span></label>`)}</fieldset>
                <label class="field"><span class="label">Amount to refund <span class="opt">(optional)</span></span>
                  <span class="input-group"><span class="prefix">₱</span><input class="input" type="number" name="amount" min="0" max="${o.money.total}" inputmode="numeric" placeholder="0"></span></label>
                <label class="field"><span class="label">Details</span><textarea class="textarea" name="detail" rows="3" maxlength="500" placeholder="e.g. One of the two iced teas was missing."></textarea></label>
                <button type="button" class="btn btn-dashed btn-sm" data-sample>${UI.ic('sparkles', { size: 14 })} Use sample</button>
                <div class="sheet-actions"><button class="btn btn-primary btn-block btn-lg" type="submit">Send report</button></div>
              </form>`,
            onMount(sel, close) {
              sel.querySelector('[data-sample]').addEventListener('click', () => {
                sel.querySelector('input[name="amount"]').value = o.kind === 'errand' && o.errand.type === 'food' ? 25 : '';
                sel.querySelector('textarea[name="detail"]').value = o.kind === 'errand' && o.errand.type === 'food' ? 'One of the two iced teas was missing.' : 'The item had a crack when I got it.';
              });
              sel.querySelector('form').addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const d = U.formData(ev.target);
                try {
                  const t = await G.store.report(id, { reason: d.reason, detail: d.detail, amount: d.amount });
                  close();
                  UI.toast(`Ticket ${t.id} created. We’ll reply within 24 hours.`, { icon: 'life-buoy' });
                } catch (err) { UI.errorToast(err); }
              });
            },
          });
        }
      });

      ctx.on('submit', 'form[data-form="rate"]', async (e, form) => {
        e.preventDefault();
        const d = U.formData(form);
        try {
          await G.store.review(id, { stars: d.stars, text: d.text, tags: [].concat(d.tags || []) }, S().me().id);
          UI.toast('Thanks for rating!', { icon: 'star' });
        } catch (err) { UI.errorToast(err); }
      });
      ctx.on('change', 'form[data-form="rate"] input[name="stars"]', (e, el) => {
        const n = Number(el.value);
        ctx.root.querySelectorAll('.rate-stars label').forEach((lab, i) => lab.classList.toggle('on', i < n));
      });
      ctx.on('submit', 'form[data-form="chat"]', async (e, form) => {
        e.preventDefault();
        const input = form.querySelector('input[name="text"]');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try { await G.store.sendMessage(id, text, S().me().id); } catch (err) { UI.errorToast(err); }
      });
      ctx.on('click', '[data-quick]', async (e, el) => {
        try { await G.store.sendMessage(id, el.dataset.quick, S().me().id); } catch (err) { UI.errorToast(err); }
      });

      draw();
      // initial star highlight
      ctx.root.querySelectorAll('.rate-stars label').forEach((lab) => lab.classList.add('on'));
      ctx.watch(() => {
        draw();
        ctx.root.querySelectorAll('.rate-stars label').forEach((lab, i) => {
          const checked = ctx.root.querySelector('.rate-stars input:checked');
          lab.classList.toggle('on', i < (checked ? Number(checked.value) : 5));
        });
      });
      ctx.interval(drawNext, 1000);
    },
  };
})(window.Gopher = window.Gopher || {});
