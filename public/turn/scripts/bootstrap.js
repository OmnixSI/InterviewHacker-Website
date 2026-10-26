// Runs in <head>, before first paint: marks script support and motion state, and opens the IH namespace
// that every other script registers with. No layout reads here.
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
  let paused = false;
  try { paused = localStorage.getItem('ih-turn-motion') === 'paused'; } catch (e) { /* storage blocked */ }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.toggle('motion-paused', paused);
  root.classList.toggle('motion-reduced', reduced);
  root.classList.toggle('motion-ok', !paused && !reduced);
  const handlers = {};
  // A repeat visit in the same tab (e.g. after switching language) gets a shorter intro.
  let firstVisit = true;
  try { firstVisit = !sessionStorage.getItem('ih-turn-seen'); sessionStorage.setItem('ih-turn-seen', '1'); } catch (e) { /* storage blocked */ }
  root.classList.toggle('is-repeat-visit', !firstVisit);
  window.IH = {
    lang: root.lang.startsWith('zh') ? 'zh' : 'en',
    paused, reduced, firstVisit,
    /** True when decorative motion may run (not reduced, not paused, tab visible). */
    motionOK() { return !this.reduced && !this.paused && !document.hidden; },
    on(type, fn) { (handlers[type] ||= []).push(fn); return () => { handlers[type] = handlers[type].filter(f => f !== fn); }; },
    emit(type, detail) { for (const fn of handlers[type] || []) { try { fn(detail); } catch (e) { console.error(e); } } },
    /** Pick the string for the page language: IH.t('中文', 'English'). */
    t(zh, en) { return this.lang === 'zh' ? zh : en; }
  };
})();
