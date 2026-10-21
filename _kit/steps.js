/* Deep Dive kit · steps.js
   Scroll/step engine. No dependencies.

   Markup:
     <section data-step="intro">…</section>     a step; animates in, tracked as "active"
     <div data-reveal>…</div>                    animates in when scrolled into view
       data-reveal="fade|zoom|left|right|pop"    variants; data-delay="200" (ms) overrides stagger
     <p data-reveal="next">…</p>                 fragment inside a step: hidden until Next / tap / →
     <section data-step data-step-tap>           tapping the step reveals its next fragment
     <button data-next>…</button>                custom "next fragment" button inside a step
     <body data-step-nav>                        adds floating Next/Prev nav + reading progress bar

   Events (bubble to document):
     kit:step    {index, id, el, prev, direction}   active step changed
     kit:enter / kit:leave  (dispatched on the step element, same detail)
     kit:reveal  {el, step, fragment}               a [data-reveal] element was revealed

   API: Kit.steps.next() .prev() .goTo(indexOrId) .reveal(el) .on(indexOrId, fn) .list .current
   Keys: → next (fragment, then step), ← previous step. Ignored while typing / on sliders. */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var doc = document, root = doc.documentElement;
  root.classList.add('js');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var steps = [], current = -1, handlers = [], nav = null, inited = false;

  function emit(target, name, detail) {
    target.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true }));
  }

  function reveal(el, delay) {
    if (el.classList.contains('is-in')) return;
    if (delay) el.style.setProperty('--d', delay + 'ms');
    el.classList.add('is-in');
    var step = el.closest('[data-step]');
    emit(el, 'kit:reveal', { el: el, step: step, fragment: el.getAttribute('data-reveal') === 'next' });
  }

  function find(ref) {
    if (typeof ref === 'number') return ref;
    for (var i = 0; i < steps.length; i++) if (steps[i].id === ref) return i;
    return -1;
  }

  /* ---- fragments ---- */
  function pending(s) {
    return s.frags.filter(function (f) { return !f.classList.contains('is-in'); });
  }
  function advanceFragment(s) {
    var p = pending(s);
    if (!p.length) return false;
    reveal(p[0]);
    syncMore(s);
    updateNav();
    return true;
  }
  function syncMore(s) {
    var left = pending(s).length;
    if (s.more) s.more.hidden = !left;
    s.el.classList.toggle('has-pending', !!left);
  }
  function revealAll(s) {
    pending(s).forEach(function (f) { reveal(f); });
    syncMore(s);
  }

  /* ---- active step ---- */
  function setActive(i) {
    if (i === current || i < 0 || i >= steps.length) return;
    var prev = current, old = steps[prev];
    current = i;
    var s = steps[i];
    var detail = { index: i, id: s.id, el: s.el, prev: prev, direction: i > prev ? 1 : -1 };
    if (old) { old.el.classList.remove('is-active'); emit(old.el, 'kit:leave', detail); }
    s.el.classList.add('is-active');
    reveal(s.el);
    emit(s.el, 'kit:enter', detail);
    emit(doc, 'kit:step', detail);
    handlers.forEach(function (h) { if (find(h.ref) === i) h.fn(detail); });
    updateNav();
  }

  function goTo(ref) {
    var i = find(ref);
    if (i < 0 || i >= steps.length) return;
    var el = steps[i].el;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    setActive(i);
  }
  function next() {
    if (current >= 0 && advanceFragment(steps[current])) return;
    goTo(current + 1);
  }
  function prev() { goTo(Math.max(0, current - 1)); }

  /* ---- floating nav ---- */
  function buildNav() {
    if (!doc.body.hasAttribute('data-step-nav') || !steps.length) return;
    var bar = doc.createElement('div');
    bar.className = 'step-progress';
    bar.setAttribute('aria-hidden', 'true');
    nav = doc.createElement('nav');
    nav.className = 'step-nav';
    nav.setAttribute('aria-label', 'Step navigation');
    nav.innerHTML = '<button type="button" class="step-prev" aria-label="Previous step">↑</button>' +
      '<span class="step-count" aria-live="polite"></span>' +
      '<button type="button" class="step-next">Next ↓</button>';
    nav.querySelector('.step-prev').addEventListener('click', prev);
    nav.querySelector('.step-next').addEventListener('click', next);
    doc.body.appendChild(bar);
    doc.body.appendChild(nav);
    var ticking = false;
    function progress() {
      ticking = false;
      var max = root.scrollHeight - innerHeight;
      bar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0);
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(progress); } }, { passive: true });
    progress();
    updateNav();
  }
  function updateNav() {
    if (!nav) return;
    var s = steps[current];
    var more = s && pending(s).length;
    nav.querySelector('.step-count').textContent = Math.max(1, current + 1) + ' / ' + steps.length;
    nav.querySelector('.step-prev').disabled = current <= 0;
    var n = nav.querySelector('.step-next');
    n.textContent = more ? 'Show more ▸' : 'Next ↓';
    n.disabled = !more && current >= steps.length - 1;
  }

  /* ---- init ---- */
  function init() {
    if (inited) return;
    inited = true;

    // Generic reveals (not fragments), staggered when several arrive together.
    var revealIO = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = e.target.getAttribute('data-delay');
        reveal(e.target, d != null ? +d : Math.min(n++, 5) * 90);
        revealIO.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    doc.querySelectorAll('[data-reveal]:not([data-reveal=next])').forEach(function (el) { revealIO.observe(el); });

    // Steps
    doc.querySelectorAll('[data-step]').forEach(function (el, i) {
      var name = el.getAttribute('data-step');
      var s = { el: el, index: i, id: el.id || name || 'step-' + (i + 1), frags: [].slice.call(el.querySelectorAll('[data-reveal=next]')), more: null };
      el.setAttribute('data-step-index', i);
      if (s.frags.length) {
        s.more = el.querySelector('[data-next]');
        if (!s.more) {
          s.more = doc.createElement('button');
          s.more.type = 'button';
          s.more.className = 'btn accent step-more';
          s.more.textContent = 'Next ▸';
          var last = s.frags[s.frags.length - 1];
          var anchor = last.parentNode.matches('ul,ol,dl') ? last.parentNode : last;
          anchor.parentNode.insertBefore(s.more, anchor.nextSibling);
        }
        s.more.addEventListener('click', function (ev) { ev.stopPropagation(); setActive(i); advanceFragment(s); });
        syncMore(s);
      }
      if (el.hasAttribute('data-step-tap')) {
        el.addEventListener('click', function (ev) {
          if (ev.target.closest('a,button,input,select,textarea,label,summary,[data-no-tap]')) return;
          if (getSelection && String(getSelection())) return;
          setActive(i);
          advanceFragment(s);
        });
      }
      steps.push(s);
    });

    // Fade steps in on entry; reveal leftover fragments once a step is scrolled past (scroll-only readers).
    var enterIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = steps[+e.target.getAttribute('data-step-index')];
        if (e.isIntersecting) reveal(s.el);
        else if (e.boundingClientRect.bottom < 0) revealAll(s);
      });
    }, { threshold: 0.06 });

    // Active step = the one crossing a reading line ~25% down the viewport.
    var activeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) setActive(+e.target.getAttribute('data-step-index'));
      });
    }, { rootMargin: '-25% 0px -74% 0px' });

    steps.forEach(function (s) { enterIO.observe(s.el); activeIO.observe(s.el); });

    doc.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var t = doc.activeElement;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });

    buildNav();
  }

  Kit.steps = {
    next: next, prev: prev, goTo: goTo, reveal: reveal, init: init,
    /** Run fn(detail) whenever step (index or id) becomes active. */
    on: function (ref, fn) { handlers.push({ ref: ref, fn: fn }); if (find(ref) === current && current >= 0) fn({ index: current, id: steps[current].id, el: steps[current].el, prev: -1, direction: 1 }); },
    get list() { return steps.map(function (s) { return s.el; }); },
    get current() { return current; }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
