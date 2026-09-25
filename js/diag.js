/* Gopher — error collector. Loads first (not deferred) so it also catches
 * missing files. Writes the count to <html data-errors="N"> and the latest
 * messages to data-error-list, so automated checks can read them. */
(function () {
  'use strict';
  var errors = [];
  var root = document.documentElement;
  function record(msg) {
    errors.push(String(msg).slice(0, 300));
    root.setAttribute('data-errors', String(errors.length));
    root.setAttribute('data-error-list', errors.slice(-5).join(' | '));
  }
  root.setAttribute('data-errors', '0');
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) record('failed to load: ' + (e.target.src || e.target.href));
    else record((e && e.message) || 'error');
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    record('unhandled: ' + ((r && r.message) || r));
  });
  var original = console.error;
  console.error = function () {
    try { record(Array.prototype.map.call(arguments, function (a) { return (a && a.message) || String(a); }).join(' ')); } catch (x) { /* ignore */ }
    return original.apply(console, arguments);
  };
  window.__gopherErrors = errors;
})();
