/* Deep Dive kit · svg.js
   Tiny helpers for hand-built SVG diagrams. No dependencies.

   var S = Kit.svg;
   var svg = S.create(container, { viewBox: '0 0 640 320', label: 'What the diagram shows' });
   var g = S.group(svg, { class: 'parts' });
   S.rect(g, 20, 20, 120, 60, { fill: 'var(--sky)', rx: 12 });
   S.circle(g, 300, 50, 30, { fill: 'var(--coral)' });
   S.text(g, 80, 56, 'Label', { anchor: 'middle', class: 'ks-title' });
   S.arrow(svg, 140, 50, 270, 50, { color: 'var(--violet)', bend: -30 });
   S.draw(svg.querySelectorAll('path,line'), { stagger: 150 });   // animate draw-on
   S.onView(svg, function () { ... });                              // run once when visible

   Attributes: camelCase is converted to kebab-case (strokeWidth → stroke-width).
   Colours may be CSS variables ("var(--mint)"); fill/stroke/color are applied as styles so var() works.
   Static markup: add data-draw to any stroked shape inside an <svg> and it draws on when scrolled into view. */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STYLE_KEYS = { fill: 1, stroke: 1, color: 1, opacity: 1 };
  var markerId = 0;

  // SVG attributes that are genuinely camelCase; everything else is kebab-cased.
  var CAMEL = /^(viewBox|preserveAspectRatio|refX|refY|markerWidth|markerHeight|markerUnits|pathLength|textLength|lengthAdjust|gradientUnits|gradientTransform|patternUnits|patternTransform|stdDeviation|startOffset|clipPathUnits)$/;
  function kebab(k) { return CAMEL.test(k) ? k : k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); }

  function set(node, attrs) {
    if (!attrs) return node;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'anchor') node.setAttribute('text-anchor', v === 'center' ? 'middle' : v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { node.style.setProperty(s.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }), v[s]); });
      else if (STYLE_KEYS[k] && /var\(/.test(String(v))) node.style.setProperty(k, v);
      else node.setAttribute(k === 'className' ? 'class' : kebab(k), v);
    });
    return node;
  }

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    set(n, attrs);
    if (parent) parent.appendChild(n);
    return n;
  }

  function ownerSvg(p) { return p.ownerSVGElement || p; }

  function defs(svg) {
    return svg.querySelector('defs') || svg.insertBefore(el('defs'), svg.firstChild);
  }

  // One arrowhead marker per colour per svg.
  function marker(svg, color) {
    svg._markers = svg._markers || {};
    if (svg._markers[color]) return svg._markers[color];
    var id = 'ks-arrow-' + (++markerId);
    var m = el('marker', { id: id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }, defs(svg));
    el('path', { d: 'M0 0L10 5L0 10z', fill: color }, m);
    return (svg._markers[color] = 'url(#' + id + ')');
  }

  var S = {
    NS: NS, el: el, set: set,

    /** Create a responsive <svg> inside container. */
    create: function (container, o) {
      o = o || {};
      var svg = el('svg', { viewBox: o.viewBox || '0 0 640 360', class: 'diagram' + (o.class ? ' ' + o.class : ''), role: 'img', 'aria-label': o.label || null, preserveAspectRatio: 'xMidYMid meet' });
      if (o.label) el('title', { text: o.label }, svg);
      if (container) container.appendChild(svg);
      return svg;
    },
    group: function (p, a) { return el('g', a, p); },
    line: function (p, x1, y1, x2, y2, a) {
      return el('line', Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' }, a), p);
    },
    circle: function (p, cx, cy, r, a) { return el('circle', Object.assign({ cx: cx, cy: cy, r: r }, a), p); },
    rect: function (p, x, y, w, h, a) { return el('rect', Object.assign({ x: x, y: y, width: w, height: h, rx: 10 }, a), p); },
    path: function (p, d, a) { return el('path', Object.assign({ d: d, fill: 'none' }, a), p); },
    text: function (p, x, y, str, a) {
      var t = el('text', Object.assign({ x: x, y: y, class: 'ks-text' }, a), p);
      String(str).split('\n').forEach(function (line, i) {
        if (i === 0) { t.textContent = line; return; }
        el('tspan', { x: x, dy: '1.25em', text: line }, t);
      });
      return t;
    },
    /** Arrow from (x1,y1) to (x2,y2). a.color, a.bend (px, curves the arrow), a.both (heads on both ends). */
    arrow: function (p, x1, y1, x2, y2, a) {
      a = Object.assign({ color: 'var(--ink)', strokeWidth: 3 }, a);
      var color = a.color, bend = a.bend || 0, both = a.both;
      delete a.color; delete a.bend; delete a.both;
      var d = 'M' + x1 + ' ' + y1;
      if (bend) {
        var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        d += 'Q' + (mx - dy / len * bend) + ' ' + (my + dx / len * bend) + ' ' + x2 + ' ' + y2;
      } else d += 'L' + x2 + ' ' + y2;
      // Markers can't resolve CSS variables, so resolve them to a concrete colour.
      var solid = S.color(color), url = marker(ownerSvg(p), solid);
      return el('path', Object.assign({ d: d, fill: 'none', stroke: solid, strokeLinecap: 'round', 'marker-end': url, 'marker-start': both ? url : null }, a), p);
    },

    /** Resolve "var(--x)" or "--x" to a concrete colour string. */
    color: function (c) {
      var m = /^(?:var\()?\s*(--[\w-]+)\s*\)?$/.exec(c || '');
      if (!m) return c;
      return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || c;
    },

    /** Animate stroke draw-on. targets: element, NodeList or array. Returns a Promise. */
    draw: function (targets, o) {
      o = Object.assign({ duration: 900, delay: 0, stagger: 0, easing: 'cubic-bezier(.2,.8,.2,1)' }, o);
      var list = targets && targets.length != null ? [].slice.call(targets) : [targets];
      return Promise.all(list.map(function (n, i) {
        if (!n || !n.getTotalLength) return null;
        var len = n.getTotalLength();
        n.style.strokeDasharray = len + ' ' + len;
        if (reduced || !n.animate) { n.style.strokeDashoffset = 0; return null; }
        n.style.strokeDashoffset = len;
        var anim = n.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
          { duration: o.duration, delay: o.delay + i * o.stagger, easing: o.easing, fill: 'forwards' });
        return anim.finished.then(function () { n.style.strokeDashoffset = 0; anim.cancel(); });
      }));
    },
    /** Hide stroke so it can be drawn later with S.draw. */
    undraw: function (targets) {
      var list = targets && targets.length != null ? [].slice.call(targets) : [targets];
      list.forEach(function (n) {
        if (!n || !n.getTotalLength || reduced) return;
        var len = n.getTotalLength();
        n.style.strokeDasharray = len + ' ' + len;
        n.style.strokeDashoffset = len;
      });
    },
    /** Scale/fade elements in. */
    pop: function (targets, o) {
      o = Object.assign({ duration: 500, delay: 0, stagger: 80 }, o);
      var list = targets && targets.length != null ? [].slice.call(targets) : [targets];
      return Promise.all(list.map(function (n, i) {
        if (!n || reduced || !n.animate) return null;
        n.style.transformBox = 'fill-box';
        n.style.transformOrigin = 'center';
        return n.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: o.duration, delay: o.delay + i * o.stagger, easing: 'cubic-bezier(.3,1.5,.6,1)', fill: 'backwards' }).finished;
      }));
    },
    /** Call fn(el) once when el scrolls into view. */
    onView: function (node, fn, threshold) {
      if (!('IntersectionObserver' in window)) { fn(node); return; }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(node); } });
      }, { threshold: threshold == null ? 0.3 : threshold });
      io.observe(node);
    }
  };

  Kit.svg = S;

  // Auto draw-on for static markup: <path data-draw> inside any svg.
  function auto() {
    var svgs = new Set();
    document.querySelectorAll('svg [data-draw]').forEach(function (n) { svgs.add(n.ownerSVGElement); });
    svgs.forEach(function (svg) {
      var parts = svg.querySelectorAll('[data-draw]');
      S.undraw(parts);
      S.onView(svg, function () { S.draw(parts, { stagger: 140 }); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})();
