/* Gopher — hash router. URLs look like app.html#/listing/ls_tripod?days=2
 * Each screen is a view: { title, tab, back, public, guestOnly, mount(ctx), update?(ctx, query) }.
 * The router stamps <html data-route> and <html data-view-ready> so tests can tell when a screen is done.
 */
(function (G) {
  'use strict';
  const U = G.util;
  const routes = [];
  let current = null;
  let started = false;

  function add(pattern, name, opts) {
    routes.push(Object.assign({ pattern, name, parts: pattern.split('/').filter(Boolean) }, opts || {}));
  }
  function parse(hash) {
    const h = String(hash || '').replace(/^#/, '');
    if (!h.startsWith('/')) return { path: '', query: {} };
    const i = h.indexOf('?');
    return { path: '/' + (i < 0 ? h : h.slice(0, i)).split('/').filter(Boolean).join('/'), query: U.parseQuery(i < 0 ? '' : h.slice(i + 1)) };
  }
  function match(path) {
    const segs = path.split('/').filter(Boolean);
    for (const r of routes) {
      if (r.parts.length !== segs.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < r.parts.length && ok; i++) {
        const p = r.parts[i];
        if (p[0] === ':') params[p.slice(1)] = decodeURIComponent(segs[i]);
        else if (p !== segs[i]) ok = false;
      }
      if (ok) return { route: r, params };
    }
    return null;
  }
  function href(path, query) { return '#' + path + U.toQuery(query || {}); }
  function go(path, query, replace) {
    const h = href(path, query);
    if (replace) location.replace(h);
    else if (location.hash === h) handle();
    else location.hash = h;
  }
  // In-app back arrow: browser back if we navigated inside the app, else a sensible parent.
  function back(fallback) {
    if (current && current.depth > 0) history.back();
    else go(fallback || '/home', {}, true);
  }

  function makeCtx(m, query) {
    const root = document.getElementById('view');
    const cleanups = [];
    const ctx = {
      params: m.params, query, route: m.route.name, alive: true, root,
      render(safe) { if (ctx.alive) root.innerHTML = String(safe); },
      region(name, safe) {
        const el = root.querySelector('[data-region="' + name + '"]');
        if (el && ctx.alive) el.innerHTML = String(safe);
      },
      on(type, selector, fn) { cleanups.push(U.on(root, type, selector, fn)); },
      watch(fn) {
        let queued = false;
        cleanups.push(G.store.on((evt) => {
          if (!ctx.alive || queued) return;
          queued = true; // batch several store events from one action into one redraw
          setTimeout(() => { queued = false; if (ctx.alive) fn(evt); }, 0);
        }));
      },
      interval(fn, ms) { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); },
      timeout(fn, ms) { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); },
      addCleanup(fn) { cleanups.push(fn); },
      dispose() {
        ctx.alive = false;
        cleanups.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
      },
      setTitle(t) { G.app.setTitle(t); },
      go, href,
    };
    return ctx;
  }

  async function handle() {
    const { path, query } = parse(location.hash);
    const me = G.store.sync.me();
    if (!path) { go(me ? '/home' : '/welcome', {}, true); return; }
    const m = match(path);
    const html = document.documentElement;
    if (m && !m.route.public && !me) { go('/welcome', { next: path + U.toQuery(query) }, true); return; }
    if (m && m.route.guestOnly && me) { go('/home', {}, true); return; }

    // Same screen, only the ?query changed (tabs, filters): let the view update in place.
    if (m && current && current.route === m.route && JSON.stringify(current.params) === JSON.stringify(m.params) && current.view.update) {
      current.query = query;
      current.ctx.query = query;
      await current.view.update(current.ctx, query);
      return;
    }

    if (current && current.ctx) current.ctx.dispose();
    G.ui.closeAllSheets();
    const routeName = m ? m.route.name : 'notFound';
    const view = G.views[routeName] || G.views.notFound;
    const ctx = makeCtx(m || { params: {}, route: { name: 'notFound' } }, query);
    const depth = current ? current.depth + 1 : 0;
    current = { route: m && m.route, params: m ? m.params : {}, query, view, ctx, depth };
    html.dataset.route = routeName;
    delete html.dataset.viewReady;
    G.app.frame({ title: typeof view.title === 'function' ? '' : view.title, tab: view.tab || '', back: !!view.back, route: routeName, bare: !!view.bare });
    try {
      await view.mount(ctx);
    } catch (e) {
      console.error(e);
      ctx.render(G.ui.empty({ icon: 'triangle-alert', title: 'This page couldn’t load', text: (e && e.message) || 'Something went wrong.',
        action: U.html`<a class="btn btn-primary" href="#/home">Go home</a>` }));
    }
    if (!ctx.alive) return;
    const scroller = document.getElementById('view');
    if (scroller) scroller.scrollTop = 0;
    const h1 = scroller && scroller.querySelector('h1');
    if (h1 && started) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    html.dataset.viewReady = routeName;
    started = true;
  }

  function refresh() {
    if (current && current.ctx) current.ctx.dispose();
    current = null;
    handle();
  }
  function start() {
    window.addEventListener('hashchange', handle);
    handle();
  }
  function currentView() { return current; }

  G.router = { add, start, go, back, href, refresh, parse, current: currentView };
})(window.Gopher = window.Gopher || {});
