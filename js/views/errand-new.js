/* Request an errand: 3 steps (what → where & when → review). "Use sample"
 * fills everything so presenters never have to type on stage. */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  const DEFAULTS = {
    print: { details: { file: '', pages: '', copies: 1, color: 'bw', size: 'Short', staple: false }, from: 'Print shop near Main Gate' },
    food: { details: { items: '' }, from: 'Food stalls outside Back Gate', budget: '' },
    fetch: { details: { item: '', contact: '' }, from: 'Admin office window' },
    deliver: { details: { item: '' }, from: 'Main Gate' },
    supplies: { details: { items: '' }, from: 'School supplies store near campus', budget: '' },
    medicine: { details: { items: '' }, from: 'Pharmacy near Main Gate', budget: '' },
  };
  const SAMPLES = {
    print: { details: { file: 'Marketing_Plan_Final.pdf', pages: 10, copies: 2, color: 'bw', size: 'Short', staple: true }, to: 'Room 204', neededIn: 45 },
    food: { details: { items: '1 siomai rice, 1 iced tea (less ice)' }, budget: 90, to: 'Library 2nd floor', neededIn: 60 },
    fetch: { details: { item: 'My blue umbrella under the 2nd-row chair', contact: '' }, from: 'Room 311', to: 'Canteen', neededIn: 60 },
    deliver: { details: { item: 'Org banner, rolled in a tube' }, from: 'Student lounge', to: 'Covered court', neededIn: 60 },
    supplies: { details: { items: '2 blue books, 1 long plastic folder' }, budget: 60, to: 'Room 412', neededIn: 60 },
    medicine: { details: { items: 'Paracetamol 500 mg (1 strip)' }, budget: 40, to: 'Library entrance', neededIn: 45 },
  };
  const WHEN = [[45, 'Before my next class', '~45 min'], [60, 'Within 1 hour', ''], [120, 'Within 2 hours', '']];

  function fresh(type) {
    const d = DEFAULTS[type];
    return { step: 1, type, details: Object.assign({}, d.details), from: d.from, to: '', neededIn: 60, time: '', rush: false,
      fee: C.ERRAND_TYPES[type].fee, budget: d.budget != null ? d.budget : 0, note: '', errors: {} };
  }
  function titleOf(st) {
    const d = st.details;
    const first = (s) => String(s || '').split(/[,\n]/)[0].trim();
    let t;
    if (st.type === 'print') t = 'Print ' + (d.file || 'my document');
    else if (st.type === 'fetch') t = 'Get: ' + first(d.item);
    else if (st.type === 'deliver') t = 'Deliver: ' + first(d.item);
    else t = String(d.items || '').replace(/\n/g, ', ').trim() || C.ERRAND_TYPES[st.type].short;
    return t.length > 60 ? t.slice(0, 57) + '…' : t;
  }
  function neededBy(st) {
    if (st.neededIn === 'custom' && st.time) {
      const [h, m] = st.time.split(':').map(Number);
      const d = new Date(U.now());
      d.setHours(h, m, 0, 0);
      if (d.getTime() < U.now()) d.setTime(d.getTime() + U.DAY);
      return d.getTime();
    }
    return U.now() + (Number(st.neededIn) || 60) * U.MIN;
  }
  const draftOf = (st) => ({ kind: 'errand', input: { type: st.type, fee: st.fee, rush: st.rush, details: st.details, budget: st.budget } });

  G.views.errandNew = {
    title: 'Request an errand', back: true, tab: 'home',
    async mount(ctx) {
      const type = C.ERRAND_TYPES[ctx.query.type] ? ctx.query.type : 'print';
      let st = fresh(type);

      function stepper() {
        return html`<ol class="steps" aria-label="Steps">
          ${['What', 'Where & when', 'Review'].map((l, i) => html`<li class="${st.step === i + 1 ? 'is-now' : st.step > i + 1 ? 'is-done' : ''}" ${st.step === i + 1 ? html`aria-current="step"` : ''}><span>${i + 1}</span>${l}</li>`)}
        </ol>`;
      }
      const err = (k) => (st.errors[k] ? html`<span class="error-text">${st.errors[k]}</span>` : '');

      function fieldsWhat() {
        const d = st.details;
        const t = st.type;
        if (t === 'print') {
          return html`
            <div class="field"><span class="label">File to print</span>
              <div class="file-pick">
                <label class="btn btn-soft btn-sm">${UI.ic('upload', { size: 16 })} Choose file<input type="file" name="file-pick" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" class="sr-only"></label>
                <span class="file-name ${d.file ? '' : 'muted'}">${d.file || 'No file chosen'}</span>
              </div>
              <span class="hint">Only your go-runner can open it, and it’s deleted 24 hours after delivery. (Demo: the file never leaves your device.)</span>${err('file')}
            </div>
            <div class="field-row">
              <label class="field"><span class="label">Pages</span><input class="input" type="number" name="pages" min="1" max="500" inputmode="numeric" value="${d.pages}">${err('pages')}</label>
              <label class="field"><span class="label">Copies</span><input class="input" type="number" name="copies" min="1" max="20" inputmode="numeric" value="${d.copies}"></label>
            </div>
            <fieldset class="seg"><legend>Color</legend>
              <label><input type="radio" name="color" value="bw" ${d.color === 'bw' ? 'checked' : ''}><span>B&amp;W · ${UI.money(C.PRINT_COST.bw)}/page</span></label>
              <label><input type="radio" name="color" value="color" ${d.color === 'color' ? 'checked' : ''}><span>Color · ${UI.money(C.PRINT_COST.color)}/page</span></label>
            </fieldset>
            <fieldset class="seg"><legend>Paper size</legend>
              ${['Short', 'Long', 'A4'].map((s) => html`<label><input type="radio" name="size" value="${s}" ${d.size === s ? 'checked' : ''}><span>${s}</span></label>`)}
            </fieldset>
            <label class="check"><input type="checkbox" name="staple" ${d.staple ? 'checked' : ''}><span>Staple each set</span></label>`;
        }
        if (t === 'fetch' || t === 'deliver') {
          return html`<label class="field"><span class="label">${t === 'fetch' ? 'What should they get?' : 'What are they carrying?'}</span>
              <input class="input" name="item" value="${d.item}" placeholder="${t === 'fetch' ? 'e.g. My ID from the Admin office window' : 'e.g. A folder for Sir Cruz'}">${err('item')}</label>
            ${t === 'fetch' ? html`<label class="field"><span class="label">Who hands it over? <span class="opt">(optional)</span></span>
              <input class="input" name="contact" value="${d.contact}" placeholder="First name only"></label>` : ''}`;
        }
        return html`<label class="field"><span class="label">What should they buy?</span>
            <textarea class="textarea" name="items" rows="3" placeholder="${t === 'food' ? 'e.g. 1 chicken rice meal, 1 iced tea' : t === 'medicine' ? 'e.g. Paracetamol 500 mg (1 strip)' : 'e.g. 2 blue books'}">${d.items}</textarea>${err('items')}</label>
          <label class="field"><span class="label">Item budget</span>
            <span class="input-group"><span class="prefix">₱</span><input class="input" type="number" name="budget" min="1" max="${C.ITEM_BUDGET_MAX}" inputmode="numeric" value="${st.budget || ''}"></span>
            <span class="hint">Your go-runner pays at the store and gets reimbursed from this. Unused budget comes back to you. Pilot limit: ${UI.money(C.ITEM_BUDGET_MAX)}.</span>${err('budget')}</label>
          ${t === 'medicine' ? html`<div class="notice notice-warn">${UI.ic('pill', { size: 18 })}<span>Over-the-counter medicine only. Go-runners can’t buy prescription medicine.</span></div>` : ''}`;
      }

      function fieldsWhere() {
        const fromList = ['print', 'food', 'supplies', 'medicine'].includes(st.type) ? C.SPOTS.near.concat(C.SPOTS.campus) : C.SPOTS.campus;
        const fromLabel = st.type === 'print' ? 'Where to print' : ['food', 'supplies', 'medicine'].includes(st.type) ? 'Where to buy' : 'Pick up from';
        return html`
          <label class="field"><span class="label">${fromLabel}</span>
            <select class="select" name="from">${fromList.map((s) => html`<option ${st.from === s ? 'selected' : ''}>${s}</option>`)}</select></label>
          <label class="field"><span class="label">Bring it to</span>
            <select class="select" name="to"><option value="">Choose a spot on campus</option>${C.SPOTS.campus.map((s) => html`<option ${st.to === s ? 'selected' : ''}>${s}</option>`)}</select>
            <span class="hint">Public spots and classrooms only. Go-runners never enter dorms or private rooms.</span>${err('to')}</label>
          <fieldset class="seg"><legend>Needed by</legend>
            ${WHEN.map(([v, l, sub]) => html`<label><input type="radio" name="neededIn" value="${v}" ${String(st.neededIn) === String(v) ? 'checked' : ''}><span>${l}${sub ? html` <span class="muted">${sub}</span>` : ''}</span></label>`)}
            <label><input type="radio" name="neededIn" value="custom" ${st.neededIn === 'custom' ? 'checked' : ''}><span>Pick a time</span></label>
          </fieldset>
          ${st.neededIn === 'custom' ? html`<label class="field"><span class="label">Time</span><input class="input" type="time" name="time" value="${st.time}" min="07:00" max="19:00"><span class="hint">Pilot hours are 7 AM to 7 PM.</span></label>` : ''}
          <fieldset class="seg"><legend>Speed</legend>
            <label><input type="radio" name="rush" value="0" ${st.rush ? '' : 'checked'}><span>Standard</span></label>
            <label><input type="radio" name="rush" value="1" ${st.rush ? 'checked' : ''}><span>${UI.ic('zap', { size: 14 })} Rush · within 30 min · +${UI.money(C.RUSH_FEE)}</span></label>
          </fieldset>
          <label class="field"><span class="label">Note for your go-runner <span class="opt">(optional)</span></span>
            <textarea class="textarea" name="note" rows="2" placeholder="e.g. Please keep the receipt">${st.note}</textarea></label>`;
      }

      function review() {
        const q = G.store.sync.quote(draftOf(st));
        const t = C.ERRAND_TYPES[st.type];
        return html`
          <div class="card card-pad review-card">
            <div class="row"><span class="orow-icon">${UI.ic(t.icon, { size: 22 })}</span><div class="grow"><strong>${titleOf(st)}</strong><div class="small muted">${t.label}</div></div></div>
            <dl class="kv mt-3">
              <dt>From</dt><dd>${st.from}</dd>
              <dt>To</dt><dd>${st.to}</dd>
              <dt>Needed by</dt><dd>${U.fmtTime(neededBy(st))}${st.rush ? ' · Rush' : ''}</dd>
              ${st.type === 'print' ? html`<dt>Print</dt><dd>${U.plural(Number(st.details.pages) || 0, 'page')} × ${st.details.copies}, ${st.details.color === 'color' ? 'color' : 'B&W'}, ${st.details.size}${st.details.staple ? ', stapled' : ''}</dd>` : ''}
            </dl>
          </div>
          <div class="field mt-4"><span class="label">Your errand fee</span>
            <div class="row-between fee-row">
              <div class="stepper" role="group" aria-label="Errand fee">
                <button type="button" data-fee="-5" aria-label="Lower the fee by 5 pesos">−</button><output aria-live="polite">${UI.money(st.fee)}</output><button type="button" data-fee="5" aria-label="Raise the fee by 5 pesos">+</button>
              </div>
              <span class="small muted">Suggested ${UI.money(t.fee)}. Offering more gets it done faster.</span>
            </div>
          </div>
          <ul class="breakdown card card-pad">
            ${q.lines.map(([l, v]) => html`<li><span>${l}</span><span>${UI.money(v)}</span></li>`)}
            <li class="total"><span>Total</span><span>${UI.money(q.total)}</span></li>
          </ul>
          <p class="small muted mt-3">${UI.ic('shield-check', { size: 15 })} Pay with GCash and Gopher holds it until your go-runner enters your hand-off code. Free to cancel until someone accepts.</p>
          <details class="not-allowed"><summary>What go-runners can’t do</summary><ul>${C.NOT_ALLOWED.map((x) => html`<li>${x}</li>`)}</ul></details>`;
      }

      function draw() {
        const q = G.store.sync.quote(draftOf(st));
        ctx.render(html`<div class="page wizard" data-view="errand-new">
          <h1 class="sr-only">Request an errand</h1>
          ${stepper()}
          <form class="wizard-body" data-form="errand" novalidate>
            ${st.step === 1 ? html`
              <div class="type-grid" role="radiogroup" aria-label="Type of errand">
                ${C.ERRAND_ORDER.map((k) => {
                  const t = C.ERRAND_TYPES[k];
                  return html`<label class="type-card ${st.type === k ? 'is-on' : ''}"><input type="radio" name="type" value="${k}" ${st.type === k ? 'checked' : ''} class="sr-only">
                    ${UI.ic(t.icon, { size: 22 })}<span>${t.label}</span><small>from ${UI.money(t.fee)}</small></label>`;
                })}
              </div>
              <div class="row-between mt-4"><h2 class="h-step">${C.ERRAND_TYPES[st.type].label}</h2>
                <button type="button" class="btn btn-dashed btn-sm" data-action="sample">${UI.ic('sparkles', { size: 15 })} Use sample</button></div>
              ${fieldsWhat()}` : ''}
            ${st.step === 2 ? fieldsWhere() : ''}
            ${st.step === 3 ? review() : ''}
          </form>
          <div class="actionbar">
            <div class="actionbar-total"><span class="xsmall muted">Estimated total</span><strong data-region="total">${UI.money(q.total)}</strong></div>
            ${st.step > 1 ? html`<button type="button" class="btn btn-ghost" data-action="prev">Back</button>` : ''}
            <button type="button" class="btn btn-primary" data-action="next">${st.step === 3 ? 'Continue to payment' : 'Next'}</button>
          </div>
        </div>`);
      }

      function readForm() {
        const form = ctx.root.querySelector('form[data-form="errand"]');
        if (!form) return;
        const d = U.formData(form);
        if (st.step === 1) {
          if (d.type && d.type !== st.type) { st = Object.assign(fresh(d.type), { step: 1 }); return 'retype'; }
          const det = st.details;
          if (st.type === 'print') {
            det.pages = d.pages; det.copies = Math.max(1, parseInt(d.copies, 10) || 1);
            det.color = d.color || 'bw'; det.size = d.size || 'Short'; det.staple = !!d.staple;
          } else if (st.type === 'fetch' || st.type === 'deliver') {
            det.item = d.item || ''; if (st.type === 'fetch') det.contact = d.contact || '';
          } else {
            det.items = d.items || ''; st.budget = Math.max(0, Math.round(Number(d.budget) || 0));
          }
        } else if (st.step === 2) {
          st.from = d.from || st.from; st.to = d.to || '';
          st.neededIn = d.neededIn === 'custom' ? 'custom' : Number(d.neededIn) || 60;
          st.time = d.time || st.time; st.rush = d.rush === '1'; st.note = d.note || '';
        }
      }
      function validate() {
        const e = {};
        const d = st.details;
        if (st.step === 1) {
          if (st.type === 'print') {
            if (!d.file) e.file = 'Choose the file to print (or tap Use sample).';
            if (!(parseInt(d.pages, 10) >= 1)) e.pages = 'How many pages?';
          } else if (st.type === 'fetch' || st.type === 'deliver') {
            if (String(d.item || '').trim().length < 3) e.item = 'Describe the item.';
          } else {
            if (String(d.items || '').trim().length < 3) e.items = 'List what to buy.';
            if (!(st.budget >= 1)) e.budget = 'Set a budget for the items.';
            else if (st.budget > C.ITEM_BUDGET_MAX) e.budget = 'The pilot limit is ' + UI.money(C.ITEM_BUDGET_MAX) + '.';
          }
        } else if (st.step === 2) {
          if (!st.to) e.to = 'Choose where to bring it.';
        }
        st.errors = e;
        return !Object.keys(e).length;
      }
      function refreshTotal() {
        const q = G.store.sync.quote(draftOf(st));
        ctx.region('total', UI.money(q.total));
      }

      draw();
      ctx.on('input', 'form[data-form="errand"]', () => { if (readForm() === 'retype') draw(); else refreshTotal(); });
      ctx.on('change', 'form[data-form="errand"]', (e) => {
        if (e.target.name === 'file-pick') {
          const f = e.target.files && e.target.files[0];
          if (f) { st.details.file = f.name; draw(); }
          return;
        }
        const r = readForm();
        if (r === 'retype' || e.target.name === 'neededIn') draw(); else refreshTotal();
      });
      ctx.on('click', '[data-action="sample"]', () => {
        const s = SAMPLES[st.type];
        st.details = Object.assign({}, st.details, s.details);
        if (s.budget != null) st.budget = s.budget;
        if (s.from) st.from = s.from;
        if (s.to) st.to = s.to;
        if (s.neededIn) st.neededIn = s.neededIn;
        st.errors = {};
        draw();
      });
      ctx.on('click', '[data-fee]', (e, el) => {
        const min = C.ERRAND_TYPES[st.type].fee;
        st.fee = Math.max(min, Math.min(min + 100, st.fee + Number(el.dataset.fee)));
        draw();
      });
      ctx.on('click', '[data-action="prev"]', () => { readForm(); st.step = Math.max(1, st.step - 1); st.errors = {}; draw(); });
      ctx.on('click', '[data-action="next"]', async () => {
        readForm();
        if (!validate()) {
          draw();
          const first = ctx.root.querySelector('.error-text');
          if (first) first.scrollIntoView({ block: 'center' });
          return;
        }
        if (st.step < 3) { st.step += 1; draw(); document.getElementById('view').scrollTop = 0; return; }
        try {
          const id = await G.store.createDraft('errand', {
            type: st.type, title: titleOf(st), details: st.details, from: st.from, to: st.to,
            neededBy: neededBy(st), rush: st.rush, fee: st.fee, budget: st.budget, note: st.note,
          });
          ctx.go('/checkout/' + id);
        } catch (e) { UI.errorToast(e); }
      });
    },
  };
})(window.Gopher = window.Gopher || {});
