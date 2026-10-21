# Deep Dive briefing kit

Plain HTML/CSS/JS. No build step and no external dependencies. The site is served by GitHub Pages from `main` at `/deep-dive-briefings/`. Every path is relative.

```
_kit/
  kit.css        design system: tokens, type, cards, callouts, pills, chart/player/sources/path styles
  steps.js       scroll/step engine: [data-step], [data-reveal], Next/tap/arrow keys, events
  chart.js       slider-bound SVG line chart: Kit.chart(el, opts) or <div data-chart>
  svg.js         SVG diagram helpers: Kit.svg.create/line/rect/circle/text/arrow/path/group/draw/pop
  audio.js       sticky audio player + lock-screen MediaSession controls: <div data-audio>
  fonts/         Inter 400/700, Fraunces 700 + 400 italic (woff2, self-hosted)
  template/      complete example page (also a live preview at /_kit/template/)
```

## New topic in 6 steps

1. **Copy the template.** `mkdir <slug> && cp _kit/template/index.html <slug>/index.html`
   (`<slug>` is a short lowercase name such as `heat-pumps`.) Don't edit the loader block at the top of `<head>`.
2. **Add audio.** Put the narration at `<slug>/audio.mp3`. The player reads `data-audio="audio.mp3"`. Also set `data-title`.
3. **Fill in the content.** Search for `EDIT:` comments, then replace the title, hero, sections, callouts, learning path and sources.
   Delete any sections you don't need. Each `<section data-step="id">` is one step.
4. **Data / charts.** Use a preset (`<div data-chart="compound">`), a one-line formula (`data-fn="p.a * pow(x, 2)"`), or `Kit.chart(el, {...})` in JS. Option docs are at the top of `chart.js`.
5. **Optional custom JS (about 50 to 100 lines).** Use the last `<script>` block in the template. Build diagrams with `Kit.svg` and hook steps with `Kit.steps.on('step-id', fn)` or `document.addEventListener('kit:step', …)`.
   Images and other assets go in `<slug>/` and are referenced relatively.
6. **List it.** Add an entry at the top of the `TOPICS` array in the root `index.html`:
   `{ slug: 'heat-pumps', title: '…', kicker: 'Home', date: '2026-11-02', color: 'mint', blurb: '…', meta: '~8 min audio' }`

Check locally by serving from the repo's **parent** folder so the URL matches Pages:
`cd .. && python3 -m http.server 8000`, then open `http://localhost:8000/deep-dive-briefings/<slug>/`.

## How the kit paths work

Topic pages live one level deep (`/<slug>/`), so they reach the kit at `../_kit/`. The template itself lives two levels deep (`/_kit/template/`), where that path would point to `/_kit/_kit/`.

To let one file work in both places without symlinks or edits, the template has a three-line loader in `<head>`. It sets `KIT` to `'../'` only when the URL path ends in `/_kit/template/`, and to `'../_kit/'` everywhere else. It then writes the stylesheet and script tags with `document.write`, so they still load synchronously and in order. A `<noscript>` stylesheet covers readers without JS.

Other options I rejected:
- `<base href>`: breaks `#S1` anchor links.
- Absolute `/deep-dive-briefings/...` paths: break local preview and repo renames.
- Duplicate preview files: they drift out of sync.

If you'd rather use plain tags in a topic page, replace the loader with `<link rel="stylesheet" href="../_kit/kit.css">` and `<script src="../_kit/{svg,chart,steps,audio}.js">`, keeping that order. Also keep `document.documentElement.classList.add('js')`.

## Markup cheat-sheet

| Want | Markup |
|---|---|
| Step (tracked, animates in) | `<section data-step="id">` |
| Reveal on scroll | `data-reveal` (`fade`, `zoom`, `left`, `right`, `pop`); `data-delay="200"` |
| Click-to-build fragment | `data-reveal="next"` inside a step; `data-step-tap` on the step makes tapping it advance |
| Floating Next/Prev + progress | `<body data-step-nav>` (keys: → next, ← previous) |
| Dark full-bleed section | `class="band"` |
| Card | `.card` (+ `coral sun mint sky violet pink`, `dark`, `solid-coral`…), `.card.ill` with svg + text |
| Callout | `.callout` (+ `key warn tip example`), optional `<span class="callout-title">` |
| Evidence tag | `<span class="pill fact|est|op|what|new">` |
| Key points | `<ol class="points">` |
| Citation | `<a class="cite" href="#S1">S1</a>` → `<li id="S1">` in `.source-list` |
| Learning path | `<ol class="path"><li class="path-step" data-level="start|next|deep|expert" data-n="1">` |
| Draw-on stroke (static SVG) | `data-draw` on a `<path>`/`<line>` |
| Accent colour | `:root { --accent: var(--mint) }` |

## Events

`kit:step` (on document): `{index, id, el, prev, direction}`. `kit:enter` / `kit:leave` fire on the step element. `kit:reveal`: `{el, step, fragment}`. `kit:chart` fires on the chart element: `{params}`.

## Rules

- Never edit `/grinder/`; it predates the kit and stays standalone.
- Animations respect `prefers-reduced-motion`. Content stays visible without JS.
- No secrets, trackers or third-party scripts.
