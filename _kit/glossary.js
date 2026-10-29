/* Deep Dive kit · glossary.js
   Inline glossary terms with a small popup: term, plain-English explainer, Bulgarian translation,
   optional Wikipedia/Learn-more link, optional YouTube Shorts (open externally — no iframes).
   No dependencies.

   Markup:
     <dfn class="term" data-en="Plain-English explainer, 1–2 lines" data-bg="налягане">pressure</dfn>
     <dfn class="term" data-term="crema">the crema</dfn>    data-term: lookup key if it differs from the text
     <dfn class="term" data-wiki="https://en.wikipedia.org/wiki/Pressure"
          data-shorts="https://www.youtube.com/shorts/aaa,https://www.youtube.com/shorts/bbb">pressure</dfn>
     <body data-glossary="glossary.json">                   optional per-topic file (relative to the page)

   glossary.json, keyed by term (case-insensitive); it only fills attributes the markup leaves out:
     {
       "pressure": {
         "en": "How hard the water is pushed through the coffee.",
         "bg": "налягане",
         "wiki": "https://en.wikipedia.org/wiki/Pressure",
         "shorts": ["https://www.youtube.com/shorts/…", "https://www.youtube.com/shorts/…"]
       }
     }
   `shorts` may also be a single string or a comma-separated string.

   Behaviour: opens on mouse hover, on keyboard focus, and with Enter/Space; a tap toggles it on touch;
   tapping/clicking outside closes it; Esc closes it and returns focus to the term. One popup at a time.
   Terms with no explainer and no translation are left as plain text.
   External links open in a new tab (target=_blank rel=noopener). Shorts are chips, not embeds.

   STANDING RULE (Shorts on fundamentals): every fundamental term on a page (the concepts the
   explanation rests on) should carry a YouTube Short when a good one exists, and a MECHANISM Short
   (shows how/why it works) is preferred over a definition or trivia clip. Put the best one first.
   Also list it in the page's "Read more / Watch more" Quick watch group (see README).

   API: Kit.glossary.scan(root) (enhance terms inside root, e.g. content rendered later; .init(root) is the same
        and also runs the one-time setup if needed), .refresh() (scan the whole page), .open(el), .close(),
        .isOpen(), .data (merged JSON) */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var doc = document;
  var GAP = 8, MARGIN = 8;

  var data = {}, tip = null, parts = {}, current = null, openedBy = null;
  var hideTimer = 0, pointerType = '', downAt = 0, quietFocus = false, ticking = false;

  function key(el) { return (el.getAttribute('data-term') || el.textContent).trim().replace(/\s+/g, ' ').toLowerCase(); }

  function shortsAttr(v) {
    if (v == null || v === '') return '';
    if (Array.isArray(v)) return v.map(function (s) { return String(s).trim(); }).filter(Boolean).join(',');
    return String(v).trim();
  }

  // Fill missing data-en / data-bg / data-wiki / data-shorts from glossary.json.
  function fill(el) {
    var d = data[key(el)];
    if (!d) return;
    if (typeof d === 'string') d = { en: d };
    if (d.en && !el.getAttribute('data-en')) el.setAttribute('data-en', d.en);
    if (d.bg && !el.getAttribute('data-bg')) el.setAttribute('data-bg', d.bg);
    if (d.wiki && !el.getAttribute('data-wiki')) el.setAttribute('data-wiki', d.wiki);
    var sh = shortsAttr(d.shorts);
    if (sh && !el.getAttribute('data-shorts')) el.setAttribute('data-shorts', sh);
  }

  function parseShorts(attr) {
    if (!attr) return [];
    return attr.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 2);
  }

  function wikiLabel(url) {
    try {
      var host = new URL(url, location.href).hostname.replace(/^www\./, '');
      if (/\.wikipedia\.org$/i.test(host) || host === 'wikipedia.org') return 'Wikipedia';
    } catch (e) { /* keep Learn more */ }
    return 'Learn more';
  }

  function linkEl(href, label, cls) {
    var a = doc.createElement('a');
    a.className = cls;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    return a;
  }

  function build() {
    tip = doc.createElement('div');
    tip.className = 'gl-tip';
    tip.id = 'kit-gloss-' + Math.random().toString(36).slice(2, 8);
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    tip.innerHTML = '<span class="gl-term"></span><span class="gl-en"></span>' +
      '<span class="gl-bg"><span class="gl-lang" aria-hidden="true">BG</span><span class="gl-bg-text" lang="bg"></span></span>' +
      '<span class="gl-links" hidden></span>' +
      '<span class="gl-arrow" aria-hidden="true"></span>';
    parts = {
      term: tip.querySelector('.gl-term'),
      en: tip.querySelector('.gl-en'),
      bg: tip.querySelector('.gl-bg'),
      bgText: tip.querySelector('.gl-bg-text'),
      links: tip.querySelector('.gl-links')
    };
    // Hovering the popup itself keeps a hover-opened popup open.
    tip.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') clearTimeout(hideTimer); });
    tip.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && openedBy === 'hover') hideSoon(); });
    // Keep focus on the term when clicking a link so the tip doesn't close before navigation.
    tip.addEventListener('mousedown', function (e) { if (e.target.closest('a')) e.preventDefault(); });
    doc.body.appendChild(tip);
  }

  function fillLinks(el) {
    var box = parts.links;
    while (box.firstChild) box.removeChild(box.firstChild);
    var wiki = (el.getAttribute('data-wiki') || '').trim();
    var shorts = parseShorts(el.getAttribute('data-shorts'));
    if (!wiki && !shorts.length) { box.hidden = true; return; }
    if (wiki) box.appendChild(linkEl(wiki, wikiLabel(wiki), 'gl-wiki'));
    shorts.forEach(function (url, i) {
      box.appendChild(linkEl(url, 'Short ' + (i + 1), 'gl-short'));
    });
    box.hidden = false;
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
    fillLinks(el);
    // Light popup over dark sections, dark popup elsewhere (light panels such as .kmap-panel reset it).
    var ctx = el.closest('.band,.hero,.card.dark,.player,.kmap-panel');
    tip.classList.toggle('on-dark', !!ctx && !ctx.classList.contains('kmap-panel'));
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

  function scan(root) {
    root = root || doc;
    var list = [].slice.call(root.querySelectorAll('dfn.term'));
    if (root.matches && root.matches('dfn.term')) list.unshift(root);
    list.forEach(function (el) { fill(el); enhance(el); });
  }
  function refresh() { scan(doc); }

  var inited = false;
  function init(root) {
    if (root && root.nodeType === 1) scan(root);  // ignore the DOMContentLoaded Event argument
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

  Kit.glossary = {
    init: init, scan: scan, refresh: refresh, data: data,
    open: function (el) { open(el, 'click'); }, close: function () { close(); }, isOpen: function () { return !!current; }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
