/* Gopher — simulates every student except the one using the demo.
 *
 * There is no job queue. The next step for each booking is worked out from the
 * booking itself (its status and when that status started), so a reload can't
 * lose a step and running a step twice does nothing the second time.
 *
 * Modes (Demo panel): auto   — steps happen on their own after a short delay
 *                     manual — steps happen when the presenter presses Next step (N)
 *                     off    — nothing happens (used for screenshots)
 * Chat replies, hand-off codes and ratings always happen on their own (unless off).
 * "Fast-forward" steps (pickup/return days later) only happen on Next step.
 */
(function (G) {
  'use strict';
  const C = G.config, U = G.util;
  const S = () => G.store.sync;
  const T = C.SIM;
  let timer = null;

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pick = (list, salt) => list[hash(String(salt)) % list.length];
  const nm = (id) => S().shortName(S().user(id));
  const first = (id) => (S().user(id) || {}).first || 'there';

  // ---- what the simulated students say ----------------------------------------
  function say(o, action, actorId) {
    const e = o.errand || {};
    const l = o.listingId ? S().listing(o.listingId) || {} : {};
    const req = first(o.requesterId);
    switch (o.kind + ':' + action) {
      case 'errand:accept':
        return {
          print: `Hi ${req}! I got your print job. Heading to the print shop now 🙂`,
          food: `Hi ${req}! On my way to get your food. Message me if you want to change anything.`,
          medicine: `Hi ${req}! Going to the pharmacy now. Over-the-counter only, right? 👍`,
          supplies: `Hi ${req}! Buying your supplies now.`,
        }[e.type] || `Hi ${req}! Picking it up now.`;
      case 'errand:buy':
        if (e.type === 'print') return `Printed! ${U.plural(Number(e.details.pages) || 0, 'page')} × ${e.details.copies || 1}. Receipt is ${U.peso(e.actual || 0)} 🧾`;
        if (e.actual) return `Got everything! Receipt is ${U.peso(e.actual)} 🧾`;
        return 'Got it! Heading your way.';
      case 'errand:depart': return `On my way to ${e.to}. About 3 minutes!`;
      case 'errand:deliver': return `Thanks, ${req}! Good luck today 🙌`;
      case 'rental:confirm': return `Hi ${req}! See you at the ${l.spot || 'meetup spot'}. I'll bring everything 🙂`;
      case 'rental:handover': return 'Here you go! Take care of it 🙂';
      case 'rental:close': return 'All good, thanks for returning it on time!';
      case 'rental:return': return `Hi! I'm at the ${l.spot || 'meetup spot'} to return it. Thank you!`;
      case 'purchase:confirm': return `Hi ${req}! See you at the ${l.spot || 'meetup spot'}.`;
      case 'purchase:handover': return 'Here’s your copy. Good luck on your exams!';
      default: return '';
    }
  }
  const REPLIES = ['Okay, noted! 👍', 'Sige, got it!', 'Will do 🙂', 'Thanks! See you soon.', 'No problem!', 'Noted, thank you!'];

  function runnerFor(o, meId) {
    const pref = { print: 'u_mika', food: 'u_nico', fetch: 'u_migs', deliver: 'u_mika', supplies: 'u_nico', medicine: 'u_mika' }[o.errand.type];
    return [pref, 'u_mika', 'u_migs', 'u_nico'].find((id) => id && id !== meId && id !== o.requesterId && S().user(id));
  }
  function requesterFor(meId) {
    return ['u_ivan', 'u_trish', 'u_gab'].find((id) => id !== meId);
  }

  // ---- planning: the next simulated step for everything involving me --------------
  function actStep(o, action, actorId, dueAt, extra) {
    const planned = o.status; // remember what we planned for; the booking object itself changes
    return Object.assign({
      key: o.id + ':' + planned + ':' + action, orderId: o.id, action, actorId, dueAt,
      run() {
        const cur = S().order(o.id);
        if (!cur || cur.status !== planned) return; // already moved on
        S().act(o.id, action, { expect: planned, skipCode: true,
          actual: action === 'buy' ? simActual(cur) : undefined }, actorId);
        const line = say(S().order(o.id), action, actorId);
        if (line) S().sendMessage(o.id, line, actorId);
      },
    }, extra || {});
  }
  function simActual(o) {
    const e = o.errand;
    if (e.type === 'print') return o.money.items;
    if (['food', 'supplies', 'medicine'].includes(e.type)) return Math.max(0, Math.round((o.money.items || 0) * 0.9));
    return 0;
  }
  function label(step, o) {
    const who = nm(step.actorId);
    const e = (o && o.errand) || {};
    const l = o && o.listingId ? S().listing(o.listingId) || {} : {};
    switch (step.action) {
      case 'accept': return `${who} accepts your errand`;
      case 'buy': return e.type === 'print' ? `${who} prints your file` : ['fetch', 'deliver'].includes(e.type) ? `${who} picks up the item` : `${who} buys your items`;
      case 'depart': return `${who} heads to ${e.to}`;
      case 'deliver': return `${who} enters your hand-off code`;
      case 'confirm': return `${who} confirms`;
      case 'handover': return o.kind === 'rental' ? `Fast-forward to pickup: ${who} hands it over` : `Fast-forward to meetup: ${who} hands it over`;
      case 'return': return `Fast-forward to return: ${who} returns your ${l.title || 'item'}`;
      case 'close': return `${who} checks the returned item`;
      case 'shareCode': return `${who} sends their hand-off code`;
      case 'rate': return `${who} rates you`;
      case 'rateBack': return `${who} rates you back`;
      case 'reply': return `${who} replies`;
      default: return step.action;
    }
  }

  function planOrder(o, meId) {
    const s = o.status, reqMe = o.requesterId === meId, provMe = o.providerId === meId;
    if (!reqMe && !provMe) return null;
    const at = o.statusAt;
    if (o.kind === 'errand') {
      if (s === 'open' && reqMe) return actStep(o, 'accept', runnerFor(o, meId), at + T.accept);
      if (reqMe && o.providerId && !provMe) {
        const a = { accepted: 'buy', bought: 'depart', on_the_way: 'deliver' }[s];
        if (a) return actStep(o, a, o.providerId, at + T.step);
      }
      if (provMe && s === 'on_the_way' && !o.codeShared) return codeStep(o, o.requesterId, at + T.code);
    }
    if (o.kind === 'rental') {
      if (reqMe && s === 'requested') return actStep(o, 'confirm', o.providerId, at + T.confirm);
      if (reqMe && s === 'confirmed') return actStep(o, 'handover', o.providerId, at + T.confirm, { manual: true });
      if (reqMe && s === 'returned') return actStep(o, 'close', o.providerId, at + T.close);
      if (provMe && s === 'confirmed' && !o.codeShared) return codeStep(o, o.requesterId, at + T.code);
      if (provMe && s === 'in_use') return actStep(o, 'return', o.requesterId, at + T.step, { manual: true });
    }
    if (o.kind === 'purchase') {
      if (reqMe && s === 'requested') return actStep(o, 'confirm', o.providerId, at + T.confirm);
      if (reqMe && s === 'confirmed') return actStep(o, 'handover', o.providerId, at + T.confirm, { manual: true });
      if (provMe && s === 'confirmed' && !o.codeShared) return codeStep(o, o.requesterId, at + T.code);
    }
    if (['completed', 'unlocked'].includes(s)) {
      if (provMe && !o.rated.requester) return rateStep(o, o.requesterId, 'rate', at + T.rate);
      if (reqMe && !o.rated.provider && o.providerId) return rateStep(o, o.providerId, 'rateBack', at + T.rate);
    }
    return null;
  }
  function codeStep(o, actorId, dueAt) {
    return {
      key: o.id + ':code', orderId: o.id, action: 'shareCode', actorId, dueAt, always: true,
      run() {
        const cur = S().order(o.id);
        if (!cur || cur.codeShared) return;
        cur.codeShared = true;
        const what = o.kind === 'errand' ? 'hand-off' : o.kind === 'rental' ? 'pickup' : 'hand-off';
        S().sendMessage(o.id, `Here's my ${what} code: ${cur.code} 🙂`, actorId);
      },
    };
  }
  const RATE_TEXT = {
    rate: ['Super reliable, thank you!', 'Fast and friendly. Salamat!', 'Smooth hand-off, would book again.', 'Kept me updated the whole time.'],
    rateBack: ['Clear instructions and quick to answer.', 'Easy hand-off. Thanks!', 'Very polite and on time.'],
  };
  function rateStep(o, actorId, action, dueAt) {
    return {
      key: o.id + ':' + action, orderId: o.id, action, actorId, dueAt, always: true,
      run() {
        const cur = S().order(o.id);
        const role = S().roleOf(cur, actorId);
        if (!cur || !role || cur.rated[role]) return;
        S().review(o.id, { stars: 5, text: pick(RATE_TEXT[action], o.id), tags: [] }, actorId);
      },
    };
  }
  function planChat(o, meId) {
    const last = o.chat[o.chat.length - 1];
    if (!last || last.from !== meId) return null;
    if (U.now() - last.at > 10 * U.MIN) return null; // only answer fresh messages
    const other = S().otherParty(o, meId);
    if (!other || other === meId) return null;
    return {
      key: o.id + ':reply:' + last.id, orderId: o.id, action: 'reply', actorId: other, dueAt: last.at + T.reply, always: true,
      run() {
        const cur = S().order(o.id);
        const l2 = cur && cur.chat[cur.chat.length - 1];
        if (!l2 || l2.id !== last.id) return;
        S().sendMessage(o.id, pick(REPLIES, last.id), other);
      },
    };
  }

  // Everything pending for the current user, soonest first.
  function steps() {
    const st = S().raw();
    const me = st && st.meId;
    if (!me) return [];
    const out = [];
    Object.values(st.orders).forEach((o) => {
      if (o.requesterId !== me && o.providerId !== me) return;
      const p = planOrder(o, me);
      if (p) { p.label = label(p, o); out.push(p); }
      const c = planChat(o, me);
      if (c) { c.label = label(c, o); out.push(c); }
    });
    Object.values(st.listings).forEach((l) => {
      if (l.ownerId !== me) return;
      if (l.status === 'review') {
        out.push({ key: l.id + ':approve', listingId: l.id, action: 'approve', dueAt: l.createdAt + T.review,
          label: `“${l.title}” passes review`, run: () => S().approveListing(l.id) });
      } else if (l.status === 'live' && l.byDemoUser && !l.simRequested) {
        const who = requesterFor(me);
        out.push({ key: l.id + ':request', listingId: l.id, action: 'request', actorId: who, dueAt: (l.liveAt || l.createdAt) + T.request,
          label: `${nm(who)} asks for your ${l.title}`, run: () => S().simRequest(l.id, who) });
      }
    });
    // A new student's ID / matriculation upload gets checked by "Gopher's team".
    const mine = st.users[me];
    if (mine && mine.verification && mine.verification.status === 'pending') {
      const vm = C.VERIFY_METHODS[mine.verification.method] || { short: 'student ID' };
      out.push({ key: me + ':verify', action: 'verify', dueAt: (mine.verification.submittedAt || 0) + T.verify, always: true,
        label: 'Gopher checks your ' + vm.short, run: () => S().approveVerification(me) });
    }
    Object.values(st.tickets).forEach((t) => {
      if (t.userId !== me || t.status !== 'open') return;
      out.push({ key: t.id + ':support', orderId: t.orderId, action: 'support', dueAt: t.createdAt + T.support,
        label: `Gopher Support answers ${t.id}`, run: () => S().resolveTicket(t.id) });
    });
    return out.sort((a, b) => (a.manual ? 1 : 0) - (b.manual ? 1 : 0) || a.dueAt - b.dueAt);
  }

  function mode() { return (S().raw() && S().setting('sim')) || 'auto'; }

  function fire(step) {
    try { step.run(); } catch (e) {
      if (!['CONFLICT', 'NOT_FOUND', 'FORBIDDEN'].includes(e.code)) console.warn('[sim]', step.key, e);
    }
  }

  // One pass: run whatever is due. At most one step per booking per pass.
  function tick() {
    if (!S().raw() || mode() === 'off') return;
    if (typeof document !== 'undefined' && document.hidden) return; // only the tab you're looking at
    const auto = mode() === 'auto';
    const t = U.now();
    const seen = new Set();
    steps().forEach((s) => {
      if (s.manual || s.dueAt > t) return;
      if (!s.always && !auto) return;
      const k = s.orderId || s.listingId || s.key;
      if (seen.has(k)) return;
      seen.add(k);
      fire(s);
    });
  }

  // Next step (N): run the next pending step now — for this booking if given.
  function next(orderId) {
    const all = steps();
    const s = (orderId && all.find((x) => x.orderId === orderId && x.action !== 'reply')) || all.find((x) => x.action !== 'reply') || all[0];
    if (!s) return null;
    fire(s);
    return s;
  }
  function peek(orderId) {
    const all = steps();
    return (orderId && all.find((x) => x.orderId === orderId)) || all[0] || null;
  }
  function pendingFor(orderId) { return steps().filter((s) => s.orderId === orderId); }

  // Run steps back to back (tests and "skip ahead"). Ignores timing and mode.
  function runUntilIdle(max, filter) {
    let n = 0;
    for (; n < (max || 50); n++) {
      const s = steps().find((x) => !filter || filter(x));
      if (!s) break;
      fire(s);
    }
    return n;
  }

  function start() {
    stop();
    timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    setTimeout(tick, 50);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', tick);
  }

  G.sim = { start, stop, tick, next, peek, steps, pendingFor, runUntilIdle, mode };
})(window.Gopher = window.Gopher || {});
