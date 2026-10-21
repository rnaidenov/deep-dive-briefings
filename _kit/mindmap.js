/* Deep Dive kit · mindmap.js
   Interactive radial mind map for book notes: story arc, characters, themes, key ideas, quotes.
   No dependencies.

   Markup:
     <div data-mindmap="mindmap.json" data-label="Moby-Dick mind map">
       <div class="no-js">…static nested list (shown without JS, or if the JSON fails to load)…</div>
     </div>
   JS:
     var map = Kit.mindmap(el, 'mindmap.json');   // or Kit.mindmap(el, { nodes: [...], edges: [...] })

   Data:
     { "root": "book",                                       optional; default: first node with no incoming edge
       "nodes": [ { "id": "ahab", "label": "Captain Ahab", "type": "character",
                    "note": "HTML allowed, incl. <dfn class=\"term\" data-en=\"…\" data-bg=\"…\">terms</dfn>",
                    "quote": "optional", "chapter": "Ch. 36" or 36, "color": "optional palette name" } ],
       "edges": [ { "from": "characters", "to": "ahab", "label": "optional" } ] }
     The tree is a BFS over edges (from → to) starting at the root. Every other edge is a cross-link:
     a faint dashed curve (with its label) drawn only while both ends are visible.
     Types: book, character, theme, event (plot), idea (key-point), place, quote, chapter; anything else is grey.

   Behaviour: only the root shows at first. Tap/click/Enter a node to unfold its children outward (and show its
   note); tap it again to fold them back. Leaves just show their note. Drag to pan, pinch or wheel to zoom,
   − / + / Fit / Expand all buttons. The view pans to keep newly opened nodes visible, beside the note panel.
   Keys (inside the tree): ↓/↑ next/previous visible node, → open + first child, ← parent, Home/End,
   Enter/Space toggle + note, Esc closes the note and returns focus. prefers-reduced-motion: no animation.

   API: .expand(id) .collapse(id) .toggle(id) .select(id) (reveal + open note) .close() .fit()
        .expandAll() .collapseAll() .ready (Promise) .nodes (by id)
   Event: kit:mindmap on the element, detail {action: 'expand'|'collapse'|'select'|'close', id, node} */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var doc = document, NS = 'http://www.w3.org/2000/svg';
  var reducedMQ = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var wideMQ = window.matchMedia && matchMedia('(min-width: 760px)');
  function reduced() { return !!(reducedMQ && reducedMQ.matches); }
  function wide() { return wideMQ ? wideMQ.matches : true; }

  var DUR = 260, CAM_DUR = 320, MIN_Z = 0.3, MAX_Z = 2.5, AUTO_MIN_Z = 0.6, GAP = 34, DRAG = 6, uid = 0;
  var PALETTE = { coral: 1, sun: 1, mint: 1, sky: 1, violet: 1, pink: 1 };
  var TYPES = {
    book:      { c: 'navy',   label: 'Book' },
    character: { c: 'coral',  label: 'Character' },
    theme:     { c: 'sun',    label: 'Theme' },
    event:     { c: 'mint',   label: 'Plot' },
    idea:      { c: 'sky',    label: 'Key idea' },
    place:     { c: 'violet', label: 'Place' },
    quote:     { c: 'pink',   label: 'Quote' },
    chapter:   { c: 'navy',   label: 'Chapter' },
    other:     { c: 'grey',   label: 'Note' }
  };
  var ALIAS = { plot: 'event', story: 'event', 'key-point': 'idea', keypoint: 'idea', point: 'idea', person: 'character', root: 'book' };

  function normType(t) {
    t = String(t || '').trim().toLowerCase();
    t = ALIAS[t] || t;
    return TYPES[t] ? t : 'other';
  }
  // --c solid, --ct tint, --cd dark (text on tint)
  function colorVars(el, n) {
    var c = PALETTE[n.d.color] ? n.d.color : TYPES[n.type].c;
    if (c === 'navy') { el.style.setProperty('--c', 'var(--navy-600)'); el.style.setProperty('--ct', '#e6e9f5'); el.style.setProperty('--cd', 'var(--navy)'); }
    else if (c === 'grey') { el.style.setProperty('--c', 'var(--muted)'); el.style.setProperty('--ct', 'var(--bg)'); el.style.setProperty('--cd', 'var(--ink)'); }
    else { el.style.setProperty('--c', 'var(--' + c + ')'); el.style.setProperty('--ct', 'var(--' + c + '-t)'); el.style.setProperty('--cd', 'var(--' + c + '-d)'); }
  }

  function h(tag, cls, attrs, parent) {
    var el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }
  function s(tag, cls, parent) {
    var el = doc.createElementNS(NS, tag);
    if (cls) el.setAttribute('class', cls);
    if (parent) parent.appendChild(el);
    return el;
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }                 // stiff ease-out, no overshoot
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clampZ(z) { return Math.max(MIN_Z, Math.min(MAX_Z, z)); }
  function now() { return window.performance ? performance.now() : Date.now(); }
  function f1(v) { return Math.round(v * 10) / 10; }
  function pt(r, a) { return f1(r * Math.cos(a)) + ',' + f1(r * Math.sin(a)); }

  function mindmap(el, src) {
    if (el._kitMindmap) return el._kitMindmap;
    var api = el._kitMindmap = { el: el };
    el.classList.add('kmap');
    var resolve;
    api.ready = new Promise(function (r) { resolve = r; });
    if (typeof src === 'string') {
      el.setAttribute('aria-busy', 'true');
      var loading = h('p', 'kmap-loading js-only', null, el);
      loading.textContent = 'Loading mind map…';
      fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
        el.removeChild(loading); el.removeAttribute('aria-busy');
        build(el, data, api); resolve(api);
      }).catch(function (err) {
        console.warn('Kit.mindmap: could not load ' + src, err);
        el.removeAttribute('aria-busy');
        loading.textContent = 'Could not load the mind map.';
        loading.className = 'kmap-loading is-error';
        el.classList.add('is-failed');                            // reveals a .no-js fallback inside the element
      });
    } else { build(el, src || {}, api); resolve(api); }
    return api;
  }

  function build(el, data, api) {
    var id = 'kmap-' + (++uid);
    var nodes = [], byId = {}, edges = [];

    /* ---- data → tree ---- */
    (data.nodes || []).forEach(function (d) {
      if (!d || d.id == null || byId[d.id]) { console.warn('Kit.mindmap: skipping node without a unique id', d); return; }
      var n = { id: String(d.id), d: d, type: normType(d.type), children: [], parent: null, depth: 0, links: [],
        expanded: false, vis: false, shown: false, cur: { r: 0, a: 0, o: 0, s: 0.4 }, tw: null };
      byId[n.id] = n; nodes.push(n);
    });
    if (!nodes.length) { h('p', 'kmap-loading is-error', null, el).textContent = 'This mind map has no nodes.'; return; }
    (data.edges || []).forEach(function (e) {
      var a = byId[e.from], b = byId[e.to];
      if (!a || !b || a === b) { console.warn('Kit.mindmap: skipping edge', e); return; }
      var ed = { from: a, to: b, label: e.label || '', tree: false };
      edges.push(ed); a.links.push(ed); b.links.push(ed);
    });
    var root = byId[data.root] || nodes.filter(function (n) { return !n.links.some(function (e) { return e.to === n; }); })[0] || nodes[0];

    function bfs(queue, undirected) {
      while (queue.length) {
        var u = queue.shift();
        u.links.forEach(function (e) {
          var v = e.from === u ? e.to : undirected ? e.from : null;
          if (!v || v.seen) return;
          v.seen = true; v.parent = u; v.depth = u.depth + 1; e.tree = true;
          u.children.push(v); queue.push(v);
        });
      }
    }
    root.seen = true;
    bfs([root], false);
    if (nodes.some(function (n) { return !n.seen; })) bfs(nodes.filter(function (n) { return n.seen; }), true);
    nodes.forEach(function (n) {
      if (n.seen) return;
      console.warn('Kit.mindmap: node "' + n.id + '" is not connected; attaching it to the root');
      n.seen = true; n.parent = root; n.depth = 1; root.children.push(n);
    });
    // Cross-links: non-tree edges. Duplicates of a parent–child edge aren't drawn (they'd overlap the branch).
    var cross = edges.filter(function (e) { return !e.tree && e.from.parent !== e.to && e.to.parent !== e.from; });

    function label(n) { return String(n.d.label || n.id); }
    function typeLabel(n) { return n.type === 'other' && n.d.type ? String(n.d.type) : TYPES[n.type].label; }

    /* ---- DOM ---- */
    var frame = h('div', 'kmap-frame', { 'data-no-tap': '' });
    var view = h('div', 'kmap-view', null, frame);
    var stage = h('div', 'kmap-stage', null, view);
    var svg = s('svg', 'kmap-edges', stage);
    svg.setAttribute('aria-hidden', 'true');
    var gTree = s('g', '', svg), gCross = s('g', '', svg), gLabels = s('g', '', svg);
    var tree = h('div', 'kmap-tree', { role: 'tree', 'aria-label': el.getAttribute('data-label') || 'Mind map: ' + label(root), 'aria-describedby': id + '-help' }, stage);
    var hint = h('p', 'kmap-hint', { 'aria-hidden': 'true' }, frame);
    hint.textContent = window.matchMedia && matchMedia('(pointer: coarse)').matches ?
      'Tap an idea to unfold it · pinch to zoom' : 'Click an idea to unfold it · drag to pan · scroll to zoom';

    var controls = h('div', 'kmap-controls', null, frame);
    function ctl(text, aria, fn, cls) {
      var b = h('button', 'kmap-btn' + (cls ? ' ' + cls : ''), { type: 'button' }, controls);
      b.textContent = text;
      if (aria) b.setAttribute('aria-label', aria);
      b.addEventListener('click', fn);
      return b;
    }
    ctl('−', 'Zoom out', function () { zoomBy(1 / 1.25); });
    ctl('+', 'Zoom in', function () { zoomBy(1.25); });
    ctl('Fit', 'Fit map to view', function () { fitAll(); }, 'text');
    var allBtn = ctl('Expand all', null, function () { if (allExpanded()) api.collapseAll(); else api.expandAll(); }, 'text');

    var panel = h('aside', 'kmap-panel', { id: id + '-panel', 'aria-labelledby': id + '-title' }, frame);
    var head = h('div', 'kmap-panel-head', null, panel);
    var pType = h('span', 'pill kmap-type', null, head);
    var closeBtn = h('button', 'kmap-close', { type: 'button', 'aria-label': 'Close note' }, head);
    closeBtn.innerHTML = '<span aria-hidden="true">×</span>';
    var body = h('div', 'kmap-panel-body', null, panel);
    var pTitle = h('h3', 'kmap-title', { id: id + '-title' }, body);
    var pChapter = h('p', 'kmap-chapter', null, body);
    var pNote = h('div', 'kmap-note', null, body);
    var pQuote = h('blockquote', 'kmap-quote', null, body);
    var pLinksTitle = h('h4', 'kmap-links-title', null, body);
    var pLinks = h('ul', 'kmap-links', null, body);

    var live = h('p', 'kmap-sr', { 'aria-live': 'polite' }, frame);
    var help = h('p', 'kmap-sr', { id: id + '-help' }, frame);
    help.textContent = 'Arrow keys move between ideas. Enter opens or closes a branch and shows its note. Escape closes the note.';

    nodes.forEach(function (n, i) {
      var b = h('button', 'kmap-node' + (n === root ? ' is-root' : ''), {
        type: 'button', role: 'treeitem', id: id + '-n' + i, tabindex: n === root ? '0' : '-1',
        'aria-level': n.depth + 1, 'aria-selected': 'false', 'aria-controls': id + '-panel',
        'aria-setsize': n.parent ? n.parent.children.length : 1, 'aria-posinset': n.parent ? n.parent.children.indexOf(n) + 1 : 1
      }, tree);
      colorVars(b, n);
      b.innerHTML = '<span class="kmap-label">' + esc(label(n)) + '</span><span class="kmap-sr">, ' + esc(typeLabel(n)) + '</span>';
      if (n.children.length) {
        b.setAttribute('aria-expanded', 'false');
        h('span', 'kmap-badge', { 'aria-hidden': 'true' }, b).textContent = '+' + n.children.length;
      }
      b.hidden = n !== root;
      b._n = n; n.el = b;
      if (n.parent) { n.edge = s('path', 'kmap-edge', gTree); colorVars(n.edge, n); }
    });
    cross.forEach(function (e) {
      e.path = s('path', 'kmap-cross', gCross);
      if (e.label) { e.text = s('text', 'kmap-xlabel', gLabels); e.text.textContent = e.label; }
    });

    // Legend: the types that appear (the root's "book" type is left out).
    var used = {};
    nodes.forEach(function (n) { if (n !== root) used[n.type] = n; });
    var legend = h('ul', 'kmap-legend js-only', { 'aria-label': 'Node colours' });
    Object.keys(TYPES).forEach(function (t) {
      if (!used[t]) return;
      var li = h('li', '', null, legend);
      colorVars(li, { d: {}, type: t });
      li.innerHTML = '<i aria-hidden="true"></i>' + esc(TYPES[t].label);
    });

    el.insertBefore(frame, el.firstChild);
    el.insertBefore(legend, frame.nextSibling);
    root.vis = root.shown = true;
    root.cur.o = root.cur.s = 1;

    /* ---- layout: static radial tree (stable positions; unfolding only reveals) ---- */
    function measure() {
      nodes.forEach(function (n) {
        var hid = n.el.hidden;
        n.el.hidden = false;
        n.w = n.el.offsetWidth || Math.min(200, 40 + 8 * label(n).length);
        n.h = n.el.offsetHeight || 44;
        n.el.hidden = hid;
      });
    }
    function layout() {
      (function leaves(n) {
        n.leaves = n.children.length ? n.children.reduce(function (t, c) { return t + leaves(c); }, 0) : 1;
        return n.leaves;
      })(root);
      root.a0 = -Math.PI / 2; root.a1 = root.a0 + 2 * Math.PI; root.a = root.a0;
      var levels = [], q = [root];
      while (q.length) {
        var p = q.shift();
        (levels[p.depth] = levels[p.depth] || []).push(p);
        // Each child gets a slice of the parent's sector, weighted by its leaves (softened so lone leaves aren't cramped).
        var a = p.a0, span = p.a1 - p.a0, tot = 0;
        p.children.forEach(function (c) { tot += c.leaves + 0.5; });
        p.children.forEach(function (c) {
          c.a0 = a; a += span * (c.leaves + 0.5) / tot; c.a1 = a; c.a = (c.a0 + c.a1) / 2;
          q.push(c);
        });
      }
      nodes.forEach(function (n) {
        var co = Math.abs(Math.cos(n.a)), si = Math.abs(Math.sin(n.a));
        n.er = (n.w * co + n.h * si) / 2;                                            // half extent along the radius
        n.et = n.w * si + n.h * co;                                                 // extent along the ring
      });
      var R = [0], stag = [0];
      function rootExt(a) { return (root.w * Math.abs(Math.cos(a)) + root.h * Math.abs(Math.sin(a))) / 2; }
      function maxOf(list, f) { return Math.max.apply(null, list.map(f)); }
      for (var d = 1; d < levels.length; d++) {
        var lv = levels[d], base;
        if (d === 1) base = maxOf(lv, function (n) { return rootExt(n.a) + n.er + GAP; });   // hug the wide, short root
        else base = R[d - 1] + stag[d - 1] + GAP + maxOf(levels[d - 1], function (n) { return n.er; }) + maxOf(lv, function (n) { return n.er; });
        var ring = function (k) { return maxOf(lv, function (n) { return (n.et + 14) / k / Math.max(0.02, n.a1 - n.a0); }); };
        var r = Math.max(base, ring(1));
        // Crowded outer ring: alternate nodes between two sub-rings, which roughly halves the radius needed.
        var hop = maxOf(lv, function (n) { return n.h; }) + 14, r2 = Math.max(base, ring(2));
        stag[d] = d > 1 && lv.length > 2 && r2 + hop < r ? hop : 0;
        R[d] = stag[d] ? r2 : r;
        lv.forEach(function (n, i) { n.r = R[d] + (i % 2 ? stag[d] : 0); });
      }
      // Spread inner rings out towards the outer ones, so the rings are more evenly spaced.
      for (d = R.length - 2; d >= 1; d--) {
        var spread = Math.max(R[d], R[d + 1] * d / (d + 1) * 0.6) - R[d];
        if (spread > 0) { R[d] += spread; levels[d].forEach(function (n) { n.r += spread; }); }
      }
      root.r = 0;
      nodes.forEach(function (n) { n.x = n.r * Math.cos(n.a); n.y = n.r * Math.sin(n.a); });
    }
    measure();
    layout();

    /* ---- rendering + animation ---- */
    var cam = { x: 0, y: 0, s: 1, tw: null }, raf = 0;

    function place(n) {
      var x = n.cur.r * Math.cos(n.cur.a), y = n.cur.r * Math.sin(n.cur.a);
      n.el.style.transform = 'translate(' + f1(x) + 'px,' + f1(y) + 'px) translate(-50%,-50%) scale(' + n.cur.s.toFixed(3) + ')';
      n.el.style.opacity = n.cur.o.toFixed(3);
    }
    function drawEdges() {
      nodes.forEach(function (c) {
        if (!c.edge) return;
        if (!c.shown) { c.edge.style.display = 'none'; return; }
        var p = c.parent, rs = p.cur.r, as = rs < 0.5 ? c.cur.a : p.cur.a, rt = c.cur.r, at = c.cur.a, rm = (rs + rt) / 2;
        c.edge.style.display = '';
        c.edge.setAttribute('d', 'M' + pt(rs, as) + 'C' + pt(rm, as) + ' ' + pt(rm, at) + ' ' + pt(rt, at));
        c.edge.style.opacity = c.cur.o.toFixed(3);
      });
      cross.forEach(function (e) {
        var a = e.from, b = e.to, on = a.shown && b.shown;
        e.path.style.display = on ? '' : 'none';
        if (e.text) e.text.style.display = on && a.vis && b.vis ? '' : 'none';
        if (!on) return;
        var ax = a.cur.r * Math.cos(a.cur.a), ay = a.cur.r * Math.sin(a.cur.a);
        var bx = b.cur.r * Math.cos(b.cur.a), by = b.cur.r * Math.sin(b.cur.a);
        var cx = (ax + bx) / 2 * 0.55, cy = (ay + by) / 2 * 0.55;                 // bow towards the centre
        var o = Math.min(a.cur.o, b.cur.o).toFixed(3);
        e.path.setAttribute('d', 'M' + f1(ax) + ',' + f1(ay) + 'Q' + f1(cx) + ',' + f1(cy) + ' ' + f1(bx) + ',' + f1(by));
        e.path.style.opacity = o;
        if (e.text) {
          e.text.setAttribute('x', f1(ax / 4 + cx / 2 + bx / 4));
          e.text.setAttribute('y', f1(ay / 4 + cy / 2 + by / 4));
          e.text.style.opacity = o;
        }
      });
    }
    function applyCam() {
      stage.style.transform = 'translate(' + f1(cam.x) + 'px,' + f1(cam.y) + 'px) scale(' + cam.s.toFixed(4) + ')';
      view.style.backgroundPosition = f1(cam.x) + 'px ' + f1(cam.y) + 'px';
      view.style.backgroundSize = f1(24 * cam.s) + 'px ' + f1(24 * cam.s) + 'px';
    }
    function tick(t) {
      raf = 0;
      var busy = false;
      nodes.forEach(function (n) {
        var tw = n.tw;
        if (!tw) return;
        var k = tw.dur ? Math.max(0, Math.min(1, (t - tw.t0) / tw.dur)) : 1, e = ease(k);
        n.cur = { r: lerp(tw.from.r, tw.to.r, e), a: lerp(tw.from.a, tw.to.a, e), o: lerp(tw.from.o, tw.to.o, e), s: lerp(tw.from.s, tw.to.s, e) };
        if (k >= 1) { n.tw = null; if (tw.done) tw.done(); } else busy = true;
        place(n);
      });
      if (cam.tw) {
        var c = cam.tw, k = c.dur ? Math.max(0, Math.min(1, (t - c.t0) / c.dur)) : 1, e = ease(k);
        cam.x = lerp(c.from.x, c.to.x, e); cam.y = lerp(c.from.y, c.to.y, e); cam.s = lerp(c.from.s, c.to.s, e);
        if (k >= 1) cam.tw = null; else busy = true;
        applyCam();
      }
      drawEdges();
      if (busy) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }

    // Tween in polar coordinates, so children travel outward along their branch.
    function tween(n, to, done) {
      var from = n.cur;
      to = { r: to.r, a: to.a, o: to.o, s: to.s };
      var fa = from.r < 0.5 ? to.a : from.a;
      if (to.r < 0.5) to.a = fa;
      var da = to.a - fa;
      da = ((da + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;   // shortest way round
      to.a = fa + da;
      n.tw = { from: { r: from.r, a: fa, o: from.o, s: from.s }, to: to, t0: now(), dur: reduced() ? 0 : DUR, done: done };
      kick();
    }

    /* ---- camera ---- */
    function camTarget() { return cam.tw ? cam.tw.to : cam; }
    function moveCam(x, y, z, animate) {
      z = clampZ(z);
      if (!animate || reduced()) { cam.tw = null; cam.x = x; cam.y = y; cam.s = z; applyCam(); return; }
      cam.tw = { from: { x: cam.x, y: cam.y, s: cam.s }, to: { x: x, y: y, s: z }, t0: now(), dur: CAM_DUR };
      kick();
    }
    // Part of the view not covered by the note panel (view-local px).
    var scrollShift = 0;                                            // page scroll still in flight (keepOnScreen)
    function avail() {
      var vr = view.getBoundingClientRect(), a = { x: 0, y: 0, w: vr.width, h: vr.height };
      if (!panelOpen) return a;
      if (wide()) {
        var pw = panel.offsetWidth + 20;
        if (vr.width - pw > 220) a.w = vr.width - pw;
      } else {                                                       // bottom sheet, fixed to the screen
        var vt = vr.top - scrollShift, vb = vr.bottom - scrollShift;
        var top = Math.max(vt, 0), bottom = Math.min(vb, innerHeight - panel.offsetHeight);
        if (bottom - top > 140) { a.y = top - vt; a.h = bottom - top; }
      }
      return a;
    }
    // Narrow screens: scroll the page so the map sits at the top of the screen, above the bottom sheet.
    function keepOnScreen() {
      if (wide() || !panelOpen) return;
      var se = doc.scrollingElement || doc.documentElement, y = se.scrollTop;
      var d = view.getBoundingClientRect().top - 8;
      d = Math.max(-y, Math.min(d, se.scrollHeight - innerHeight - y));
      if (Math.abs(d) < 16) return;
      scrollShift = d;
      window.scrollBy({ top: d, behavior: reduced() ? 'auto' : 'smooth' });
    }
    function bbox(list) {
      var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      list.forEach(function (n) {
        b.x0 = Math.min(b.x0, n.x - n.w / 2); b.x1 = Math.max(b.x1, n.x + n.w / 2);
        b.y0 = Math.min(b.y0, n.y - n.h / 2); b.y1 = Math.max(b.y1, n.y + n.h / 2);
      });
      return b;
    }
    // mode 'keep': pan just enough, zooming out only if needed (and never below a readable size; list[0], the node
    // that was tapped, always stays in view). 'fit': centre and zoom to fit everything.
    function show(list, mode, animate) {
      var b = bbox(list), a = avail(), t = camTarget(), pad = 18, z = t.s;
      scrollShift = 0;
      var aw = Math.max(40, a.w - 2 * pad), ah = Math.max(40, a.h - 2 * pad), bw = b.x1 - b.x0, bh = b.y1 - b.y0;
      if (mode === 'fit') z = clampZ(Math.min(aw / bw, ah / bh, 1.15));
      else if (bw * z > aw || bh * z > ah) z = Math.max(Math.min(t.s, AUTO_MIN_Z), clampZ(Math.min(aw / bw, ah / bh)));
      var x = t.x, y = t.y;
      if (mode === 'fit' || z !== t.s) {
        x = a.x + a.w / 2 - (b.x0 + bw / 2) * z;
        y = a.y + a.h / 2 - (b.y0 + bh / 2) * z;
      }
      if (mode !== 'fit') {
        if (bw * z > aw || bh * z > ah) b = bbox(list.slice(0, 1));
        var l = x + b.x0 * z, r = x + b.x1 * z, tp = y + b.y0 * z, bt = y + b.y1 * z;
        if (l < a.x + pad) x += a.x + pad - l; else if (r > a.x + a.w - pad) x -= r - (a.x + a.w - pad);
        if (tp < a.y + pad) y += a.y + pad - tp; else if (bt > a.y + a.h - pad) y -= bt - (a.y + a.h - pad);
      }
      moveCam(x, y, z, animate !== false);
    }
    function zoomAt(px, py, f, animate) {
      var t = camTarget(), z = clampZ(t.s * f), wx = (px - t.x) / t.s, wy = (py - t.y) / t.s;
      moveCam(px - wx * z, py - wy * z, z, animate);
    }
    function zoomBy(f) { var a = avail(); zoomAt(a.x + a.w / 2, a.y + a.h / 2, f, true); }
    function visibleNodes() { return nodes.filter(function (n) { return n.vis; }); }
    function fitAll() { show(visibleNodes(), 'fit'); }

    /* ---- expand / collapse ---- */
    function emit(action, n) {
      el.dispatchEvent(new CustomEvent('kit:mindmap', { bubbles: true, detail: { action: action, id: n ? n.id : null, node: n ? n.d : null } }));
    }
    function announce(text) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 30); }
    function allExpanded() { return nodes.every(function (n) { return !n.children.length || n.expanded; }); }
    function syncAll() { allBtn.textContent = allExpanded() ? 'Collapse all' : 'Expand all'; }

    function expand(n, quiet) {
      if (!n.children.length || n.expanded) return;
      n.expanded = true;
      n.el.setAttribute('aria-expanded', 'true');
      n.el.classList.add('is-expanded');
      n.children.forEach(function (c) {
        c.vis = true;
        if (!c.shown) { c.shown = true; c.el.hidden = false; c.cur = { r: n.cur.r, a: n.cur.a, o: 0, s: 0.4 }; }
        tween(c, { r: c.r, a: c.a, o: 1, s: 1 });
      });
      if (!quiet) announce(label(n) + ' expanded, ' + n.children.length + (n.children.length === 1 ? ' item' : ' items'));
      syncAll();
      emit('expand', n);
    }
    function collapse(n, quiet) {
      if (!n.expanded) return;
      var focused = doc.activeElement && doc.activeElement._n;
      (function fold(p) {
        p.expanded = false;
        if (p.children.length) { p.el.setAttribute('aria-expanded', 'false'); p.el.classList.remove('is-expanded'); }
        p.children.forEach(function (c) {
          if (!c.vis) return;
          c.vis = false;
          if (c === focused || c === roving) { setRoving(n); if (c === focused) n.el.focus({ preventScroll: true }); }
          tween(c, { r: n.r, a: n.a, o: 0, s: 0.4 }, function () { if (!c.vis) { c.shown = false; c.el.hidden = true; } });
          fold(c);
        });
      })(n);
      if (!quiet) announce(label(n) + ' collapsed');
      syncAll();
      emit('collapse', n);
    }
    function reveal(n) {
      var chain = [];
      for (var p = n.parent; p; p = p.parent) chain.unshift(p);
      chain.forEach(function (p) { expand(p, true); });
    }

    /* ---- note panel ---- */
    var panelOpen = false, sel = null;
    function renderPanel(n) {
      if (Kit.glossary && Kit.glossary.isOpen && Kit.glossary.isOpen()) Kit.glossary.close();
      colorVars(panel, n);
      pType.textContent = typeLabel(n);
      pTitle.textContent = label(n);
      var ch = n.d.chapter;
      pChapter.textContent = ch == null || ch === '' ? '' : typeof ch === 'number' || /^\d+$/.test(ch) ? 'Chapter ' + ch : String(ch);
      pChapter.hidden = !pChapter.textContent;
      pNote.innerHTML = n.d.note || '';
      pNote.hidden = !n.d.note;
      pQuote.innerHTML = n.d.quote ? '<p>' + n.d.quote + '</p>' : '';
      pQuote.hidden = !n.d.quote;

      // Connections: parent, cross-links, then children. Phrased relative to this node.
      var items = [];
      n.links.forEach(function (e) {
        var out = e.from === n, o = out ? e.to : e.from, b = '<b>' + esc(label(o)) + '</b>', text;
        if (e.label) text = out ? esc(e.label) + ' ' + b : b + ' ' + esc(e.label);
        else if (o === n.parent) text = 'part of ' + b;
        else if (o.parent === n) text = b;
        else text = 'see also ' + b;
        items.push({ n: o, html: text, rank: o === n.parent ? 0 : o.parent === n ? 2 : 1 });
      });
      if (n.parent && !n.links.some(function (e) { return e.from === n.parent || e.to === n.parent; })) items.push({ n: n.parent, html: 'part of <b>' + esc(label(n.parent)) + '</b>', rank: 0 });
      items.sort(function (a, b) { return a.rank - b.rank; });
      pLinks.innerHTML = '';
      items.forEach(function (it) {
        var li = h('li', '', null, pLinks), b = h('button', 'kmap-link', { type: 'button' }, li);
        colorVars(b, it.n);
        b.innerHTML = '<i aria-hidden="true"></i><span>' + it.html + '</span>';
        b.addEventListener('click', function () { jump(it.n); });
      });
      pLinksTitle.textContent = 'Connections (' + items.length + ')';
      pLinksTitle.hidden = pLinks.hidden = !items.length;
      body.scrollTop = 0;
      if (Kit.glossary) (Kit.glossary.scan || Kit.glossary.refresh)(body);
    }
    function select(n) {
      if (sel && sel !== n) { sel.el.setAttribute('aria-selected', 'false'); sel.el.classList.remove('is-selected'); }
      sel = n;
      n.el.setAttribute('aria-selected', 'true');
      n.el.classList.add('is-selected');
      renderPanel(n);
      panelOpen = true;
      panel.classList.add('is-open');
      el.classList.add('has-panel');
      keepOnScreen();
      emit('select', n);
    }
    function closePanel(returnFocus) {
      if (!panelOpen) return;
      if (Kit.glossary && Kit.glossary.isOpen && Kit.glossary.isOpen()) Kit.glossary.close();
      panelOpen = false;
      panel.classList.remove('is-open');
      el.classList.remove('has-panel');
      var n = sel;
      if (n) { n.el.setAttribute('aria-selected', 'false'); n.el.classList.remove('is-selected'); sel = null; }
      if (returnFocus && n) { setRoving(n); n.el.focus({ preventScroll: true }); }
      emit('close', n);
    }
    closeBtn.addEventListener('click', function () { closePanel(true); });
    doc.addEventListener('keydown', function (e) {
      if ((e.key !== 'Escape' && e.key !== 'Esc') || !panelOpen || e.defaultPrevented) return;
      if (Kit.glossary && Kit.glossary.isOpen && Kit.glossary.isOpen()) return;   // Esc closes the term popup first
      var a = doc.activeElement;
      if (a && a !== doc.body && !el.contains(a)) return;
      e.preventDefault();
      closePanel(true);
    });

    /* ---- activation + keyboard ---- */
    var roving = root;
    function setRoving(n) {
      if (roving && roving !== n) roving.el.tabIndex = -1;
      roving = n; n.el.tabIndex = 0;
    }
    function activate(n) {
      hint.classList.add('is-done');
      if (n.children.length) { if (n.expanded) collapse(n); else expand(n); }
      else announce(label(n));
      select(n);
      setRoving(n);
      show([n].concat(n.expanded ? n.children : []), 'keep');
    }
    function jump(n) {
      reveal(n);
      select(n);
      setRoving(n);
      n.el.focus({ preventScroll: true });
      show([n], 'keep');
      announce(label(n) + ', ' + typeLabel(n));
    }
    function order() {
      var list = [];
      (function walk(n) { list.push(n); if (n.expanded) n.children.forEach(walk); })(root);
      return list;
    }
    function moveTo(n) {
      setRoving(n);
      n.el.focus({ preventScroll: true });
      if (panelOpen) select(n);                                    // the note follows focus while it's open
      show([n], 'keep');
    }
    tree.addEventListener('click', function (e) {
      var b = e.target.closest('.kmap-node');
      if (b) activate(b._n);
    });
    tree.addEventListener('focusin', function (e) { if (e.target._n) setRoving(e.target._n); });
    tree.addEventListener('keydown', function (e) {
      var n = e.target._n, k = e.key, list, i, to = null;
      if (!n || e.altKey || e.ctrlKey || e.metaKey) return;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        list = order(); i = list.indexOf(n);
        to = list[i + (k === 'ArrowDown' ? 1 : -1)];
      } else if (k === 'ArrowRight') {
        if (n.children.length) {
          if (!n.expanded) { expand(n); show([n].concat(n.children), 'keep'); }
          to = n.children[0];
        }
      } else if (k === 'ArrowLeft') to = n.parent;
      else if (k === 'Home') to = root;
      else if (k === 'End') { list = order(); to = list[list.length - 1]; }
      else return;                                                 // Enter/Space fall through to the native click
      e.preventDefault();                                          // also keeps steps.js from changing step
      hint.classList.add('is-done');
      if (to) moveTo(to);
    });

    /* ---- pan / pinch / wheel ---- */
    var ptrs = {}, base = null, moved = false;
    function local(p) { var r = view.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top }; }
    function baseline() {
      var ids = Object.keys(ptrs);
      cam.tw = null;
      base = { x: cam.x, y: cam.y, s: cam.s, ids: ids, pts: ids.map(function (k) { return { x: ptrs[k].x, y: ptrs[k].y }; }) };
      if (ids.length >= 2) {
        var p0 = base.pts[0], p1 = base.pts[1];
        base.d = Math.max(10, Math.hypot(p1.x - p0.x, p1.y - p0.y));
        base.m = local({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 });
      }
    }
    view.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!Object.keys(ptrs).length) moved = false;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      baseline();
    });
    view.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (base.ids.length === 1) {
        var p = ptrs[base.ids[0]], b = base.pts[0], dx = p.x - b.x, dy = p.y - b.y;
        if (!moved) {
          if (Math.hypot(dx, dy) < DRAG) return;
          moved = true;
          try { view.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
          view.classList.add('is-dragging');
        }
        cam.x = base.x + dx; cam.y = base.y + dy;
      } else if (base.ids.length >= 2 && ptrs[base.ids[0]] && ptrs[base.ids[1]]) {
        moved = true;
        var q0 = ptrs[base.ids[0]], q1 = ptrs[base.ids[1]];
        var m = local({ x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 });
        var z = clampZ(base.s * Math.hypot(q1.x - q0.x, q1.y - q0.y) / base.d);
        var wx = (base.m.x - base.x) / base.s, wy = (base.m.y - base.y) / base.s;
        cam.x = m.x - wx * z; cam.y = m.y - wy * z; cam.s = z;
      }
      applyCam();
    });
    function up(e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId];
      baseline();
      if (!base.ids.length) view.classList.remove('is-dragging');
    }
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    // A drag that started on a node mustn't also tap it (keyboard clicks have detail 0 and always pass).
    view.addEventListener('click', function (e) { if (moved && e.detail) { e.stopPropagation(); e.preventDefault(); } }, true);
    view.addEventListener('wheel', function (e) {
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      var p = local({ x: e.clientX, y: e.clientY });
      zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), false);
    }, { passive: false });
    // Focusing a node can scroll the clipped view natively; the camera does all the moving.
    view.addEventListener('scroll', function () { view.scrollTop = 0; view.scrollLeft = 0; });

    // Keep the view centre fixed when the map is resized.
    var size = { w: view.clientWidth, h: view.clientHeight };
    function resized() {
      var w = view.clientWidth, hh = view.clientHeight;
      if (!w || (w === size.w && hh === size.h)) return;
      var dx = (w - size.w) / 2, dy = (hh - size.h) / 2;
      size = { w: w, h: hh };
      if (cam.tw) { cam.tw.to.x += dx; cam.tw.to.y += dy; }
      cam.x += dx; cam.y += dy;
      applyCam();
    }
    if (window.ResizeObserver) new ResizeObserver(resized).observe(view);
    else addEventListener('resize', resized);

    // Web fonts change label widths: re-measure and settle every node on its new spot.
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () {
      measure(); layout();
      nodes.forEach(function (n) {
        if (n.tw && n.vis) { n.tw.to.r = n.r; n.tw.to.a = n.a; }
        else if (!n.tw) { n.cur.r = n.r; n.cur.a = n.a; place(n); }
      });
      drawEdges();
    });

    /* ---- start: root only, centred ---- */
    moveCam(view.clientWidth / 2, view.clientHeight / 2, 1, false);
    place(root);
    drawEdges();

    /* ---- API ---- */
    function get(id) { var n = byId[id]; if (!n) console.warn('Kit.mindmap: no node "' + id + '"'); return n; }
    api.nodes = byId;
    api.expand = function (i) { var n = get(i); if (n) { reveal(n); expand(n); show([n].concat(n.children), 'keep'); } };
    api.collapse = function (i) { var n = get(i); if (n) collapse(n); };
    api.toggle = function (i) { var n = get(i); if (n) { if (n.expanded) api.collapse(i); else api.expand(i); } };
    api.select = function (i) { var n = get(i); if (n) { reveal(n); select(n); setRoving(n); show([n], 'keep'); } };
    api.close = function () { closePanel(false); };
    api.fit = fitAll;
    api.expandAll = function () {
      (function walk(n) { expand(n, true); n.children.forEach(walk); })(root);
      announce('All branches expanded');
      show(nodes, 'fit');
    };
    api.collapseAll = function () {
      collapse(root, true);
      announce('All branches collapsed');
      show([root], 'fit');
    };
  }

  Kit.mindmap = mindmap;

  function auto() {
    doc.querySelectorAll('[data-mindmap]').forEach(function (el) { if (!el._kitMindmap) mindmap(el, el.getAttribute('data-mindmap')); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', auto);
  else auto();
})();
