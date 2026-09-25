/* Sign up: account details, then prove you're a current student by uploading a
 * photo of your student ID or matriculation form. Gopher's team (simulated)
 * reviews it; until then you can browse but not book, list or earn.
 * The photo is only previewed on this device — it is never saved or sent. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  function pathRound(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // A clearly-marked SAMPLE picture for presenters (no school name, seal or logo).
  function samplePhoto(method, who) {
    const isId = method === 'id';
    const w = 640, h = isId ? 404 : 820;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const font = (wt, px) => `${wt} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;
    g.fillStyle = '#DCE7F1'; g.fillRect(0, 0, w, h);
    if (isId) {
      pathRound(g, 28, 28, w - 56, h - 56, 22); g.fillStyle = '#FFFFFF'; g.fill();
      g.save(); pathRound(g, 28, 28, w - 56, h - 56, 22); g.clip();
      g.fillStyle = '#0F3F66'; g.fillRect(28, 28, w - 56, 72); g.restore();
      g.fillStyle = '#FFFFFF'; g.font = font(800, 26); g.fillText('STUDENT ID', 56, 74);
      g.font = font(700, 15); g.textAlign = 'right'; g.fillText('SAMPLE · DEMO ONLY', w - 56, 72); g.textAlign = 'left';
      pathRound(g, 56, 128, 150, 184, 12); g.fillStyle = '#CBD5E1'; g.fill();
      g.fillStyle = '#94A3B8'; g.beginPath(); g.arc(131, 196, 34, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(131, 300, 62, 52, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#0F172A'; g.font = font(800, 28); g.fillText(who.name || 'Student Name', 232, 168);
      g.fillStyle = '#334155'; g.font = font(500, 18);
      g.fillText(who.program || 'College student', 232, 204);
      g.fillText('ID No. 2026-00000', 232, 236);
      g.fillText('Valid for SY 2026–2027', 232, 268);
      g.fillStyle = '#0B67AD'; g.fillRect(232, 292, 300, 4);
    } else {
      g.fillStyle = '#FFFFFF'; g.fillRect(40, 30, w - 80, h - 60);
      g.fillStyle = '#0F172A'; g.font = font(800, 26); g.fillText('MATRICULATION FORM', 72, 90);
      g.fillStyle = '#B91C1C'; g.font = font(700, 14); g.fillText('SAMPLE · DEMO ONLY', 72, 116);
      g.fillStyle = '#334155'; g.font = font(600, 17);
      g.fillText('1st Semester, SY 2026–2027', 72, 150);
      g.fillText('Name: ' + (who.name || 'Student Name'), 72, 196);
      g.fillText('Program: ' + (who.program || 'College student'), 72, 226);
      g.fillText('Year level: ' + (who.year || '—'), 72, 256);
      g.fillStyle = '#E2E8F0'; g.fillRect(72, 290, w - 144, 2);
      g.fillStyle = '#0F172A'; g.font = font(700, 15); g.fillText('SUBJECT', 72, 320); g.textAlign = 'right'; g.fillText('UNITS', w - 72, 320); g.textAlign = 'left';
      for (let i = 0; i < 7; i++) {
        const y = 350 + i * 44;
        g.fillStyle = '#E2E8F0'; g.fillRect(72, y, 260 + ((i * 53) % 120), 12); g.fillRect(w - 102, y, 30, 12);
      }
      g.fillStyle = '#0F172A'; g.font = font(700, 16); g.fillText('Total units', 72, 690); g.textAlign = 'right'; g.fillText('21', w - 72, 690); g.textAlign = 'left';
    }
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.38);
    g.fillStyle = 'rgba(185, 28, 28, 0.16)'; g.font = font(800, 84); g.textAlign = 'center'; g.fillText('SAMPLE', 0, 28);
    g.restore();
    return c.toDataURL('image/jpeg', 0.82);
  }

  G.views.signup = {
    title: 'Sign up', bare: true, back: true,
    async mount(ctx) {
      let acct = null;
      const proof = { method: 'id', src: '', name: '' };

      const step1 = () => html`<div class="auth" data-view="signup">
        <a class="auth-back" href="#/welcome">${UI.ic('arrow-left', { size: 18 })} Back</a>
        <p class="auth-step">Step 1 of 2</p>
        <h1>Create your account</h1>
        <p class="muted">Gopher is for currently enrolled college students. Next, you’ll verify with your student ID or matriculation form.</p>
        <div class="notice">${UI.ic('info', { size: 18 })}<span><strong>Demo:</strong> please don’t use your real details. Nothing you type leaves this device.</span></div>
        <form class="auth-form" data-form="signup" novalidate>
          <label class="field"><span class="label">School</span>
            <select class="select" name="schoolId" required>
              ${C.SCHOOLS.map((s) => html`<option value="${s.id}" ${s.open ? '' : 'disabled'}>${s.name}${s.open ? ' (pilot)' : ' (coming soon)'}</option>`)}
            </select>
            <span class="hint">Gopher is piloting at Ateneo de Naga first. More Naga campuses next.</span>
          </label>
          <div class="field-row">
            <label class="field"><span class="label">First name</span><input class="input" name="first" autocomplete="given-name" value="${acct ? acct.first : ''}" required></label>
            <label class="field"><span class="label">Last name</span><input class="input" name="last" autocomplete="family-name" value="${acct ? acct.last : ''}" required></label>
          </div>
          <label class="field"><span class="label">Email</span>
            <input class="input" type="email" name="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="${acct ? acct.email : ''}" required>
            <span class="hint">For booking updates and receipts. Any email works.</span>
          </label>
          <div class="field-row">
            <label class="field"><span class="label">Program <span class="opt">(optional)</span></span><input class="input" name="program" placeholder="e.g. BS Nursing" value="${acct ? acct.program : ''}"></label>
            <label class="field"><span class="label">Year level</span>
              <select class="select" name="year">${C.YEAR_LEVELS.map((y) => html`<option ${acct && acct.year === y ? 'selected' : ''}>${y}</option>`)}</select></label>
          </div>
          <label class="check"><input type="checkbox" name="terms" ${acct && acct.terms ? 'checked' : ''} required><span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> (Data Privacy Act, RA 10173).</span></label>
          <label class="check"><input type="checkbox" name="age" ${acct && acct.age ? 'checked' : ''} required><span>I’m 18 or older.</span></label>
          <label class="check"><input type="checkbox" name="updates" ${acct && acct.updates ? 'checked' : ''}><span>Send me updates about Gopher. <span class="muted">(optional)</span></span></label>
          <p class="error-text" data-error hidden></p>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Continue</button>
        </form>
      </div>`;

      const step2 = () => {
        const vm = C.VERIFY_METHODS[proof.method];
        return html`<div class="auth" data-view="signup">
          <button type="button" class="auth-back linkish" data-action="edit">${UI.ic('arrow-left', { size: 18 })} Back to your details</button>
          <p class="auth-step">Step 2 of 2</p>
          <h1>Verify you’re a student</h1>
          <p class="muted">Upload one of these. We check that the name matches <strong>${acct.first} ${acct.last}</strong> and that you’re enrolled this semester.</p>
          <form class="auth-form" data-form="verify" novalidate>
            <div class="verify-options" role="radiogroup" aria-label="Proof of enrollment">
              ${Object.entries(C.VERIFY_METHODS).map(([k, m]) => html`<label class="verify-option ${proof.method === k ? 'is-on' : ''}">
                <input type="radio" name="method" value="${k}" class="sr-only" ${proof.method === k ? 'checked' : ''}>
                ${UI.ic(k === 'id' ? 'badge-check' : 'file-text', { size: 22 })}
                <span><strong>${m.label}</strong><small>${m.hint}</small></span>
              </label>`)}
            </div>
            <div class="field mt-4"><span class="label">Photo of your ${vm.short}</span>
              <div class="proof-pick">
                <span class="proof-prev ${proof.method === 'id' ? '' : 'is-doc'}">${proof.src ? html`<img src="${proof.src}" alt="Preview of your ${vm.short}">` : UI.ic('image', { size: 30 })}</span>
                <div class="proof-actions">
                  <label class="btn btn-soft btn-sm">${UI.ic('upload', { size: 16 })} ${proof.src ? 'Choose another' : 'Upload a photo'}<input type="file" name="proof-pick" accept="image/*" class="sr-only"></label>
                  <button type="button" class="btn btn-dashed btn-sm" data-action="sample">${UI.ic('sparkles', { size: 15 })} Use sample</button>
                  ${proof.name ? html`<span class="xsmall muted proof-name">${proof.name}</span>` : ''}
                </div>
              </div>
              <span class="hint">Make sure your name and the school year are easy to read.</span>
            </div>
            <label class="check"><input type="checkbox" name="match"><span>The name on it matches my account, and I’m enrolled this semester.</span></label>
            <div class="notice mt-3">${UI.ic('lock', { size: 18 })}<span>Only Gopher’s verification team sees this photo, and only to confirm you’re enrolled. We delete it after the check. <strong>Demo:</strong> the photo never leaves this device and isn’t saved.</span></div>
            <p class="error-text" data-error hidden></p>
            <button class="btn btn-primary btn-block btn-lg mt-4" type="submit">Submit for verification</button>
          </form>
        </div>`;
      };

      ctx.render(step1());
      const showError = (msg) => {
        const el = ctx.root.querySelector('[data-error]');
        if (el) { el.textContent = msg; el.hidden = !msg; if (msg) el.scrollIntoView({ block: 'center' }); }
      };
      const draw2 = () => {
        const keep = ctx.root.querySelector('input[name="match"]');
        const matched = keep && keep.checked;
        ctx.render(step2());
        if (matched) ctx.root.querySelector('input[name="match"]').checked = true;
      };

      ctx.on('submit', 'form[data-form="signup"]', (e, form) => {
        e.preventDefault();
        const d = U.formData(form);
        if (!String(d.first || '').trim() || !String(d.last || '').trim()) return showError('Enter your first and last name.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(d.email || '').trim())) return showError('Enter a valid email address.');
        if (!d.terms || !d.age) return showError('Please agree to the Terms and confirm you’re 18 or older.');
        acct = { first: d.first.trim(), last: d.last.trim(), email: d.email.trim(), schoolId: d.schoolId, program: d.program || '', year: d.year, terms: true, age: true, updates: !!d.updates };
        ctx.render(step2());
        document.getElementById('view').scrollTop = 0;
      });
      ctx.on('click', '[data-action="edit"]', () => ctx.render(step1()));
      ctx.on('change', 'input[name="method"]', (e, el) => {
        if (proof.method !== el.value) { proof.method = el.value; proof.src = ''; proof.name = ''; }
        draw2();
      });
      ctx.on('change', 'input[name="proof-pick"]', async (e, el) => {
        const f = el.files && el.files[0];
        if (!f) return;
        try {
          proof.src = await U.resizeImage(f, 960, 0.8); // preview only; never stored
          proof.name = f.name;
          draw2();
        } catch (err) { showError(err.message); }
      });
      ctx.on('click', '[data-action="sample"]', () => {
        proof.src = samplePhoto(proof.method, { name: acct.first + ' ' + acct.last, program: acct.program, year: acct.year });
        proof.name = proof.method === 'id' ? 'sample-student-id.jpg' : 'sample-matriculation.jpg';
        draw2();
      });
      ctx.on('submit', 'form[data-form="verify"]', async (e, form) => {
        e.preventDefault();
        const vm = C.VERIFY_METHODS[proof.method];
        if (!proof.src) return showError('Upload a photo of your ' + vm.short + ' (or tap Use sample).');
        if (!form.querySelector('input[name="match"]').checked) return showError('Please confirm the name matches and you’re enrolled this semester.');
        try {
          const u = await G.store.signup(Object.assign({}, acct, { method: proof.method, proof: true, proofName: proof.name }));
          proof.src = ''; // drop the picture as soon as it's "submitted"
          UI.toast(`Welcome, ${u.first}! We’re checking your ${vm.short}.`, { icon: 'clock' });
          location.hash = '#/home';
        } catch (err) { showError(err.message); }
      });
    },
  };
})(window.Gopher = window.Gopher || {});
