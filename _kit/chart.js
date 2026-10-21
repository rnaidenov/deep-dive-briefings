/* Deep Dive kit · chart.js
   Slider-bound line chart, pure SVG. No dependencies.

   JS API:
     Kit.chart(el, {
       fn: function (x, p) { return p.start * Math.pow(1 + p.rate / 100, x); },   // one series, or:
       series: [{ fn, label, color: 'var(--coral)', area: true, dash: false }],
       x: { min: 0, max: 'years', label: 'Years', format: 'int', integer: true },  // max may name a slider
       y: { min: 0, max: 'auto', label: 'Value', format: 'money' },
       sliders: [{ name: 'rate', label: 'Annual return', min: 0, max: 15, step: 0.5, value: 7, format: 'pct' }],
       readout: function (p, r) { return 'After ' + r.x + ' years: <b>' + r.fmtY(r.y[0]) + '</b>'; },
       title: 'Accessible description', aspect: 0.6, currency: '€'
     })  → { params, set(name, value), update(), el }

   Declarative (auto-initialised):
     <div data-chart="compound"></div>                          preset
     <div data-chart data-fn="p.a * x * x" data-x="0,10" data-y="0,auto"
          data-x-label="x" data-y-label="y" data-y-format="int"
          data-sliders='[{"name":"a","label":"a","min":1,"max":5,"value":2}]'></div>
     Any data-* option overrides the preset's.

   Formats: 'int', 'dec', 'pct', 'money', 'x' (multiplier), or a template like '{v} yrs'.
   Events: el dispatches 'kit:chart' {params} on every change. */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['var(--violet)', 'var(--coral)', 'var(--mint)', 'var(--sky)', 'var(--sun)', 'var(--pink)'];
  var uid = 0;

  function mk(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function formatter(f, currency) {
    if (typeof f === 'function') return f;
    var cur = currency || '€';
    var compact = function (v, d) {
      var a = Math.abs(v), s = v < 0 ? '-' : '';
      if (a >= 1e9) return s + +(a / 1e9).toFixed(d) + 'B';
      if (a >= 1e6) return s + +(a / 1e6).toFixed(d) + 'M';
      if (a >= 1e4) return s + +(a / 1e3).toFixed(d) + 'k';
      return s + Math.round(a).toLocaleString('en');
    };
    switch (f) {
      case 'int': return function (v) { return Math.round(v).toLocaleString('en'); };
      case 'dec': return function (v) { return (+v).toFixed(1); };
      case 'pct': return function (v) { return +(+v).toFixed(2) + '%'; };
      case 'money': return function (v) { return cur + compact(v, 1); };
      case 'x': return function (v) { return +(+v).toFixed(2) + '×'; };
      default:
        if (typeof f === 'string' && f.indexOf('{v}') > -1) return function (v) { return f.replace('{v}', +(+v).toFixed(2)); };
        return function (v) { return +(+v).toPrecision(4) + ''; };
    }
  }

  // "Nice" axis ticks (1, 2, 5 × 10^n).
  function ticks(min, max, count) {
    var span = max - min || 1, raw = span / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    var out = [], start = Math.ceil(min / step - 1e-9) * step;
    for (var v = start; v <= max + step * 1e-6; v += step) out.push(+v.toPrecision(12));
    return { list: out, step: step };
  }

  function chart(el, o) {
    o = o || {};
    var currency = o.currency;
    var x = Object.assign({ min: 0, max: 10, label: '', format: null }, o.x);
    var y = Object.assign({ min: 0, max: 'auto', label: '', format: null }, o.y);
    var series = (o.series || [{ fn: o.fn, label: o.label || '' }]).map(function (s, i) {
      return Object.assign({ color: COLORS[i % COLORS.length], area: i === 0 && o.area !== false }, s);
    });
    var fx = formatter(x.format || 'dec', currency), fy = formatter(y.format, currency);
    var params = {};
    var id = 'kc' + (++uid);

    el.classList.add('kchart');
    var box = document.createElement('div');

    // Sliders
    var controls = document.createElement('div');
    controls.className = 'kchart-controls';
    (o.sliders || []).forEach(function (s) {
      var fmt = formatter(s.format, currency);
      var lab = document.createElement('label');
      lab.className = 'kchart-slider';
      var name = document.createElement('span');
      name.textContent = s.label || s.name;
      var out = document.createElement('output');
      var input = document.createElement('input');
      input.type = 'range';
      input.min = s.min; input.max = s.max; input.step = s.step || 1; input.value = s.value != null ? s.value : s.min;
      params[s.name] = +input.value;
      out.textContent = fmt(params[s.name]);
      input.addEventListener('input', function () {
        params[s.name] = +input.value;
        out.textContent = fmt(params[s.name]);
        input.setAttribute('aria-valuetext', out.textContent);
        update();
      });
      input.setAttribute('aria-valuetext', out.textContent);
      lab.appendChild(name); lab.appendChild(out); lab.appendChild(input);
      controls.appendChild(lab);
      s._input = input; s._out = out; s._fmt = fmt;
    });
    if ((o.sliders || []).length) box.appendChild(controls);

    var plot = document.createElement('div');
    plot.className = 'kchart-plot';
    var svg = mk('svg', { role: 'img', 'aria-labelledby': id + 't' }, plot);
    var title = mk('title', { id: id + 't' }, svg);
    box.appendChild(plot);

    if (series.length > 1 || series[0].label) {
      var legend = document.createElement('div');
      legend.className = 'kchart-legend';
      series.forEach(function (s) {
        var item = document.createElement('span');
        item.innerHTML = '<i></i>';
        item.firstChild.style.background = s.color;
        item.appendChild(document.createTextNode(s.label));
        legend.appendChild(item);
      });
      box.appendChild(legend);
    }
    var readout = document.createElement('div');
    readout.className = 'kchart-readout';
    readout.setAttribute('aria-live', 'polite');
    box.appendChild(readout);
    el.insertBefore(box, el.firstChild);

    var hoverX = null, last = null;

    function resolve(v) { return typeof v === 'string' && v in params ? params[v] : v; }

    function compute() {
      var x0 = +resolve(x.min), x1 = +resolve(x.max);
      if (!(x1 > x0)) x1 = x0 + 1;
      var xs = [];
      if (x.integer) for (var i = Math.ceil(x0); i <= x1; i++) xs.push(i);
      else { var n = o.samples || 120; for (var j = 0; j <= n; j++) xs.push(x0 + (x1 - x0) * j / n); }
      var ys = series.map(function (s) { return xs.map(function (v) { var r = +s.fn(v, params); return isFinite(r) ? r : NaN; }); });
      var lo = y.min === 'auto' ? Infinity : +resolve(y.min), hi = y.max === 'auto' ? -Infinity : +resolve(y.max);
      ys.forEach(function (arr) { arr.forEach(function (v) { if (!isFinite(v)) return; if (y.min === 'auto') lo = Math.min(lo, v); if (y.max === 'auto') hi = Math.max(hi, v); }); });
      if (!isFinite(lo)) lo = 0; if (!isFinite(hi)) hi = lo + 1;
      if (hi === lo) hi = lo + 1;
      return { x0: x0, x1: x1, xs: xs, ys: ys, lo: lo, hi: hi };
    }

    function render() {
      var W = Math.round(plot.clientWidth) || 600;
      var H = Math.round(Math.min(440, Math.max(220, W * (o.aspect || 0.6))));
      var d = compute();
      var yt = ticks(d.lo, d.hi, H < 280 ? 4 : 5);
      // Auto bounds snap outward to the next tick.
      if (y.max === 'auto') { var top = Math.ceil(d.hi / yt.step - 1e-9) * yt.step; if (top > d.hi + 1e-9) { d.hi = top; yt.list.push(+top.toPrecision(12)); } }
      if (y.min === 'auto') { var bot = Math.floor(d.lo / yt.step + 1e-9) * yt.step; if (bot < d.lo - 1e-9) { d.lo = bot; yt.list.unshift(+bot.toPrecision(12)); } }
      var xt = ticks(d.x0, d.x1, W < 420 ? 4 : 7);
      var yLabels = yt.list.map(fy);
      var padL = 14 + Math.max.apply(null, yLabels.map(function (s) { return s.length; })) * 7;
      var pad = { l: padL, r: 18 + (W < 420 ? 44 : 64), t: y.label ? 30 : 14, b: x.label ? 52 : 32 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var sx = function (v) { return pad.l + (v - d.x0) / (d.x1 - d.x0) * iw; };
      var sy = function (v) { return pad.t + (1 - (v - d.lo) / (d.hi - d.lo)) * ih; };

      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      while (svg.lastChild !== title) svg.removeChild(svg.lastChild);

      var grid = mk('g', { class: 'kc-grid' }, svg);
      yt.list.forEach(function (v, i) {
        if (v < d.lo || v > d.hi) return;
        mk('line', { x1: pad.l, x2: W - pad.r, y1: sy(v), y2: sy(v) }, grid);
        mk('text', { x: pad.l - 8, y: sy(v) + 4, 'text-anchor': 'end' }, svg).textContent = yLabels[i];
      });
      xt.list.forEach(function (v) {
        mk('text', { x: sx(v), y: H - pad.b + 20, 'text-anchor': 'middle' }, svg).textContent = fx(v);
      });
      mk('line', { class: 'kc-axis', x1: pad.l, x2: W - pad.r, y1: sy(Math.max(d.lo, Math.min(d.hi, 0))), y2: sy(Math.max(d.lo, Math.min(d.hi, 0))) }, svg);
      mk('line', { class: 'kc-axis', x1: pad.l, x2: pad.l, y1: pad.t, y2: H - pad.b }, svg);
      if (x.label) mk('text', { x: pad.l + iw / 2, y: H - 8, 'text-anchor': 'middle', 'font-weight': 700 }, svg).textContent = x.label;
      if (y.label) mk('text', { x: pad.l - 8, y: 14, 'text-anchor': 'start', 'font-weight': 700 }, svg).textContent = y.label;

      var base = sy(Math.max(d.lo, Math.min(d.hi, 0)));
      var ends = [];
      series.forEach(function (s, si) {
        var pts = [];
        d.xs.forEach(function (v, i) { var yv = d.ys[si][i]; if (isFinite(yv)) pts.push([sx(v), sy(Math.max(d.lo, Math.min(d.hi, yv)))]); });
        if (!pts.length) return;
        var line = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
        if (s.area) mk('path', { class: 'kc-area', d: line + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + base + 'L' + pts[0][0].toFixed(1) + ' ' + base + 'Z', style: 'fill:' + s.color }, svg);
        mk('path', { class: 'kc-line', d: line, style: 'stroke:' + s.color + (s.dash ? ';stroke-dasharray:6 6' : '') }, svg);
        var lp = pts[pts.length - 1];
        mk('circle', { cx: lp[0], cy: lp[1], r: 5, style: 'fill:' + s.color }, svg);
        ends.push({ y: lp[1], x: lp[0], text: fy(d.ys[si][d.ys[si].length - 1]), color: s.color });
      });
      // End labels, nudged apart so they don't overlap.
      ends.sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
      ends.forEach(function (e) {
        mk('text', { class: 'kc-end', x: e.x + 9, y: e.y + 4, style: 'fill:' + e.color }, svg).textContent = e.text;
      });

      // Hover / touch readout
      if (hoverX != null) {
        var xi = 0, best = Infinity;
        d.xs.forEach(function (v, i) { var dist = Math.abs(sx(v) - hoverX); if (dist < best) { best = dist; xi = i; } });
        var hx = sx(d.xs[xi]);
        var hg = mk('g', { class: 'kc-hover' }, svg);
        mk('line', { x1: hx, x2: hx, y1: pad.t, y2: H - pad.b }, hg);
        var lines = [x.label ? x.label + ': ' + fx(d.xs[xi]) : fx(d.xs[xi])];
        series.forEach(function (s, si) {
          var yv = d.ys[si][xi];
          if (!isFinite(yv)) return;
          mk('circle', { cx: hx, cy: sy(Math.max(d.lo, Math.min(d.hi, yv))), r: 5, style: 'fill:' + s.color + ';stroke:#fff;stroke-width:2' }, hg);
          lines.push((s.label ? s.label + ': ' : '') + fy(yv));
        });
        var tw = Math.max.apply(null, lines.map(function (l) { return l.length; })) * 6.8 + 20, th = lines.length * 17 + 12;
        var tx = hx + 12 + tw > W ? hx - 12 - tw : hx + 12;
        var tip = mk('g', { class: 'kc-tip', transform: 'translate(' + tx + ',' + pad.t + ')' }, hg);
        mk('rect', { width: tw, height: th, rx: 8 }, tip);
        lines.forEach(function (l, i) { mk('text', { x: 10, y: 20 + i * 17, 'font-weight': i ? 400 : 700 }, tip).textContent = l; });
      }

      var lastY = series.map(function (s, si) { return d.ys[si][d.ys[si].length - 1]; });
      title.textContent = (o.title || 'Chart') + '. At ' + (x.label || 'x') + ' ' + fx(d.x1) + ': ' +
        series.map(function (s, si) { return (s.label ? s.label + ' ' : '') + fy(lastY[si]); }).join(', ') + '.';
      last = { x: d.x1, y: lastY, xs: d.xs, ys: d.ys, fmtX: fx, fmtY: fy, params: params };
    }

    var queued = false;
    function update() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        render();
        if (o.readout) readout.innerHTML = o.readout(params, last);
        el.dispatchEvent(new CustomEvent('kit:chart', { detail: { params: params }, bubbles: true }));
      });
    }

    plot.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      hoverX = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
      update();
    });
    plot.addEventListener('pointerleave', function () { hoverX = null; update(); });

    if ('ResizeObserver' in window) {
      var lastW = 0;
      new ResizeObserver(function () { var w = plot.clientWidth; if (w !== lastW) { lastW = w; update(); } }).observe(plot);
    } else addEventListener('resize', update);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    update();

    return {
      el: el, params: params, update: update,
      set: function (name, v) {
        (o.sliders || []).forEach(function (s) {
          if (s.name !== name) return;
          s._input.value = v;
          params[name] = +s._input.value;
          s._out.textContent = s._fmt(params[name]);
        });
        update();
      }
    };
  }

  /* ---- Presets ---- */
  chart.presets = {
    // Compound growth with monthly contributions vs. money put in.
    compound: {
      title: 'Compound growth',
      x: { min: 0, max: 'years', label: 'Years', format: 'int', integer: true },
      y: { min: 0, max: 'auto', label: 'Balance', format: 'money' },
      sliders: [
        { name: 'start', label: 'Starting amount', min: 0, max: 50000, step: 500, value: 10000, format: 'money' },
        { name: 'monthly', label: 'Added each month', min: 0, max: 2000, step: 25, value: 200, format: 'money' },
        { name: 'rate', label: 'Yearly return', min: 0, max: 15, step: 0.5, value: 7, format: 'pct' },
        { name: 'years', label: 'Years', min: 1, max: 50, step: 1, value: 30, format: '{v} yrs' }
      ],
      series: [
        { label: 'Balance', color: 'var(--violet)', fn: function (t, p) {
          var r = p.rate / 100 / 12, n = t * 12, g = Math.pow(1 + r, n);
          return p.start * g + (r ? p.monthly * (g - 1) / r : p.monthly * n);
        } },
        { label: 'Money put in', color: 'var(--coral)', area: false, dash: true, fn: function (t, p) { return p.start + p.monthly * 12 * t; } }
      ],
      readout: function (p, r) {
        var bal = r.y[0], paid = r.y[1];
        return 'After <b>' + r.x + ' years</b> you have <b>' + r.fmtY(bal) + '</b>. You put in ' + r.fmtY(paid) +
          '; growth added <b>' + r.fmtY(bal - paid) + '</b> (' + (paid > 0 ? (bal / paid).toFixed(1) + '× your money' : '—') + ').';
      }
    }
  };

  function fromData(el) {
    var ds = el.dataset, o = {};
    var preset = chart.presets[ds.chart];
    if (preset) o = Object.assign({}, preset, { x: Object.assign({}, preset.x), y: Object.assign({}, preset.y) });
    var pair = function (s) { return s.split(',').map(function (v) { v = v.trim(); return isNaN(+v) ? v : +v; }); };
    if (ds.fn) {
      var f = new Function('x', 'p', 'with (Math) { return (' + ds.fn + '); }');
      o.series = [{ fn: f, label: ds.label || '' }];
    }
    o.x = o.x || {}; o.y = o.y || {};
    if (ds.x) { var xr = pair(ds.x); o.x.min = xr[0]; o.x.max = xr[1]; }
    if (ds.y) { var yr = pair(ds.y); o.y.min = yr[0]; o.y.max = yr[1]; }
    if (ds.xLabel) o.x.label = ds.xLabel;
    if (ds.yLabel) o.y.label = ds.yLabel;
    if (ds.xFormat) o.x.format = ds.xFormat;
    if (ds.yFormat) o.y.format = ds.yFormat;
    if (ds.xInteger != null) o.x.integer = true;
    if (ds.sliders) o.sliders = JSON.parse(ds.sliders);
    if (ds.title) o.title = ds.title;
    if (ds.currency) o.currency = ds.currency;
    if (ds.aspect) o.aspect = +ds.aspect;
    if (!o.series && !o.fn) { console.warn('Kit.chart: no data-fn or preset for', el); return; }
    el._kitChart = chart(el, o);
  }

  chart.formatter = formatter;
  Kit.chart = chart;

  function auto() { document.querySelectorAll('[data-chart]').forEach(function (el) { if (!el._kitChart) fromData(el); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})();
