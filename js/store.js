/* Gopher — the data layer. The ONLY file that reads or writes saved data.
 *
 * Screens call the async functions on G.store (they return promises, the same
 * shape a real backend would have). A later Firebase/Supabase version can
 * provide the same functions and no screen has to change.
 *
 * The simulator and tests use G.store.sync (same functions, synchronous, and
 * able to act as another user).
 */
(function (G) {
  'use strict';
  const C = G.config, U = G.util;
  const PHOTO_PREFIX = 'gopher.photo.';

  let state = null;
  let memoryOnly = false;
  let key = C.STORAGE_KEY;
  const photoCache = new Map();
  const listeners = new Set();

  // ---- persistence ---------------------------------------------------------
  function storageOk() {
    try {
      const k = '__gopher_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }
  const isQuota = (e) => e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

  function readSaved() {
    if (memoryOnly) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === C.VERSION ? s : null;
    } catch (e) { return null; }
  }

  function save() {
    if (memoryOnly) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      if (isQuota(e)) {
        // Trim what we can lose (old read notifications), then try once more.
        state.notifs = state.notifs.filter((n) => !n.read).concat(state.notifs.filter((n) => n.read).slice(-30));
        try { localStorage.setItem(key, JSON.stringify(state)); return; } catch (e2) { /* fall through */ }
        emit({ type: 'quota' });
      } else {
        memoryOnly = true;
        emit({ type: 'storage-blocked' });
      }
    }
  }

  function emit(evt) {
    listeners.forEach((fn) => {
      try { fn(evt); } catch (err) { console.error(err); }
    });
  }
  function commit(evt) {
    save();
    emit(evt || { type: 'change' });
  }

  // Other tabs changed the data: pick it up.
  window.addEventListener('storage', (e) => {
    if (e.key !== key || !e.newValue) return;
    try {
      const s = JSON.parse(e.newValue);
      if (s && s.v === C.VERSION) {
        const epochChanged = !state || s.createdAt !== state.createdAt;
        state = s;
        emit({ type: epochChanged ? 'reset' : 'remote' });
      }
    } catch (err) { /* ignore */ }
  });

  // ---- helpers ---------------------------------------------------------------
  const now = () => U.now();
  const rngFor = (salt) => U.rng((state.seed || 1) + (salt || 0) + state.seq);
  function nextSeq() { state.seq += 1; return state.seq; }
  function newId(prefix) { return prefix + '_' + nextSeq().toString(36) + Math.floor(rngFor(7)() * 1e6).toString(36); }
  function newCode() { return String(1000 + Math.floor(rngFor(13)() * 9000)); }
  function err(code, message) { const e = new Error(message); e.code = code; return e; }

  function mustUser(id) {
    const u = state.users[id];
    if (!u) throw err('NOT_FOUND', 'That student could not be found.');
    return u;
  }
  function mustOrder(id) {
    const o = state.orders[id];
    if (!o) throw err('NOT_FOUND', 'That booking no longer exists (the demo may have been reset).');
    return o;
  }
  const shortName = (u) => (u ? u.first + ' ' + (u.last ? u.last[0] + '.' : '') : 'Someone').trim();
  const firstName = (u) => (u ? u.first : 'Someone');
  const roleOf = (o, uid) => (o.requesterId === uid ? 'requester' : o.providerId === uid ? 'provider' : null);
  const otherParty = (o, uid) => (o.requesterId === uid ? o.providerId : o.requesterId);

  function notify(userId, text, href) {
    if (!userId) return;
    state.notifs.push({ id: newId('nt'), userId, text, href: href || '', at: now(), read: false });
  }
  function addTx(userId, label, amount, orderId) {
    const u = state.users[userId];
    if (!u || !amount) return;
    u.wallet.available = Math.round((u.wallet.available + amount) * 100) / 100;
    u.wallet.tx.unshift({ id: newId('tx'), label, amount, at: now(), orderId: orderId || null });
  }

  // ---- ratings ----------------------------------------------------------------------
  function ratingOf(userId, role) {
    const u = state.users[userId];
    const r = u && u.ratings && u.ratings[role || 'provider'];
    if (!r || !r.count) return { avg: 0, count: 0 };
    return { avg: Math.round((r.sum / r.count) * 10) / 10, count: r.count };
  }
  function listingRating(listingId) {
    const rs = state.reviews.filter((r) => r.listingId === listingId);
    if (!rs.length) return { avg: 0, count: 0 };
    return { avg: Math.round((rs.reduce((s, r) => s + r.stars, 0) / rs.length) * 10) / 10, count: rs.length };
  }

  // ---- quotes (pure pricing) -----------------------------------------------------------
  function printCost(d) {
    const pages = Math.max(0, parseInt(d.pages, 10) || 0), copies = Math.max(1, parseInt(d.copies, 10) || 1);
    return pages * copies * (d.color === 'color' ? C.PRINT_COST.color : C.PRINT_COST.bw);
  }
  // draft = { kind:'errand', input:{ type, fee, rush, details, budget } }
  //       | { kind:'rental', input:{ listingId, days } }
  //       | { kind:'purchase', input:{ listingId, access:'keep'|'rent7' } }
  function quote(draft) {
    const q = { fee: 0, rush: 0, items: 0, deposit: 0, service: C.SERVICE_FEE, total: 0, lines: [], digital: false, itemsLabel: '' };
    const inp = draft.input || {};
    if (draft.kind === 'errand') {
      const t = C.ERRAND_TYPES[inp.type] || C.ERRAND_TYPES.print;
      q.fee = Math.max(t.fee, Math.round(Number(inp.fee) || t.fee));
      q.rush = inp.rush ? C.RUSH_FEE : 0;
      if (inp.type === 'print') { q.items = printCost(inp.details || {}); q.itemsLabel = 'Printing (at cost)'; }
      else if (['food', 'supplies', 'medicine'].includes(inp.type)) { q.items = Math.max(0, Math.round(Number(inp.budget) || 0)); q.itemsLabel = 'Item budget (unused part refunded)'; }
      q.lines.push(['Errand fee (to your go-runner)', q.fee]);
      if (q.rush) q.lines.push(['Rush (within 30 min)', q.rush]);
      if (q.items) q.lines.push([q.itemsLabel, q.items]);
    } else {
      const l = state.listings[inp.listingId];
      if (!l) throw err('NOT_FOUND', 'That listing is no longer available.');
      if (draft.kind === 'rental') {
        const days = Math.max(1, parseInt(inp.days, 10) || 1);
        const per = l.rent ? l.rent.per : 'day';
        const units = per === 'week' ? Math.ceil(days / 7) : days;
        q.fee = (l.rent ? l.rent.price : 0) * units;
        q.deposit = l.deposit || 0;
        q.lines.push([per === 'week' ? `Rent (${U.plural(units, 'week')})` : `Rent (${U.plural(days, 'day')} × ${U.peso(l.rent.price)})`, q.fee]);
        if (q.deposit) q.lines.push(['Refundable deposit', q.deposit]);
      } else {
        const rent7 = inp.access === 'rent7' && l.rent && l.rent.per === '7 days';
        q.fee = rent7 ? l.rent.price : l.buy;
        q.digital = l.format === 'digital';
        q.lines.push([rent7 ? 'Rent for 7 days' : 'Price', q.fee]);
      }
    }
    q.lines.push(['Service fee', q.service]);
    q.total = q.fee + q.rush + q.items + q.deposit + q.service;
    return q;
  }

  // Which payment methods are allowed for this quote, with the reason when not.
  function payOptions(q) {
    return C.PAYMENT_METHODS.map((m) => {
      if (m !== 'cash') return { method: m, ok: true, reason: '' };
      if (q.deposit) return { method: m, ok: false, reason: 'Items with a deposit need GCash.' };
      if (q.digital) return { method: m, ok: false, reason: 'Digital items need GCash.' };
      if (q.total > C.CASH_MAX) return { method: m, ok: false, reason: `Cash is only for totals up to ${U.peso(C.CASH_MAX)}.` };
      return { method: m, ok: true, reason: '' };
    });
  }

  // ---- cancellation rules ------------------------------------------------------------------
  function cancelInfo(o, uid) {
    const flow = C.FLOW[o.kind].cancel;
    if (roleOf(o, uid) !== 'requester') return { allowed: false, reason: 'Only the student who booked can cancel.' };
    if (!flow.from.includes(o.status)) {
      return { allowed: false, reason: o.kind === 'errand' && ['bought', 'on_the_way'].includes(o.status)
        ? 'Your go-runner already bought or printed your items, so this can’t be cancelled. Report a problem instead.'
        : 'This booking can no longer be cancelled.' };
    }
    let fee = 0;
    if (o.kind === 'errand' && o.status === 'accepted') fee = C.ERRAND_CANCEL_FEE;
    const paid = o.money.method === 'gcash';
    return { allowed: true, fee: paid ? fee : 0, refund: paid ? o.money.total - fee : 0, cash: !paid };
  }

  // ---- the state machine --------------------------------------------------------------------
  const errandDoneLabel = (o) => (C.ERRAND_TYPES[o.errand.type] || {}).doneLabel || 'Bought';

  // act(orderId, action, data, actorId) — the only way an order's status changes.
  function act(orderId, action, data, actorId) {
    data = data || {};
    const o = mustOrder(orderId);
    const flow = C.FLOW[o.kind] && C.FLOW[o.kind][action];
    if (!flow) throw err('INVALID', 'That action isn’t possible here.');
    if (data.expect && data.expect !== o.status) return o; // someone else already moved it (idempotent)
    if (!flow.from.includes(o.status)) throw err('CONFLICT', 'This booking has already moved on. Refresh to see the latest.');
    const actor = mustUser(actorId);

    // who may do it
    if (action === 'accept') {
      if (o.requesterId === actorId) throw err('FORBIDDEN', 'You can’t take your own errand.');
      requireVerified(actorId);
    } else if (roleOf(o, actorId) !== flow.by) {
      throw err('FORBIDDEN', 'It’s the other student’s turn.');
    }
    // hand-off codes: the human must type the other student's code (the simulator knows it)
    if (flow.code && actorId === state.meId && !data.skipCode) {
      if (String(data.code || '').trim() !== String(o[flow.code])) throw err('BAD_CODE', 'That code doesn’t match. Ask the other student to show their code again.');
    }

    const from = o.status;
    const req = state.users[o.requesterId];
    let prov = state.users[o.providerId];
    let note = '';
    const href = '#/order/' + o.id;

    if (o.kind === 'errand') {
      if (action === 'accept') {
        o.providerId = actorId; prov = actor;
        note = shortName(actor) + ' accepted';
        notify(o.requesterId, `${shortName(actor)} accepted your ${o.errand.title} errand.`, href);
      } else if (action === 'buy') {
        const t = o.errand.type;
        let actual = data.actual != null ? Math.max(0, Math.round(Number(data.actual) || 0)) : o.money.items;
        if (['food', 'supplies', 'medicine'].includes(t)) actual = Math.min(actual, o.money.items || actual);
        o.errand.actual = actual;
        note = actual ? 'Receipt ' + U.peso(actual) : '';
        notify(o.requesterId, `${errandDoneLabel(o)}: ${o.errand.title}${actual ? ' (receipt ' + U.peso(actual) + ')' : ''}.`, href);
      } else if (action === 'depart') {
        note = 'Heading to ' + o.errand.to;
        notify(o.requesterId, `${firstName(prov)} is on the way to ${o.errand.to}. Have your hand-off code ready.`, href);
      } else if (action === 'deliver') {
        note = 'Hand-off code confirmed';
        settle(o);
        notify(o.requesterId, `Delivered! Rate ${firstName(prov)} for your ${o.errand.title} errand.`, href);
        notify(o.providerId, `You earned ${U.peso(earning(o))} from ${o.id}.`, '#/wallet');
      } else if (action === 'cancel') {
        const info = cancelInfo(o, actorId);
        o.money.cancelFee = info.fee;
        refund(o, info.fee);
        note = 'Cancelled by ' + shortName(actor) + (info.fee ? ` · ${U.peso(info.fee)} to your go-runner` : '');
        if (o.providerId) notify(o.providerId, `${shortName(req)} cancelled ${o.id}.${info.fee ? ' You get ' + U.peso(info.fee) + '.' : ''}`, href);
      }
    } else if (o.kind === 'rental') {
      const l = state.listings[o.listingId] || {};
      if (action === 'confirm') {
        note = 'Meet at ' + (l.spot || 'the meetup spot');
        notify(o.requesterId, `${shortName(prov)} confirmed your rental: meet at ${l.spot}.`, href);
      } else if (action === 'decline') {
        refund(o, 0);
        note = 'Declined · full refund';
        notify(o.requesterId, `${shortName(prov)} can’t lend ${l.title} this time. You got a full refund.`, href);
      } else if (action === 'handover') {
        o.rental.start = now();
        o.rental.returnBy = now() + o.rental.days * U.DAY;
        note = 'Picked up · return by ' + U.fmtWhen(o.rental.returnBy);
        notify(o.requesterId, `Enjoy the ${l.title}! Return it by ${U.fmtWhen(o.rental.returnBy)}.`, href);
      } else if (action === 'return') {
        note = 'Returned · ' + firstName(prov) + ' is checking it';
        notify(o.providerId, `${shortName(req)} returned your ${l.title}. Check it and close the rental.`, href);
      } else if (action === 'close') {
        settle(o);
        note = o.money.deposit ? `Looks good · ${U.peso(o.money.deposit)} deposit refunded` : 'Looks good';
        notify(o.requesterId, `${shortName(prov)} checked the ${l.title}.${o.money.deposit ? ' Your ' + U.peso(o.money.deposit) + ' deposit was refunded.' : ''} Rate them?`, href);
        notify(o.providerId, `You earned ${U.peso(earning(o))} from ${o.id}.`, '#/wallet');
      } else if (action === 'cancel') {
        refund(o, 0);
        note = 'Cancelled by ' + shortName(actor) + ' · full refund';
        notify(o.providerId, `${shortName(req)} cancelled their rental of ${l.title}.`, href);
      }
    } else if (o.kind === 'purchase') {
      const l = state.listings[o.listingId] || {};
      if (action === 'confirm') {
        note = 'Meet at ' + (l.spot || 'the meetup spot');
        notify(o.requesterId, `${shortName(prov)} confirmed your order: meet at ${l.spot}.`, href);
      } else if (action === 'decline') {
        refund(o, 0);
        note = 'Declined · full refund';
        notify(o.requesterId, `${shortName(prov)} declined your order. You got a full refund.`, href);
      } else if (action === 'handover') {
        settle(o);
        note = 'Handed over · code confirmed';
        notify(o.requesterId, `You got ${l.title}. Rate ${firstName(prov)}?`, href);
        notify(o.providerId, `You earned ${U.peso(earning(o))} from ${o.id}.`, '#/wallet');
      } else if (action === 'cancel') {
        refund(o, 0);
        note = 'Cancelled · full refund';
        notify(o.providerId, `${shortName(req)} cancelled their order.`, href);
      }
    }

    o.status = flow.to;
    o.statusAt = now();
    o.timeline.push({ status: o.status, at: o.statusAt, note, by: actorId, from });
    commit({ type: 'order', id: o.id, action, actorId });
    return o;
  }

  function earning(o) {
    const base = o.kind === 'errand' ? o.money.fee + o.money.rush : o.money.fee;
    return Math.round(base * (1 - C.COMMISSION));
  }
  // Money moves when a booking completes.
  function settle(o) {
    const m = o.money;
    const earn = earning(o);
    if (m.method === 'gcash') {
      m.state = 'released';
      addTx(o.providerId, (o.kind === 'errand' ? 'Errand fee · ' : o.kind === 'rental' ? 'Rental · ' : 'Sale · ') + o.id, earn, o.id);
      if (o.kind === 'errand' && o.errand.actual) {
        addTx(o.providerId, 'Reimbursed ' + (o.errand.type === 'print' ? 'printing' : 'items') + ' · ' + o.id, o.errand.actual, o.id);
        const unused = (m.items || 0) - o.errand.actual;
        if (unused > 0) m.refund = unused;
      }
    } else {
      m.state = 'paid';
      addTx(o.providerId, 'Gopher service fee (cash job) · ' + o.id, -m.service, o.id);
    }
    const p = state.users[o.providerId];
    if (p) {
      if (o.kind === 'errand') p.stats.jobs += 1;
      else if (o.kind === 'rental') p.stats.lent += 1;
      else p.stats.sold += 1;
    }
  }
  function refund(o, keepFee) {
    const m = o.money;
    if (m.method === 'gcash') {
      m.state = 'refunded';
      m.refund = m.total - (keepFee || 0);
      if (keepFee) addTx(o.providerId, 'Cancellation fee · ' + o.id, keepFee, o.id);
    } else {
      m.state = 'cancelled';
    }
  }

  // ---- creating orders (checkout) ----------------------------------------------------------------
  function createDraft(kind, input, uid) {
    const id = newId('dr');
    state.drafts[id] = { id, kind, input, userId: uid || state.meId, createdAt: now() };
    commit({ type: 'draft', id });
    return id;
  }
  function getDraft(id) {
    const d = state.drafts[id];
    if (!d || d.userId !== state.meId) throw err('NOT_FOUND', 'This checkout expired. Start again.');
    return d;
  }

  function pay(draftId, method, uid) {
    uid = uid || state.meId;
    const d = state.drafts[draftId];
    if (!d) throw err('NOT_FOUND', 'This checkout expired. Start again.');
    if (d.orderId) return state.orders[d.orderId]; // paying twice returns the same booking
    requireVerified(uid);
    const q = quote(d);
    const opt = payOptions(q).find((p) => p.method === method);
    if (!opt || !opt.ok) throw err('INVALID', (opt && opt.reason) || 'Choose a payment method.');
    const inp = d.input;
    const id = 'GPH-' + nextSeq();
    const money = { fee: q.fee, rush: q.rush, items: q.items, deposit: q.deposit, service: q.service, total: q.total, method,
      state: method === 'gcash' ? 'held' : 'due' };
    const base = { id, kind: d.kind, requesterId: uid, providerId: null, listingId: null, createdAt: now(), statusAt: now(),
      errand: null, rental: null, purchase: null, money, code: newCode(), returnCode: '', timeline: [], chat: [],
      rated: { requester: false, provider: false }, ticketId: null };
    const req = state.users[uid];
    let o;
    if (d.kind === 'errand') {
      const t = C.ERRAND_TYPES[inp.type];
      o = Object.assign(base, {
        status: 'open',
        errand: { type: inp.type, title: inp.title || t.label, details: inp.details || {}, from: inp.from, to: inp.to,
          neededBy: inp.neededBy || now() + 60 * U.MIN, rush: !!inp.rush, budget: q.items, actual: null, note: inp.note || '' },
      });
      o.timeline.push({ status: 'open', at: now(), note: method === 'gcash' ? U.peso(q.total) + ' held by Gopher' : 'Pay ' + U.peso(q.total) + ' in cash on hand-off' });
    } else {
      const l = state.listings[inp.listingId];
      if (l.ownerId === uid) throw err('INVALID', 'This is your own listing.');
      Object.assign(base, { listingId: l.id, providerId: l.ownerId });
      if (d.kind === 'rental') {
        const days = Math.max(1, parseInt(inp.days, 10) || 1);
        o = Object.assign(base, { status: 'requested', rental: { start: null, days, returnBy: null, pickupAt: inp.pickupAt || null }, returnCode: newCode() });
        o.timeline.push({ status: 'requested', at: now(), note: method === 'gcash' ? U.peso(q.total) + ' held by Gopher' : 'Pay in cash at pickup' });
        notify(l.ownerId, `${shortName(req)} wants to rent your ${l.title} (${U.plural(days, 'day')}).`, '#/order/' + id);
      } else if (l.format === 'digital') {
        const rent7 = inp.access === 'rent7';
        o = Object.assign(base, { status: 'unlocked', purchase: { format: 'digital', access: rent7 ? 'rent7' : 'keep', expiresAt: rent7 ? now() + 7 * U.DAY : null } });
        o.timeline.push({ status: 'unlocked', at: now(), note: 'Paid with GCash · access unlocked' });
        settle(o);
        notify(l.ownerId, `${shortName(req)} bought your ${l.title}. You earned ${U.peso(earning(o))}.`, '#/wallet');
      } else {
        o = Object.assign(base, { status: 'requested', purchase: { format: l.format, access: 'keep', expiresAt: null } });
        o.timeline.push({ status: 'requested', at: now(), note: method === 'gcash' ? U.peso(q.total) + ' held by Gopher' : 'Pay in cash at the meetup' });
        notify(l.ownerId, `${shortName(req)} wants to buy your ${l.title}.`, '#/order/' + id);
      }
    }
    state.orders[id] = o;
    d.orderId = id;
    commit({ type: 'order', id, action: 'create' });
    return o;
  }

  // ---- chat, reviews, reports --------------------------------------------------------------------
  function sendMessage(orderId, text, uid) {
    uid = uid || state.meId;
    const o = mustOrder(orderId);
    if (!roleOf(o, uid)) throw err('FORBIDDEN', 'Only the two students in this booking can chat.');
    const t = String(text || '').trim().slice(0, 500);
    if (!t) return o;
    o.chat.push({ id: newId('m'), from: uid, text: t, at: now() });
    const to = otherParty(o, uid);
    if (to && to !== state.meId) { /* simulated student; sim.js replies */ } else if (to) {
      notify(to, `${firstName(state.users[uid])}: “${t.length > 60 ? t.slice(0, 57) + '…' : t}”`, '#/order/' + o.id);
    }
    commit({ type: 'chat', id: o.id });
    return o;
  }

  function review(orderId, input, uid) {
    uid = uid || state.meId;
    const o = mustOrder(orderId);
    const role = roleOf(o, uid);
    if (!role) throw err('FORBIDDEN', 'Only the students in this booking can review it.');
    if (!['completed', 'unlocked'].includes(o.status)) throw err('INVALID', 'You can rate once the booking is done.');
    if (o.rated[role]) throw err('CONFLICT', 'You already rated this booking.');
    const stars = U.clamp(parseInt(input.stars, 10) || 0, 1, 5);
    const toId = otherParty(o, uid);
    const targetRole = role === 'requester' ? 'provider' : 'requester';
    state.reviews.push({ id: newId('rv'), orderId, fromId: uid, toId, role: targetRole, stars,
      text: String(input.text || '').trim().slice(0, 400), tags: (input.tags || []).slice(0, 4), at: now(),
      listingId: targetRole === 'provider' ? o.listingId : null });
    const r = state.users[toId].ratings[targetRole];
    r.sum += stars; r.count += 1;
    o.rated[role] = true;
    if (toId === state.meId) notify(toId, `${shortName(state.users[uid])} rated you ${stars} star${stars === 1 ? '' : 's'}.`, '#/profile');
    commit({ type: 'review', id: o.id });
    return o;
  }

  function report(orderId, input, uid) {
    uid = uid || state.meId;
    const o = mustOrder(orderId);
    if (!roleOf(o, uid)) throw err('FORBIDDEN', 'Only the students in this booking can report it.');
    if (o.ticketId && state.tickets[o.ticketId] && state.tickets[o.ticketId].status === 'open') return state.tickets[o.ticketId];
    const id = 'GPH-S-' + (2040 + Object.keys(state.tickets).length + 1);
    const t = { id, orderId, userId: uid, reason: input.reason, detail: String(input.detail || '').trim().slice(0, 500),
      amount: Math.max(0, Math.round(Number(input.amount) || 0)), status: 'open', createdAt: now(), replyBy: now() + U.DAY,
      messages: [{ from: 'support', text: 'Thanks for reporting this. We’ve paused the payout for this booking while we look into it.', at: now() }] };
    state.tickets[id] = t;
    o.ticketId = id;
    o.timeline.push({ status: o.status, at: now(), note: 'Problem reported · ticket ' + id, by: uid, from: o.status, event: 'report' });
    notify(uid, `We got your report (${id}). We’ll reply by ${U.fmtWhen(t.replyBy)}.`, '#/order/' + o.id);
    commit({ type: 'ticket', id: o.id });
    return t;
  }

  function resolveTicket(ticketId) {
    const t = state.tickets[ticketId];
    if (!t || t.status !== 'open') return t;
    const o = state.orders[t.orderId];
    const prov = o && state.users[o.providerId];
    t.status = 'resolved';
    t.resolvedAt = now();
    const amt = t.amount;
    t.messages.push({ from: 'support', at: now(), text: amt
      ? `Hi! This is Joy from Gopher Support. ${firstName(prov)} confirmed what happened, so we refunded ${U.peso(amt)} to your GCash. Sorry about that!`
      : `Hi! This is Joy from Gopher Support. We talked to ${firstName(prov)} and sorted it out. Thanks for your patience!` });
    if (o) {
      if (amt) {
        o.money.supportRefund = amt;
        addTx(o.providerId, 'Adjustment (support) · ' + o.id, -amt, o.id);
      }
      o.timeline.push({ status: o.status, at: now(), note: 'Support resolved ' + t.id + (amt ? ' · ' + U.peso(amt) + ' refunded' : ''), by: 'support', from: o.status, event: 'resolved' });
    }
    notify(t.userId, `Support answered ${t.id}${amt ? ': ' + U.peso(amt) + ' refunded' : ''}.`, o ? '#/order/' + o.id : '');
    commit({ type: 'ticket', id: t.orderId });
    return t;
  }

  // ---- listings ----------------------------------------------------------------------------------------
  function listingsQuery(f) {
    f = f || {};
    const q = String(f.q || '').trim().toLowerCase();
    let items = Object.values(state.listings).filter((l) => {
      if (!f.includeAll && l.status !== 'live') return false;
      if (f.kind && l.kind !== f.kind) return false;
      if (f.cat && l.cat !== f.cat) return false;
      if (f.ownerId && l.ownerId !== f.ownerId) return false;
      if (f.format && l.format !== f.format) return false;
      if (q) {
        const hay = (l.title + ' ' + l.desc + ' ' + (l.subject || '') + ' ' + shortName(state.users[l.ownerId])).toLowerCase();
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      if (f.max && priceFrom(l) > Number(f.max)) return false;
      return true;
    });
    const sort = f.sort || 'relevant';
    items.sort((a, b) => {
      if (sort === 'price') return priceFrom(a) - priceFrom(b);
      if (sort === 'rating') return ownerScore(b) - ownerScore(a);
      if (sort === 'new') return b.createdAt - a.createdAt;
      return ownerScore(b) + b.createdAt / 1e13 - (ownerScore(a) + a.createdAt / 1e13);
    });
    return items;
  }
  const priceFrom = (l) => Math.min(l.rent ? l.rent.price : Infinity, l.buy != null ? l.buy : Infinity);
  const ownerScore = (l) => ratingOf(l.ownerId, 'provider').avg;

  function createListing(input, uid) {
    uid = uid || state.meId;
    requireVerified(uid);
    const kind = input.kind === 'academic' ? 'academic' : 'rental';
    const title = String(input.title || '').trim().slice(0, 90);
    if (title.length < 4) throw err('INVALID', 'Give your listing a title (at least 4 characters).');
    const id = newId(kind === 'rental' ? 'ls' : 'ac');
    const l = {
      id, kind, cat: input.cat, ownerId: uid, title,
      desc: String(input.desc || '').trim().slice(0, 600),
      rent: null, buy: null, deposit: Math.max(0, Math.round(Number(input.deposit) || 0)), value: Math.max(0, Math.round(Number(input.value) || 0)),
      format: kind === 'academic' ? (input.format || 'digital') : null, subject: String(input.subject || '').trim().slice(0, 80),
      pages: Math.max(0, parseInt(input.pages, 10) || 0), condition: input.condition || 'Good', spot: input.spot || 'Library entrance',
      photo: null, status: kind === 'academic' ? 'review' : 'live', createdAt: now(), byDemoUser: uid === state.meId,
    };
    const price = Math.max(1, Math.round(Number(input.price) || 0));
    if (kind === 'rental') l.rent = { price, per: 'day' };
    else if (l.format === 'book' && input.mode === 'rent') l.rent = { price, per: 'week' };
    else l.buy = price;
    if (input.photo && U.isImageData(input.photo)) {
      const pid = newId('ph');
      try {
        if (!memoryOnly) localStorage.setItem(PHOTO_PREFIX + pid, input.photo);
        photoCache.set(pid, input.photo);
        l.photo = 'local:' + pid;
      } catch (e) {
        l.photoFailed = true; // storage full: listing still saves with its category art
      }
    }
    state.listings[id] = l;
    if (l.status === 'review') notify(uid, `“${l.title}” is in review. We check that notes are original work; it usually takes a few minutes.`, '#/listing/' + id);
    commit({ type: 'listing', id });
    return l;
  }
  function photoSrc(ref) {
    if (!ref || typeof ref !== 'string') return '';
    if (ref.startsWith('local:')) {
      const pid = ref.slice(6);
      if (photoCache.has(pid)) return photoCache.get(pid);
      try {
        const v = localStorage.getItem(PHOTO_PREFIX + pid) || '';
        if (U.isImageData(v)) { photoCache.set(pid, v); return v; }
      } catch (e) { /* ignore */ }
      return '';
    }
    return ref.startsWith('assets/') ? ref : '';
  }
  function approveListing(id) {
    const l = state.listings[id];
    if (!l || l.status !== 'review') return l;
    l.status = 'live';
    l.liveAt = now();
    notify(l.ownerId, `“${l.title}” passed review and is now live.`, '#/listing/' + id);
    commit({ type: 'listing', id });
    return l;
  }
  // A simulated student asks to rent/buy something the demo user listed.
  function simRequest(listingId, fromId) {
    const l = state.listings[listingId];
    if (!l || l.simRequested) return null;
    l.simRequested = true;
    const kind = l.kind === 'rental' || (l.rent && l.rent.per === 'week') ? 'rental' : 'purchase';
    state.drafts.sim = { id: 'sim', kind, input: { listingId, days: 1, access: 'keep' }, userId: fromId };
    const o = pay('sim', 'gcash', fromId);
    delete state.drafts.sim;
    save();
    return o;
  }

  // ---- users & session --------------------------------------------------------------------------------------
  function login(id) {
    mustUser(id);
    state.meId = id;
    commit({ type: 'session' });
    return state.users[id];
  }
  // Log in with the email used at sign-up (the demo doesn't store or check passwords).
  function loginByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    const u = Object.values(state.users).find((x) => x.email === e && !x.deleted);
    if (!u) throw err('NOT_FOUND', 'We couldn’t find an account with that email. Check it, or create an account.');
    return login(u.id);
  }
  function logout() {
    state.meId = null;
    commit({ type: 'session' });
  }
  // Sign-up: any email, plus a photo of a student ID or matriculation form. The photo
  // itself is never saved (the demo only keeps the file name); Gopher's team "reviews" it
  // (sim.js) before the account can book, list or earn.
  function signup(input) {
    const first = String(input.first || '').trim(), last = String(input.last || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const vm = C.VERIFY_METHODS[input.method];
    if (!first || !last) throw err('INVALID', 'Enter your first and last name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) throw err('INVALID', 'Enter a valid email address.');
    if (!vm) throw err('INVALID', 'Choose how you’ll verify: student ID or matriculation form.');
    if (!input.proof) throw err('INVALID', 'Upload a photo of your ' + vm.short + '.');
    if (Object.values(state.users).some((u) => u.email === email)) throw err('CONFLICT', 'That email already has an account in this demo.');
    const id = newId('u');
    state.users[id] = {
      id, first, last, schoolId: input.schoolId || 'adnu', program: input.program || '', year: input.year || '',
      email, verified: false, color: '#0B67AD', bio: '', online: false,
      verification: { method: input.method, status: 'pending', submittedAt: now(), file: String(input.proofName || '').slice(0, 80) },
      ratings: { provider: { sum: 0, count: 0 }, requester: { sum: 0, count: 0 } },
      stats: { jobs: 0, onTime: 0, lent: 0, sold: 0 }, wallet: { available: 0, tx: [] },
      joinedAt: now(), persona: false,
      consents: { terms: now(), age: now(), updates: !!input.updates },
    };
    state.meId = id;
    notify(id, `Welcome to Gopher! We’re checking your ${vm.short}. You can look around while we review it.`, '#/profile');
    commit({ type: 'session' });
    return state.users[id];
  }
  function approveVerification(uid) {
    const u = state.users[uid];
    if (!u || !u.verification || u.verification.status !== 'pending') return u;
    u.verification.status = 'verified';
    u.verification.at = now();
    u.verified = true;
    const vm = C.VERIFY_METHODS[u.verification.method] || { short: 'student ID' };
    notify(uid, `You’re verified! Your ${vm.short} checked out, so you can now book, list, and earn.`, '#/home');
    commit({ type: 'user', id: uid });
    return u;
  }
  function requireVerified(uid) {
    const u = state.users[uid];
    if (!u || u.verified) return;
    const v = u.verification || {};
    const vm = C.VERIFY_METHODS[v.method] || { short: 'student ID' };
    throw err('UNVERIFIED', v.status === 'pending'
      ? `We’re still checking your ${vm.short}. Booking, listing and earning unlock once you’re verified.`
      : 'Verify that you’re a student first.');
  }

  function updateMe(patch) {
    const u = mustUser(state.meId);
    ['bio', 'program', 'year'].forEach((k) => { if (k in patch) u[k] = String(patch[k]).slice(0, 200); });
    if (patch.online) requireVerified(u.id);
    if ('online' in patch) u.online = !!patch.online;
    commit({ type: 'user', id: u.id });
    return u;
  }
  function cashOut(amount) {
    const u = mustUser(state.meId);
    const a = Math.round(Number(amount) || 0);
    if (a < 50) throw err('INVALID', 'The minimum cash-out is ₱50.');
    if (a > u.wallet.available) throw err('INVALID', 'That’s more than your available balance.');
    addTx(u.id, 'Cashed out to GCash (demo)', -a);
    commit({ type: 'wallet', id: u.id });
    return u.wallet;
  }

  // ---- queries -----------------------------------------------------------------------------------------------
  function myOrders(uid) {
    uid = uid || state.meId;
    return Object.values(state.orders)
      .filter((o) => o.requesterId === uid || o.providerId === uid)
      .sort((a, b) => b.statusAt - a.statusAt);
  }
  function openJobs(f) {
    f = f || {};
    return Object.values(state.orders)
      .filter((o) => o.kind === 'errand' && o.status === 'open' && o.requesterId !== state.meId && (!f.type || o.errand.type === f.type))
      .sort((a, b) => a.errand.neededBy - b.errand.neededBy);
  }
  // Whose move it is on an order, from uid's point of view.
  function nextMove(o, uid) {
    const meta = C.STATUS[o.kind][o.status] || {};
    const role = roleOf(o, uid);
    if (!role) return 'none';
    if (meta.who === role) return 'you';
    if (meta.who) return 'them';
    if (['completed', 'unlocked'].includes(o.status) && !o.rated[role]) return 'rate';
    return 'done';
  }
  function notifications(uid) {
    uid = uid || state.meId;
    return state.notifs.filter((n) => n.userId === uid).sort((a, b) => b.at - a.at);
  }
  function markAllRead() {
    state.notifs.forEach((n) => { if (n.userId === state.meId) n.read = true; });
    commit({ type: 'notifs' });
  }
  function reviewsFor(userId, role) {
    return state.reviews.filter((r) => r.toId === userId && (!role || r.role === role)).sort((a, b) => b.at - a.at);
  }

  // ---- data rights (RA 10173 demo) --------------------------------------------------------------------------------
  function exportMyData() {
    const u = mustUser(state.meId);
    const mine = myOrders(u.id);
    return {
      exportedAt: new Date(now()).toISOString(),
      note: 'Gopher demo export. In the demo, all data lives in this browser only.',
      profile: { first: u.first, last: u.last, email: u.email, school: u.schoolId, program: u.program, year: u.year, bio: u.bio, joinedAt: new Date(u.joinedAt).toISOString(),
        verification: u.verification ? { method: u.verification.method, status: u.verification.status,
          submittedAt: u.verification.submittedAt ? new Date(u.verification.submittedAt).toISOString() : null,
          verifiedAt: u.verification.at ? new Date(u.verification.at).toISOString() : null, photoKept: false } : null },
      wallet: u.wallet,
      listings: Object.values(state.listings).filter((l) => l.ownerId === u.id).map((l) => Object.assign({}, l, { photo: l.photo ? '(photo)' : null })),
      bookings: mine,
      reviewsWritten: state.reviews.filter((r) => r.fromId === u.id),
      reviewsReceived: state.reviews.filter((r) => r.toId === u.id),
      notifications: notifications(u.id),
    };
  }
  function deleteAccount() {
    const uid = state.meId;
    const u = mustUser(uid);
    const open = myOrders(uid).filter((o) => !['completed', 'unlocked', 'cancelled', 'declined'].includes(o.status));
    if (open.length) throw err('INVALID', `Finish or cancel your ${U.plural(open.length, 'active booking')} first.`);
    Object.values(state.listings).forEach((l) => { if (l.ownerId === uid) l.status = 'removed'; });
    u.first = 'Deleted'; u.last = 'user'; u.email = 'deleted-' + uid + '@example.invalid'; u.bio = ''; u.program = ''; u.deleted = true;
    state.notifs = state.notifs.filter((n) => n.userId !== uid);
    state.meId = null;
    commit({ type: 'session' });
  }

  // ---- lifecycle ------------------------------------------------------------------------------------------------------
  function init(opts) {
    opts = opts || {};
    key = opts.key || C.STORAGE_KEY;
    memoryOnly = !!opts.memory || !storageOk();
    state = (!opts.reset && readSaved()) || G.seed(now());
    save();
    return { memoryOnly };
  }
  function reset() {
    // Remove only our own keys; other sites' data on file:// stays put.
    try {
      Object.keys(localStorage).forEach((k) => { if (k.startsWith(PHOTO_PREFIX)) localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
    photoCache.clear();
    const keepMe = state && state.meId;
    state = G.seed(now());
    if (keepMe && state.users[keepMe]) state.meId = keepMe;
    commit({ type: 'reset' });
  }
  function setSetting(k, v) { state.settings[k] = v; commit({ type: 'settings' }); }

  // ---- public API ---------------------------------------------------------------------------------------------------------
  const sync = {
    init, reset, raw: () => state, isMemoryOnly: () => memoryOnly,
    me: () => (state.meId ? state.users[state.meId] : null), user: (id) => state.users[id] || null,
    users: () => Object.values(state.users), login, loginByEmail, logout, signup, updateMe, cashOut,
    listings: listingsQuery, listing: (id) => state.listings[id] || null, createListing, photoSrc, approveListing, simRequest,
    approveVerification,
    listingRating, ratingOf, reviewsFor,
    openJobs, myOrders, order: (id) => state.orders[id] || null, nextMove, roleOf, otherParty,
    quote, payOptions, cancelInfo, createDraft, getDraft, pay, act, sendMessage, review, report, resolveTicket,
    ticket: (id) => state.tickets[id] || null,
    notifications, unreadCount: () => notifications().filter((n) => !n.read).length, markAllRead,
    exportMyData, deleteAccount, setting: (k) => state.settings[k], setSetting,
    touch: () => commit({ type: 'change' }), // demo scenarios edit raw() then call this
    shortName, printCost, earning,
  };

  const store = { sync, on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
  // Async versions for the screens (same names, return promises).
  Object.keys(sync).forEach((k) => {
    if (typeof sync[k] !== 'function') return;
    store[k] = (...args) => new Promise((resolve, reject) => {
      try { resolve(sync[k](...args)); } catch (e) { reject(e); }
    });
  });
  // Display helpers that must stay synchronous.
  store.photoSrc = photoSrc;
  store.shortName = shortName;

  G.store = store;
})(window.Gopher = window.Gopher || {});
