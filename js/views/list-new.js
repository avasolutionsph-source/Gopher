/* List an item: rent out gear, or share notes/books (with an originality
 * declaration and a quick review before going live). */
(function (G) {
  'use strict';
  const C = G.config, U = G.util, UI = G.ui, html = U.html;
  G.views = G.views || {};

  const SAMPLES = {
    rental: { cat: 'tech', title: 'Ring light 10" with stand', desc: 'Three light modes, USB powered, with a phone holder. Stand extends to 1.6 m.', price: 50, value: 1200, condition: 'Very good', spot: 'Student lounge', icon: 'lightbulb' },
    academic: { cat: 'reviewer', format: 'digital', subject: 'Engineering Mechanics', title: 'Statics Prelim Reviewer with solved problems', desc: 'Free-body diagrams, equilibrium and trusses, with 25 problems I solved step by step.', price: 45, pages: 20, icon: 'file-text' },
  };

  // Deposit rule: items worth ₱1,000+ → about 20% of the value, rounded to ₱50 (₱100–₱1,500).
  function suggestDeposit(value) {
    const v = Number(value) || 0;
    if (v < 1000) return 0;
    return Math.max(100, Math.min(1500, Math.round((v * 0.2) / 50) * 50));
  }

  // A clean sample photo drawn on a canvas from the icon's own path data (no external image).
  function samplePhoto(iconName) {
    const size = 480;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#E1F0FD'); grad.addColorStop(1, '#93CCF9');
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.arc(size / 2, size / 2 + 10, 150, 0, Math.PI * 2); g.fill();
    const tmp = document.createElement('div');
    tmp.innerHTML = G.icon(iconName, { size: 24 });
    const svg = tmp.firstChild;
    g.save();
    g.translate(size / 2 - 120, size / 2 - 110);
    g.scale(10, 10);
    g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0F3F66';
    svg.querySelectorAll('path,circle,rect,line,polyline,ellipse').forEach((n) => {
      let d = n.getAttribute('d');
      const a = (k) => Number(n.getAttribute(k) || 0);
      if (!d && n.tagName === 'circle') d = `M ${a('cx') - a('r')} ${a('cy')} a ${a('r')} ${a('r')} 0 1 0 ${a('r') * 2} 0 a ${a('r')} ${a('r')} 0 1 0 ${-a('r') * 2} 0`;
      if (!d && n.tagName === 'rect') { const r = a('rx'); d = `M ${a('x') + r} ${a('y')} h ${a('width') - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${a('height') - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(a('width') - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(a('height') - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} z`; }
      if (!d && n.tagName === 'line') d = `M ${a('x1')} ${a('y1')} L ${a('x2')} ${a('y2')}`;
      if (!d && n.tagName === 'polyline') d = 'M ' + n.getAttribute('points');
      if (d) g.stroke(new Path2D(d));
    });
    g.restore();
    return c.toDataURL('image/jpeg', 0.8);
  }

  G.views.listNew = {
    title: 'List an item', back: true, tab: 'profile',
    async mount(ctx) {
      let kind = ctx.query.kind === 'academic' ? 'academic' : 'rental';
      const st = { rental: { cat: 'tech', condition: 'Good', spot: 'Library entrance' }, academic: { cat: 'reviewer', format: 'digital', mode: 'buy' } };
      let photo = null;
      let errors = {};

      function draw() {
        const v = st[kind];
        const err = (k) => (errors[k] ? html`<span class="error-text">${errors[k]}</span>` : '');
        const hint = kind === 'rental' ? C.RATE_HINTS[v.cat] : null;
        const dep = kind === 'rental' ? (v.deposit != null ? v.deposit : suggestDeposit(v.value)) : 0;
        ctx.render(html`<div class="page listnew" data-view="list-new">
          <h1 class="h-page">${kind === 'rental' ? 'Rent out an item' : 'Share notes or a book'}</h1>
          <div class="tabs" role="tablist" aria-label="What are you listing?">
            <button type="button" role="tab" aria-selected="${String(kind === 'rental')}" data-kind="rental">${UI.ic('umbrella', { size: 16 })}Item for rent</button>
            <button type="button" role="tab" aria-selected="${String(kind === 'academic')}" data-kind="academic">${UI.ic('book-open', { size: 16 })}Notes or book</button>
          </div>
          <div class="row-between mt-4"><p class="small muted mb-0">${kind === 'rental' ? 'Earn from things you don’t use every day.' : 'Earn from reviewers and notes you made yourself.'}</p>
            <button type="button" class="btn btn-dashed btn-sm" data-action="sample">${UI.ic('sparkles', { size: 15 })} Use sample</button></div>

          <form class="mt-4" data-form="listing" novalidate>
            ${kind === 'rental' ? html`
              <label class="field"><span class="label">Category</span>
                <select class="select" name="cat">${Object.entries(C.RENTAL_CATS).map(([k, c]) => html`<option value="${k}" ${v.cat === k ? 'selected' : ''}>${c.label}</option>`)}</select></label>`
            : html`
              <label class="field"><span class="label">Type</span>
                <select class="select" name="cat">${Object.entries(C.ACADEMIC_CATS).map(([k, c]) => html`<option value="${k}" ${v.cat === k ? 'selected' : ''}>${c.label.replace(/s$/, '')}</option>`)}</select></label>
              <fieldset class="seg"><legend>Format</legend>
                ${[['digital', 'Digital (PDF)'], ['printed', 'Printed copy'], ['book', 'Physical book']].map(([k, l]) => html`<label><input type="radio" name="format" value="${k}" ${v.format === k ? 'checked' : ''}><span>${l}</span></label>`)}
              </fieldset>
              <label class="field"><span class="label">Subject</span><input class="input" name="subject" value="${v.subject || ''}" placeholder="e.g. Financial Accounting 1"></label>`}

            <label class="field"><span class="label">Title</span><input class="input" name="title" maxlength="90" value="${v.title || ''}" placeholder="${kind === 'rental' ? 'e.g. Scientific calculator (Casio fx-991)' : 'e.g. FA1 Midterm Reviewer'}">${err('title')}</label>
            <label class="field"><span class="label">Description</span><textarea class="textarea" name="desc" rows="3" maxlength="600" placeholder="What’s included? Any rules?">${v.desc || ''}</textarea></label>

            ${kind === 'rental' || v.format !== 'digital' ? html`<div class="field"><span class="label">Photo <span class="opt">(optional)</span></span>
              <div class="photo-pick">
                <span class="photo-prev">${photo ? html`<img src="${photo}" alt="Your photo">` : UI.ic('image', { size: 28 })}</span>
                <label class="btn btn-soft btn-sm">${UI.ic('upload', { size: 16 })} ${photo ? 'Change' : 'Add a photo'}<input type="file" name="photo-pick" accept="image/*" class="sr-only"></label>
                ${photo ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="clear-photo">Remove</button>` : ''}
              </div><span class="hint">We shrink photos on your device before saving.</span></div>` : ''}

            ${kind === 'academic' && v.format !== 'book' ? html`<label class="field"><span class="label">Pages</span><input class="input" type="number" name="pages" min="1" max="400" inputmode="numeric" value="${v.pages || ''}"></label>` : ''}

            ${kind === 'academic' && v.format === 'book' ? html`<fieldset class="seg"><legend>Offer it as</legend>
              <label><input type="radio" name="mode" value="rent" ${v.mode === 'rent' ? 'checked' : ''}><span>Borrow per week</span></label>
              <label><input type="radio" name="mode" value="buy" ${v.mode !== 'rent' ? 'checked' : ''}><span>Sell</span></label></fieldset>` : ''}

            <div class="field-row">
              <label class="field"><span class="label">${kind === 'rental' ? 'Price per day' : v.format === 'book' && v.mode === 'rent' ? 'Price per week' : 'Price'}</span>
                <span class="input-group"><span class="prefix">₱</span><input class="input" type="number" name="price" min="1" max="2000" inputmode="numeric" value="${v.price || ''}"></span>
                ${hint ? html`<span class="hint">Students usually pay ${UI.money(hint[0])}–${UI.money(hint[1])} a day.</span>` : kind === 'academic' ? html`<span class="hint">Reviewers usually sell for ₱30–₱80.</span>` : ''}${err('price')}</label>
              ${kind === 'rental' ? html`<label class="field"><span class="label">Item value</span>
                <span class="input-group"><span class="prefix">₱</span><input class="input" type="number" name="value" min="0" inputmode="numeric" value="${v.value || ''}"></span>
                <span class="hint">Used for the deposit.</span></label>` : ''}
            </div>
            ${kind === 'rental' ? html`<label class="field"><span class="label">Refundable deposit</span>
                <span class="input-group"><span class="prefix">₱</span><input class="input" type="number" name="deposit" min="0" max="5000" inputmode="numeric" value="${dep}"></span>
                <span class="hint">${C.DEPOSIT_RULE}</span></label>
              <label class="field"><span class="label">Condition</span>
                <select class="select" name="condition">${['Like new', 'Very good', 'Good', 'Fair'].map((c) => html`<option ${v.condition === c ? 'selected' : ''}>${c}</option>`)}</select></label>` : ''}
            ${kind === 'rental' || v.format !== 'digital' ? html`<label class="field"><span class="label">Meetup spot</span>
              <select class="select" name="spot">${C.SPOTS.meetup.map((s) => html`<option ${(v.spot || 'Library entrance') === s ? 'selected' : ''}>${s}</option>`)}</select>
              <span class="hint">Public campus spots only.</span></label>` : ''}

            ${kind === 'academic' ? html`<fieldset class="declare card card-pad"><legend class="label">Originality declaration</legend>
              <label class="check"><input type="checkbox" name="own" ${v.own ? 'checked' : ''}><span>${v.format === 'book' ? 'This is my own copy of the book.' : 'I made these notes myself.'}</span></label>
              <label class="check"><input type="checkbox" name="clean" ${v.clean ? 'checked' : ''}><span>No exam answer keys, graded work, or copied textbook pages.</span></label>
              ${err('declare')}
              <p class="xsmall muted mb-0">We check new notes before they go live. Listings reported as copied are hidden while we review them.</p>
            </fieldset>` : ''}
            <button class="btn btn-primary btn-block btn-lg mt-4" type="submit">${kind === 'academic' ? 'Submit for review' : 'Publish listing'}</button>
          </form>
        </div>`);
      }
      function read() {
        const form = ctx.root.querySelector('form[data-form="listing"]');
        if (!form) return;
        const d = U.formData(form);
        const v = st[kind];
        ['cat', 'title', 'desc', 'subject', 'condition', 'spot', 'format', 'mode'].forEach((k) => { if (k in d) v[k] = d[k]; });
        ['price', 'pages', 'value'].forEach((k) => { if (k in d) v[k] = d[k] === '' ? '' : Number(d[k]); });
        if ('deposit' in d) v.deposit = d.deposit === '' ? null : Number(d.deposit);
        if (kind === 'academic') { v.own = !!d.own; v.clean = !!d.clean; }
      }

      draw();
      ctx.setTitle('List an item');
      ctx.on('click', '[data-kind]', (e, el) => { read(); kind = el.dataset.kind; errors = {}; photo = null; draw(); });
      ctx.on('change', 'form[data-form="listing"]', async (e) => {
        if (e.target.name === 'photo-pick') {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          try { photo = await U.resizeImage(f, 640, 0.72); read(); draw(); } catch (err) { UI.errorToast(err); }
          return;
        }
        const before = st[kind].format + '|' + st[kind].mode + '|' + st[kind].value;
        read();
        if (e.target.name === 'value') st[kind].deposit = null; // re-suggest the deposit
        if (before !== st[kind].format + '|' + st[kind].mode + '|' + st[kind].value) draw();
      });
      ctx.on('click', '[data-action="clear-photo"]', () => { photo = null; read(); draw(); });
      ctx.on('click', '[data-action="sample"]', () => {
        const smp = SAMPLES[kind];
        Object.assign(st[kind], smp, kind === 'academic' ? { own: true, clean: true } : { deposit: null });
        try { photo = kind === 'rental' ? samplePhoto(smp.icon) : null; } catch (err) { photo = null; }
        errors = {};
        draw();
      });
      ctx.on('submit', 'form[data-form="listing"]', async (e) => {
        e.preventDefault();
        read();
        const v = st[kind];
        errors = {};
        if (!v.title || String(v.title).trim().length < 4) errors.title = 'Add a title (at least 4 characters).';
        if (!(Number(v.price) >= 1)) errors.price = 'Set a price.';
        if (kind === 'academic' && !(v.own && v.clean)) errors.declare = 'Please confirm both statements to list notes.';
        if (Object.keys(errors).length) { draw(); const f = ctx.root.querySelector('.error-text'); if (f) f.scrollIntoView({ block: 'center' }); return; }
        try {
          const l = await G.store.createListing({
            kind, cat: v.cat, title: v.title, desc: v.desc, subject: v.subject, format: v.format, mode: v.mode,
            price: v.price, pages: v.pages, value: v.value, deposit: kind === 'rental' ? (v.deposit != null ? v.deposit : suggestDeposit(v.value)) : 0,
            condition: v.condition, spot: v.spot, photo,
          });
          UI.toast(l.status === 'review' ? 'Submitted! We’ll check it’s original, usually within minutes.' : 'Your listing is live in Explore.', { icon: 'circle-check' });
          if (l.photoFailed) UI.toast('Storage is full, so the photo wasn’t saved. The listing uses its category art.', { tone: 'bad' });
          ctx.go('/listing/' + l.id, {}, true);
        } catch (err) { UI.errorToast(err); }
      });
    },
  };
})(window.Gopher = window.Gopher || {});
