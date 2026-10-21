# Deep Dive briefing kit

Plain HTML/CSS/JS. No build step and no external dependencies. The site is served by GitHub Pages from `main` at `/deep-dive-briefings/`. Every path is relative.

```
_kit/
  kit.css        design system: tokens, type, cards, callouts, pills, chart/player/sources/path styles
  steps.js       scroll/step engine: [data-step], [data-reveal], Next/tap/arrow keys, events
  chart.js       slider-bound SVG line chart: Kit.chart(el, opts) or <div data-chart>
  svg.js         SVG diagram helpers: Kit.svg.create/line/rect/circle/text/arrow/path/group/draw/pop
  audio.js       sticky audio player + lock-screen MediaSession controls: <div data-audio>
  glossary.js    inline term popups (English explainer + Bulgarian): <dfn class="term">, optional glossary.json
  fonts/         Inter 400/700, Fraunces 700 + 400 italic (woff2, self-hosted)
  template/      complete example page (also a live preview at /_kit/template/) + example glossary.json
```

## New topic in 6 steps

1. **Copy the template.** `mkdir <slug> && cp _kit/template/index.html <slug>/index.html`
   (`<slug>` is a short lowercase name such as `heat-pumps`.) Don't edit the loader block at the top of `<head>`.
2. **Add audio.** Put the narration at `<slug>/audio.mp3`. The player reads `data-audio="audio.mp3"`. Also set `data-title`.
3. **Fill in the content.** Search for `EDIT:` comments, then replace the title, hero, sections, callouts, learning path and sources.
   Delete any sections you don't need. Each `<section data-step="id">` is one step.
4. **Data / charts.** Use a preset (`<div data-chart="compound">`), a one-line formula (`data-fn="p.a * pow(x, 2)"`), or `Kit.chart(el, {...})` in JS. Option docs are at the top of `chart.js`.
   Give every chart a no-JS fallback next to it (see [No-JS fallbacks](#no-js-fallbacks)).
   Optional: mark jargon with `<dfn class="term">` and copy `_kit/template/glossary.json` to `<slug>/glossary.json` (or remove `data-glossary` from `<body>`). See [Glossary](#glossary-glossaryjs).
5. **Optional custom JS (about 50 to 100 lines).** Use the last `<script>` block in the template. Build diagrams with `Kit.svg` and hook steps with `Kit.steps.on('step-id', fn)` or `document.addEventListener('kit:step', …)`.
   Images and other assets go in `<slug>/` and are referenced relatively.
6. **List it.** Add an entry at the top of the `TOPICS` array in the root `index.html`:
   `{ slug: 'heat-pumps', title: '…', kicker: 'Home', date: '2026-11-02', color: 'mint', blurb: '…', meta: '~8 min audio' }`

### Test locally

Pages can't be opened as `file://` (`glossary.json` is fetched), so run a static server. Pick one:

- **Serve the repo itself:** `python3 -m http.server --directory <path-to-repo> 8000`
  The repo is the site root, so open `http://localhost:8000/<slug>/` (template: `http://localhost:8000/_kit/template/`).
- **Serve the parent folder** to match the Pages URLs exactly (`/deep-dive-briefings/...`):
  `python3 -m http.server --directory <path-to-repo>/.. 8000`, then open `http://localhost:8000/deep-dive-briefings/<slug>/`.

Both work because every path is relative; the second just mirrors the live URL.

## How the kit paths work

Topic pages live one level deep (`/<slug>/`), so they reach the kit at `../_kit/`. The template itself lives two levels deep (`/_kit/template/`), where that path would point to `/_kit/_kit/`.

To let one file work in both places without symlinks or edits, the template has a three-line loader in `<head>`. It sets `KIT` to `'../'` only when the URL path ends in `/_kit/template/`, and to `'../_kit/'` everywhere else. It then writes the stylesheet and script tags with `document.write`, so they still load synchronously and in order. A `<noscript>` stylesheet covers readers without JS.

Other options I rejected:
- `<base href>`: breaks `#S1` anchor links.
- Absolute `/deep-dive-briefings/...` paths: break local preview and repo renames.
- Duplicate preview files: they drift out of sync.

If you'd rather use plain tags in a topic page, replace the loader with `<link rel="stylesheet" href="../_kit/kit.css">` and `<script src="../_kit/{svg,chart,steps,audio,glossary}.js">`, keeping that order. Also keep `document.documentElement.classList.add('js')`.

The `<noscript>` stylesheet uses `../_kit/kit.css`, which is right for topic pages. In the template preview at `/_kit/template/` it doesn't resolve, so no-JS styling only shows on real topic pages.

**Favicon.** The template has an inline SVG favicon as a `data:` URI (`<link rel="icon" href="data:image/svg+xml,…">`), so it needs no file and no path. To recolour it, edit the `fill='%23rrggbb'` values (`%23` is `#`).

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
| Glossary term | `<dfn class="term" data-en="Plain explainer" data-bg="превод">word</dfn>`; `data-term="key"` if the text differs |
| Glossary file | `<body data-glossary="glossary.json">` |
| Only with JS / only without | `class="js-only"` / `class="no-js"` |

## Glossary (glossary.js)

Mark jargon inline. The term gets a faint dotted underline, and a small popup shows the term, a 1–2 line plain-English explainer, and the Bulgarian translation.

```html
<dfn class="term" data-en="How hard the water is pushed through the coffee." data-bg="налягане">pressure</dfn>
<dfn class="term">crema</dfn>                      <!-- filled from glossary.json -->
<dfn class="term" data-term="crema">the crema</dfn> <!-- lookup key differs from the text -->
```

**glossary.json (optional).** Turn it on with `<body data-glossary="glossary.json">`. The path is relative to the page, so it lives at `<slug>/glossary.json`. Keys are terms, matched case-insensitively against `data-term` or the element's text. A value is `{ "en": "…", "bg": "…" }`, or just a string for `en`. The file only fills in `data-en`/`data-bg` that the markup leaves out, so inline attributes always win. A term with neither attribute stays plain text with no popup. If the file fails to load, the console shows a warning and the inline attributes still work.

```json
{ "pressure": { "en": "How hard the water is pushed through the coffee.", "bg": "налягане" } }
```

**Behaviour.**
- Mouse: opens on hover. You can move into the popup; clicking the term keeps it open.
- Keyboard: opens on focus. Enter/Space toggles it. Esc closes it and returns focus to the term.
- Touch: a tap toggles it. Tapping outside closes it (so does clicking outside).
- Only one popup is open at a time. Tapping a term inside a `data-step-tap` step doesn't advance the step.
- Placement: above the term, or below it if there's no room above. It's clamped horizontally with an 8px margin and is at most `min(320px, 100vw − 16px)` wide, so it fits fully on a 390px screen. It moves with scroll and resize.
- Theme: a dark popup on light sections, and a light one inside `.band`, `.hero` and `.card.dark`. It uses kit tokens, so `--accent` carries through.
- The fade-in is turned off under `prefers-reduced-motion`. It's hidden in print.

**Accessibility.** Each enhanced term gets `tabindex="0"`, `role="button"` and `aria-expanded`. While open, it also gets `aria-describedby` pointing to the popup. The popup is a single shared `role="tooltip"` element with a unique id, and the translation is marked `lang="bg"`. Without JS, the `<dfn>` is just ordinary text.

API: `Kit.glossary.refresh()` (enhance terms added later), `.open(el)`, `.close()`, `.data`.

## No-JS fallbacks

The loader adds `html.js` as soon as JS runs. If the kit scripts fail to load, the failsafe removes it again. Two helper classes build on that:

- `.js-only`: hidden unless `html.js` is present. Use it for controls that do nothing without JS.
- `.no-js`: hidden when `html.js` is present. Use it for static stand-ins.

Charts draw nothing without JS, so put a `.no-js` static version right after each `data-chart`. That can be a small table of key values, or a caption that states the numbers. Use `.no-js` rather than `<noscript>`, because it also covers the failsafe case where JS is on but the kit failed to load. Keep the figures in sync with the chart's default slider values. The template shows both forms: a table under the compound chart, and a one-line caption under the Rule of 72 chart.

## Events

`kit:step` (on document): `{index, id, el, prev, direction}`. `kit:enter` / `kit:leave` fire on the step element. `kit:reveal`: `{el, step, fragment}`. `kit:chart` fires on the chart element: `{params}`.

## Rules

- Never edit `/grinder/`; it predates the kit and stays standalone.
- Animations respect `prefers-reduced-motion`. Content stays visible without JS. Charts need a `.no-js` fallback.
- No secrets, trackers or third-party scripts.
