/* Deep Dive kit · glossary.js
   Inline glossary terms with a small popup: term, plain-English explainer, Bulgarian translation.
   No dependencies.

   Markup:
     <dfn class="term" data-en="Plain-English explainer, 1–2 lines" data-bg="налягане">pressure</dfn>
     <dfn class="term" data-term="crema">the crema</dfn>    data-term: lookup key if it differs from the text
     <body data-glossary="glossary.json">                   optional per-topic file (relative to the page)

   glossary.json, keyed by term (case-insensitive); it only fills attributes the markup leaves out:
     { "pressure": { "en": "How hard the water is pushed through the coffee.", "bg": "налягане" } }

   Behaviour: opens on mouse hover, on keyboard focus, and with Enter/Space; a tap toggles it on touch;
   tapping/clicking outside closes it; Esc closes it and returns focus to the term. One popup at a time.
   Terms with no explainer and no translation are left as plain text.

   API: Kit.glossary.refresh() (enhance terms added later), .open(el), .close(), .data (merged JSON) */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var doc = document;
  var GAP = 8, MARGIN = 8;

  var data = {}, tip = null, parts = {}, current = null, openedBy = null;
  var hideTimer = 0, pointerType = '', downAt = 0, quietFocus = false, ticking = false;

  function key(el) { return (el.getAttribute('data-term') || el.textContent).trim().replace(/\s+/g, ' ').toLowerCase(); }

  // Fill missing data-en / data-bg from glossary.json.
  function fill(el) {
    var d = data[key(el)];
    if (!d) return;
    if (typeof d === 'string') d = { en: d };
    if (d.en && !el.getAttribute('data-en')) el.setAttribute('data-en', d.en);
    if (d.bg && !el.getAttribute('data-bg')) el.setAttribute('data-bg', d.bg);
  }

  function build() {
    tip = doc.createElement('div');
    tip.className = 'gl-tip';
    tip.id = 'kit-gloss-' + Math.random().toString(36).slice(2, 8);
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    tip.innerHTML = '<span class="gl-term"></span><span class="gl-en"></span>' +
      '<span class="gl-bg"><span class="gl-lang" aria-hidden="true">BG</span><span class="gl-bg-text" lang="bg"></span></span>' +
      '<span class="gl-arrow" aria-hidden="true"></span>';
    parts = { term: tip.querySelector('.gl-term'), en: tip.querySelector('.gl-en'), bg: tip.querySelector('.gl-bg'), bgText: tip.querySelector('.gl-bg-text') };
    // Hovering the popup itself keeps a hover-opened popup open.
    tip.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') clearTimeout(hideTimer); });
    tip.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && openedBy === 'hover') hideSoon(); });
    doc.body.appendChild(tip);
  }

  /* ---- positioning ---- */
  function place() {
    if (!current) return;
    var rects = current.getClientRects();
    if (!rects.length) { close(); return; }
    var r = rects[0];                               // first line, if the term wraps
    var vw = doc.documentElement.clientWidth, vh = innerHeight;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var cx = r.left + r.width / 2;
    var left = Math.max(MARGIN, Math.min(cx - w / 2, vw - w - MARGIN));
    var above = r.top - GAP - h >= MARGIN;
    var below = rects[rects.length - 1].bottom + GAP + h <= vh - MARGIN;
    var side = above || !below && r.top > vh - r.bottom ? 'above' : 'below';
    var top = side === 'above' ? r.top - GAP - h : rects[rects.length - 1].bottom + GAP;
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    tip.style.setProperty('--ax', Math.round(Math.max(14, Math.min(cx - left, w - 14))) + 'px');
    tip.setAttribute('data-side', side);
  }
  function schedule() {
    if (!current || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; place(); });
  }

  /* ---- open / close ---- */
  function open(el, how) {
    if (!tip) build();
    clearTimeout(hideTimer);
    if (current === el) { if (how !== 'hover') openedBy = how; return; }
    if (current) close();
    current = el;
    openedBy = how || 'click';
    parts.term.textContent = el.textContent.trim();
    var en = el.getAttribute('data-en') || '', bg = el.getAttribute('data-bg') || '';
    parts.en.textContent = en;
    parts.en.hidden = !en;
    parts.bgText.textContent = bg;
    parts.bg.hidden = !bg;
    // Light popup over dark sections, dark popup elsewhere.
    tip.classList.toggle('on-dark', !!el.closest('.band,.hero,.card.dark,.player'));
    tip.hidden = false;
    place();
    el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-describedby', tip.id);
    el.classList.add('is-open');
  }
  function close(returnFocus) {
    clearTimeout(hideTimer);
    if (!current) return;
    var el = current;
    current = openedBy = null;
    tip.hidden = true;
    el.setAttribute('aria-expanded', 'false');
    el.removeAttribute('aria-describedby');
    el.classList.remove('is-open');
    if (returnFocus && doc.activeElement !== el) { quietFocus = true; el.focus({ preventScroll: true }); quietFocus = false; }
  }
  function hideSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (openedBy === 'hover') close(); }, 150);
  }

  /* ---- per-term wiring ---- */
  function enhance(el) {
    if (el._kitGloss) return;
    if (!el.getAttribute('data-en') && !el.getAttribute('data-bg')) return;   // nothing to show
    el._kitGloss = true;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('data-no-tap', '');            // don't advance a [data-step-tap] step
    el.classList.add('is-ready');

    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') open(el, 'hover'); });
    el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && current === el && openedBy === 'hover') hideSoon(); });
    // Pointer presses focus the term too; the click handler decides instead (on touch, focus can lag the tap).
    el.addEventListener('pointerdown', function (e) { pointerType = e.pointerType; downAt = Date.now(); });
    el.addEventListener('click', function () {
      if (Date.now() - downAt > 1500) pointerType = '';
      if (!pointerType) { if (current !== el) open(el, 'click'); }  // synthetic click
      else if (pointerType === 'mouse') open(el, 'click');  // mouse click pins it open
      else if (current === el) close();                    // touch / pen tap toggles
      else open(el, 'tap');
      pointerType = ''; downAt = 0;
    });
    el.addEventListener('focus', function () { if (Date.now() - downAt > 1500 && !quietFocus) open(el, 'focus'); });
    el.addEventListener('blur', function () { if (current === el && openedBy !== 'hover') close(); });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (current === el) close(); else open(el, 'key');
    });
  }

  function refresh() {
    doc.querySelectorAll('dfn.term').forEach(function (el) { fill(el); enhance(el); });
  }

  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    refresh();
    var url = doc.body.getAttribute('data-glossary');
    if (url && window.fetch) {
      fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (json) {
        Object.keys(json).forEach(function (k) { data[k.trim().toLowerCase()] = json[k]; });
        refresh();
      }).catch(function (err) { console.warn('Kit.glossary: could not load ' + url, err); });
    }

    doc.addEventListener('pointerdown', function (e) {
      if (current && !e.target.closest('dfn.term.is-ready,.gl-tip')) close();
    });
    doc.addEventListener('keydown', function (e) {
      if (current && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); close(openedBy !== 'hover'); }
    });
    addEventListener('scroll', schedule, { passive: true, capture: true });   // capture: also inner scrollers
    addEventListener('resize', schedule);
  }

  Kit.glossary = { init: init, refresh: refresh, open: function (el) { open(el, 'click'); }, close: function () { close(); }, data: data };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
