/* Profile (#/profile = me, #/user/:id = someone else). My profile also has the
 * go-runner switch, wallet, my listings and the data-rights settings. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  const S = () => G.store.sync;
  G.views = G.views || {};

  function header(u, isMe) {
    const school = (C.SCHOOLS.find((s) => s.id === u.schoolId) || {}).name || '';
    const rp = S().ratingOf(u.id, 'provider'), rr = S().ratingOf(u.id, 'requester');
    return html`<div class="profile-head">
      ${UI.avatar(u, 76)}
      <h1 class="profile-name">${u.first} ${isMe ? u.last : u.last[0] + '.'} ${UI.verified(u)}</h1>
      <p class="muted small mb-0">${u.program || 'Student'}${u.year ? ' · ' + u.year : ''}</p>
      <p class="muted small">${school}</p>
      <div class="row wrap center-row">
        ${u.verified ? html`<span class="badge badge-ok">${UI.ic('badge-check', { size: 14 })}${UI.verifyNote(u)}</span>`
          : html`<span class="badge badge-warn">${UI.ic('clock', { size: 14 })}Verification in review</span>`}
      </div>
      ${u.bio ? html`<p class="profile-bio">${u.bio}</p>` : ''}
      <div class="stat-row">
        <div class="stat"><strong>${rp.count ? rp.avg.toFixed(1) : '—'}</strong><span>as provider${rp.count ? ' (' + rp.count + ')' : ''}</span></div>
        <div class="stat"><strong>${rr.count ? rr.avg.toFixed(1) : '—'}</strong><span>as requester${rr.count ? ' (' + rr.count + ')' : ''}</span></div>
        <div class="stat"><strong>${u.stats.jobs}</strong><span>errands run</span></div>
        <div class="stat"><strong>${u.stats.lent + u.stats.sold}</strong><span>lent & sold</span></div>
      </div>
    </div>`;
  }
  function reviewsBlock(u) {
    const rs = S().reviewsFor(u.id).slice(0, 5);
    if (!rs.length) return '';
    return UI.section('Reviews', html`<div class="stack">${rs.map((r) => {
      const a = S().user(r.fromId);
      return html`<div class="review card card-pad"><div class="row">${UI.avatar(a, 30)}<strong>${UI.name(a)}</strong>${UI.starRow(r.stars)}<span class="xsmall muted grow right">${U.timeAgo(r.at)}</span></div>
        ${r.text ? html`<p class="mt-2 mb-0">${r.text}</p>` : ''}<p class="xsmall muted mt-2 mb-0">Verified booking · as ${r.role}</p></div>`;
    })}</div>`);
  }

  G.views.profile = {
    title: 'Profile', tab: 'profile',
    async mount(ctx) {
      async function draw() {
        const me = await G.store.me();
        if (!me) return;
        const mine = await G.store.listings({ ownerId: me.id, includeAll: true });
        const vm = me.verification ? C.VERIFY_METHODS[me.verification.method] : null;
        ctx.render(html`<div class="page profile" data-view="profile">
          ${header(me, true)}
          ${me.verified ? '' : html`<div class="notice notice-warn mt-4">${UI.ic('clock', { size: 18 })}<span>We’re checking your ${vm ? vm.short : 'student ID'}${me.verification && me.verification.file ? html` (${me.verification.file})` : ''}. Booking, listing and earning unlock once you’re verified, usually within a few minutes.</span></div>`}
          <section class="sec">
            <div class="runner-card ${me.online ? 'is-online' : ''}">
              <span class="runner-icon">${UI.ic('bike', { size: 24 })}</span>
              <div class="grow"><strong>Available as a go-runner</strong><p class="small muted mb-0">${me.online ? 'Students nearby can see you. You’ll get errand jobs.' : 'Turn on when you have a free period.'}</p></div>
              <label class="switch"><input type="checkbox" data-action="online" ${me.online ? 'checked' : ''} aria-label="Available as a go-runner"></label>
            </div>
          </section>
          <a class="wallet-card card card-link" href="#/wallet">
            <span class="grow"><span class="small muted">Wallet</span><strong class="wallet-amt">${UI.money(me.wallet.available)}</strong><span class="xsmall muted">available to cash out</span></span>
            ${UI.ic('chevron-right')}
          </a>
          ${UI.section('My listings', mine.length ? html`<div class="stack">${mine.filter((l) => l.status !== 'removed').map((l) => html`<a class="orow card card-link" href="#/listing/${l.id}">
              <span class="orow-icon">${UI.thumb(l, 22)}</span>
              <span class="orow-main"><span class="orow-top"><span class="orow-title">${l.title}</span>${l.status === 'review' ? html`<span class="pill pill-warn">In review</span>` : html`<span class="pill pill-ok">Live</span>`}</span>
              <span class="orow-sub">${UI.priceText(l)}</span></span></a>`)}</div>`
            : UI.empty({ icon: 'package', title: 'No listings yet', text: 'Rent out gear or share notes you made.' }),
            html`<a class="sec-link" href="#/list/new">+ New</a>`)}
          ${reviewsBlock(me)}
          <section class="sec"><h2 class="sec-title">Settings</h2>
            <div class="menu card">
              <a href="help.html">${UI.ic('circle-help', { size: 18 })}<span>Help center</span>${UI.ic('chevron-right', { size: 16 })}</a>
              <a href="terms.html">${UI.ic('file-text', { size: 18 })}<span>Terms of Service</span>${UI.ic('chevron-right', { size: 16 })}</a>
              <a href="privacy.html">${UI.ic('lock', { size: 18 })}<span>Privacy Policy</span>${UI.ic('chevron-right', { size: 16 })}</a>
              <button type="button" data-action="export">${UI.ic('download', { size: 18 })}<span>Download my data</span>${UI.ic('chevron-right', { size: 16 })}</button>
              <button type="button" data-action="feedback">${UI.ic('message-circle', { size: 18 })}<span>Give feedback</span>${UI.ic('chevron-right', { size: 16 })}</button>
              <button type="button" data-action="logout">${UI.ic('log-out', { size: 18 })}<span>Log out</span>${UI.ic('chevron-right', { size: 16 })}</button>
              <button type="button" class="danger" data-action="delete">${UI.ic('trash-2', { size: 18 })}<span>Delete my account</span>${UI.ic('chevron-right', { size: 16 })}</button>
            </div>
            <p class="xsmall muted mt-3">Your rights under the Data Privacy Act (RA 10173): see what we hold (Download my data) and erase it (Delete my account). In this demo, everything stays on this device.</p>
          </section>
        </div>`);
      }
      await draw();
      ctx.on('change', '[data-action="online"]', async (e, el) => {
        try {
          await G.store.updateMe({ online: el.checked });
          UI.toast(el.checked ? 'You’re online as a go-runner.' : 'You’re offline.', { icon: 'zap' });
        } catch (err) { el.checked = false; UI.errorToast(err); }
      });
      ctx.on('click', '[data-action="export"]', async () => {
        const data = await G.store.exportMyData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'gopher-my-data.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        UI.toast('Your data was downloaded as gopher-my-data.json', { icon: 'download' });
      });
      ctx.on('click', '[data-action="feedback"]', () => {
        if (C.FEEDBACK_URL) window.open(C.FEEDBACK_URL, '_blank', 'noopener');
        else UI.toast('Feedback form coming soon. Tell the Gopher team in person for now!', { icon: 'message-circle' });
      });
      ctx.on('click', '[data-action="logout"]', async () => {
        await G.store.logout();
        location.hash = '#/welcome';
      });
      ctx.on('click', '[data-action="delete"]', async () => {
        const ok = await UI.confirm({ title: 'Delete your account?', text: 'Your profile, listings and notifications are erased. Finished bookings stay anonymous for records. In this demo, you can Reset from the Demo panel to get everyone back.', ok: 'Delete my account', danger: true });
        if (!ok) return;
        try {
          await G.store.deleteAccount();
          UI.toast('Your account was deleted.', { icon: 'trash-2' });
          location.hash = '#/welcome';
        } catch (err) { UI.errorToast(err); }
      });
      ctx.watch(draw);
    },
  };

  G.views.user = {
    title: 'Student', back: true, tab: 'explore',
    async mount(ctx) {
      const u = await G.store.user(ctx.params.id);
      const me = await G.store.me();
      if (!u || u.deleted) { ctx.render(UI.empty({ icon: 'user', title: 'Student not found' })); return; }
      if (me && u.id === me.id) { ctx.go('/profile', {}, true); return; }
      const listings = await G.store.listings({ ownerId: u.id });
      ctx.render(html`<div class="page profile" data-view="user">
        ${header(u, false)}
        ${listings.length ? UI.section(u.first + '’s listings', html`<div class="grid">${listings.map((l) => UI.listingCard(l))}</div>`) : ''}
        ${reviewsBlock(u)}
        <button type="button" class="btn btn-ghost btn-sm mt-4" data-action="report-user">${UI.ic('flag', { size: 15 })} Report or block</button>
      </div>`);
      ctx.setTitle(u.first + ' ' + u.last[0] + '.');
      ctx.on('click', '[data-action="report-user"]', () => UI.toast('Thanks. Our team will review this within 24 hours. (Demo: nothing was sent.)', { icon: 'flag' }));
    },
  };
})(window.Gopher = window.Gopher || {});
