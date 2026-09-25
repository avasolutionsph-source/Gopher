/* Welcome: pick a demo persona or create an account (verified with a student ID or matriculation form). */
(function (G) {
  'use strict';
  const U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  const PERSONAS = [
    { id: 'u_bea', tag: 'Needs help between classes', text: 'Books errands, rents gear, buys reviewers.' },
    { id: 'u_migs', tag: 'Go-runner & lender', text: 'Runs errands for pocket money and lends a tripod.' },
  ];

  G.views.welcome = {
    title: 'Welcome', bare: true,
    async mount(ctx) {
      const users = await Promise.all(PERSONAS.map((p) => G.store.user(p.id)));
      ctx.render(html`<div class="welcome" data-view="welcome">
        <div class="welcome-hero">
          <img class="welcome-logo" src="assets/brand/logo.svg" alt="Gopher" width="920" height="270">
          <h1 class="welcome-title">Can’t leave class? Gopher it.</h1>
          <p class="welcome-sub">Errands, rentals, and reviewers from fellow students.</p>
        </div>
        <div class="welcome-auth">
          <a class="btn btn-primary btn-lg" href="#/login">Log in</a>
          <a class="btn btn-soft btn-lg" href="#/signup">Sign up</a>
        </div>
        <p class="xsmall muted center mt-2">New accounts verify with a student ID or matriculation form.</p>
        <div class="auth-divider"><span>or try the demo as</span></div>
        <div class="persona-list">
          ${PERSONAS.map((p, i) => {
            const u = users[i];
            return html`<button type="button" class="persona card" data-login="${u.id}">
              ${UI.avatar(u, 52)}
              <span class="grow">
                <span class="persona-name">${u.first} ${u.last[0]}. ${UI.verified(u)}</span>
                <span class="persona-tag">${p.tag}</span>
                <span class="persona-text">${u.year}, ${u.program} · ${p.text}</span>
              </span>
              ${UI.ic('chevron-right')}
            </button>`;
          })}
        </div>
        <p class="welcome-foot">Prototype · no real payments · data stays on this device · all people are fictional.<br>
          <a href="index.html">About Gopher</a> · <a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a> · <a href="help.html">Help</a></p>
      </div>`);
      ctx.on('click', '[data-login]', async (e, el) => {
        await G.store.login(el.dataset.login);
        const next = ctx.query.next && ctx.query.next.startsWith('/') ? ctx.query.next : '/home';
        location.hash = '#' + next;
      });
    },
  };
})(window.Gopher = window.Gopher || {});
