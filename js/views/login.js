/* Log in with the email you signed up with. In the demo the password isn't
 * checked (nothing is stored); demo accounts are one tap away. */
(function (G) {
  'use strict';
  const U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  const DEMO = [['u_bea', 'Needs help between classes'], ['u_migs', 'Go-runner & lender']];

  G.views.login = {
    title: 'Log in', bare: true,
    async mount(ctx) {
      const me = await G.store.me();
      const demo = await Promise.all(DEMO.map(([id]) => G.store.user(id)));
      const next = ctx.query.next && ctx.query.next.startsWith('/') ? ctx.query.next : '/home';

      ctx.render(html`<div class="auth" data-view="login">
        <a class="auth-back" href="#/welcome">${UI.ic('arrow-left', { size: 18 })} Back</a>
        <img class="auth-logo" src="assets/brand/logo.svg" alt="Gopher" width="920" height="270">
        <h1>Log in</h1>
        <p class="muted">Welcome back! Use the email you signed up with.</p>

        ${me ? html`<div class="notice mb-3">${UI.ic('user', { size: 18 })}<span class="grow">You’re logged in as <strong>${UI.name(me)}</strong>.</span>
          <button type="button" class="btn btn-soft btn-sm" data-action="continue">Continue</button></div>` : ''}

        <form class="auth-form" data-form="login" novalidate>
          <label class="field"><span class="label">Email</span>
            <input class="input" type="email" name="email" id="login-email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></label>
          <label class="field"><span class="label">Password</span>
            <input class="input" type="password" name="password" id="login-password" autocomplete="current-password" placeholder="Your password" required></label>
          <div class="row-between">
            ${UI.demoHint('Demo: use Bea’s account (tap to fill)', 'bea.santos@gbox.adnu.edu.ph', 'login-email')}
            <button type="button" class="linkish small" data-action="forgot">Forgot password?</button>
          </div>
          <p class="error-text" data-error hidden></p>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Log in</button>
        </form>

        <div class="auth-divider"><span>or use a demo account</span></div>
        <div class="demo-logins">
          ${demo.map((u, i) => html`<button type="button" class="persona persona-sm card" data-login="${u.id}">
            ${UI.avatar(u, 40)}
            <span class="grow"><span class="persona-name">${u.first} ${u.last[0]}. ${UI.verified(u)}</span><span class="persona-tag">${DEMO[i][1]}</span></span>
            ${UI.ic('chevron-right')}
          </button>`)}
        </div>

        <p class="auth-switch">New to Gopher? <a href="#/signup">Create an account</a></p>
        <p class="welcome-foot">Demo: passwords aren’t checked or saved, and nothing leaves this device.</p>
      </div>`);

      const showError = (msg) => {
        const el = ctx.root.querySelector('[data-error]');
        if (el) { el.textContent = msg; el.hidden = !msg; }
      };
      const done = (u) => {
        UI.toast('Welcome back, ' + u.first + '!', { icon: 'circle-check' });
        location.hash = '#' + next;
      };
      ctx.on('click', '.demo-hint', (e, el) => {
        const t = ctx.root.querySelector('#' + el.dataset.target);
        if (t) t.value = el.dataset.fill;
        const pw = ctx.root.querySelector('#login-password');
        if (pw && !pw.value) pw.value = 'demo-password';
        showError('');
      });
      ctx.on('click', '[data-action="forgot"]', () => UI.toast('Demo: password reset isn’t available. Use a demo account or create a new one.', { icon: 'info' }));
      ctx.on('click', '[data-action="continue"]', () => { location.hash = '#' + next; });
      ctx.on('click', '[data-login]', async (e, el) => {
        const u = await G.store.login(el.dataset.login);
        done(u);
      });
      ctx.on('submit', 'form[data-form="login"]', async (e, form) => {
        e.preventDefault();
        const d = U.formData(form);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(d.email || '').trim())) return showError('Enter the email you signed up with.');
        if (!String(d.password || '')) return showError('Enter your password.');
        try { done(await G.store.loginByEmail(d.email)); } catch (err) { showError(err.message); }
      });
    },
  };
})(window.Gopher = window.Gopher || {});
