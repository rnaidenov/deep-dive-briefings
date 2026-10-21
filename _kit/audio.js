/* Deep Dive kit · audio.js
   Sticky bottom audio player with lock-screen controls (MediaSession). No dependencies.

   Markup (the inner <audio> is the no-JS fallback; JS hides it and builds the UI):
     <div class="player" data-audio="audio.mp3" data-title="Episode title"
          data-artist="Deep Dive" data-album="Deep Dive briefings" data-artwork="cover.png">
       <audio controls preload="metadata" src="audio.mp3"></audio>
     </div>

   Features: play/pause, ±15 s, speed cycle 0.75–2×, scrub bar, time display, download link,
   remembers position per file and preferred speed (localStorage).
   API: Kit.audio(el) → { audio, play(), pause(), seek(seconds), skip(delta) } */
(function () {
  'use strict';
  var Kit = window.Kit = window.Kit || {};
  var SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>'
  };

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + sec : m + ':' + sec;
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  function player(el) {
    var src = el.getAttribute('data-audio') || 'audio.mp3';
    var title = el.getAttribute('data-title') || document.title;
    var au = el.querySelector('audio') || document.createElement('audio');
    if (!au.parentNode) el.appendChild(au);
    au.preload = 'metadata';
    if (au.getAttribute('src') !== src) au.src = src;
    au.removeAttribute('controls');

    var ui = document.createElement('div');
    ui.innerHTML =
      '<button type="button" class="pl-play" aria-label="Play">' + ICON.play + '</button>' +
      '<div class="pl-top"><span class="pl-title"></span><span class="pl-time">0:00 / 0:00</span></div>' +
      '<div class="pl-bottom">' +
      '<button type="button" class="pl-btn pl-back" aria-label="Back 15 seconds">' + ICON.back + '15</button>' +
      '<input type="range" class="pl-scrub" min="0" max="1000" step="1" value="0" aria-label="Seek">' +
      '<button type="button" class="pl-btn pl-fwd" aria-label="Forward 15 seconds">15' + ICON.fwd + '</button>' +
      '<button type="button" class="pl-btn pl-speed" aria-label="Playback speed">1×</button>' +
      '<a class="pl-btn pl-dl" download>MP3</a>' +
      '</div>';
    while (ui.firstChild) el.appendChild(ui.firstChild);
    el.setAttribute('role', 'region');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Audio narration');

    var $ = function (c) { return el.querySelector(c); };
    var btn = $('.pl-play'), time = $('.pl-time'), scrub = $('.pl-scrub'), speed = $('.pl-speed');
    $('.pl-title').textContent = title;
    $('.pl-dl').href = src;
    $('.pl-dl').setAttribute('aria-label', 'Download MP3');

    var key = 'kit-audio:' + new URL(src, location.href).pathname;
    var dragging = false, lastSave = 0;

    var rate = +store('kit-audio-rate') || 1;
    if (SPEEDS.indexOf(rate) < 0) rate = 1;

    function setRate(r) {
      rate = r;
      au.playbackRate = au.defaultPlaybackRate = r;
      speed.textContent = r + '×';
      speed.setAttribute('aria-label', 'Playback speed ' + r + '×');
      store('kit-audio-rate', r);
    }
    function position() {
      var ms = navigator.mediaSession;
      if (!ms || !ms.setPositionState || !isFinite(au.duration) || !au.duration) return;
      try { ms.setPositionState({ duration: au.duration, playbackRate: au.playbackRate, position: Math.min(au.currentTime, au.duration) }); } catch (e) {}
    }
    function paint() {
      var d = au.duration, t = au.currentTime;
      time.textContent = fmt(t) + ' / ' + fmt(d);
      if (!dragging) scrub.value = d ? Math.round(t / d * 1000) : 0;
      scrub.style.setProperty('--p', (scrub.value / 10) + '%');
      scrub.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
      var playing = !au.paused;
      btn.innerHTML = playing ? ICON.pause : ICON.play;
      btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      el.classList.toggle('is-playing', playing);
    }
    function save(force) {
      var now = Date.now();
      if (!force && now - lastSave < 4000) return;
      lastSave = now;
      var t = au.currentTime;
      store(key, au.ended || t < 5 || (au.duration && au.duration - t < 10) ? 0 : t.toFixed(1));
    }
    function seek(t) {
      if (!isFinite(au.duration)) return;
      au.currentTime = Math.max(0, Math.min(au.duration, t));
      paint(); position();
    }
    function skip(dt) { seek(au.currentTime + dt); }
    function play() { var p = au.play(); if (p && p.catch) p.catch(function () {}); }

    btn.addEventListener('click', function () { au.paused ? play() : au.pause(); });
    $('.pl-back').addEventListener('click', function () { skip(-15); });
    $('.pl-fwd').addEventListener('click', function () { skip(15); });
    speed.addEventListener('click', function () { setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length]); position(); });

    scrub.addEventListener('input', function () {
      dragging = true;
      var t = scrub.value / 1000 * (au.duration || 0);
      time.textContent = fmt(t) + ' / ' + fmt(au.duration);
      scrub.style.setProperty('--p', (scrub.value / 10) + '%');
    });
    scrub.addEventListener('change', function () {
      dragging = false;
      seek(scrub.value / 1000 * (au.duration || 0));
    });

    function onMeta() {
      var saved = +store(key);
      if (saved > 5 && saved < au.duration - 10) au.currentTime = saved;
      setRate(rate);
      paint(); position();
    }
    au.addEventListener('loadedmetadata', onMeta);
    if (au.readyState >= 1) onMeta();
    au.addEventListener('timeupdate', function () { paint(); save(); });
    ['play', 'pause', 'ratechange', 'seeked', 'durationchange'].forEach(function (ev) {
      au.addEventListener(ev, function () { paint(); position(); });
    });
    au.addEventListener('play', function () { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; });
    au.addEventListener('pause', function () { save(true); if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; });
    au.addEventListener('ended', function () { save(true); });
    function fail() { el.classList.add('is-error'); btn.disabled = true; }
    au.addEventListener('error', fail);
    if (au.error) fail();
    addEventListener('pagehide', function () { save(true); });

    // Lock-screen / headphone controls.
    if ('mediaSession' in navigator) {
      var ms = navigator.mediaSession;
      try {
        var art = el.getAttribute('data-artwork');
        ms.metadata = new MediaMetadata({
          title: title,
          artist: el.getAttribute('data-artist') || 'Deep Dive',
          album: el.getAttribute('data-album') || 'Deep Dive briefings',
          artwork: art ? [{ src: new URL(art, location.href).href, sizes: '512x512' }] : []
        });
      } catch (e) {}
      var actions = {
        play: play,
        pause: function () { au.pause(); },
        stop: function () { au.pause(); seek(0); },
        seekbackward: function (d) { skip(-(d && d.seekOffset || 15)); },
        seekforward: function (d) { skip(d && d.seekOffset || 15); },
        seekto: function (d) {
          if (d.fastSeek && 'fastSeek' in au) { au.fastSeek(d.seekTime); position(); }
          else seek(d.seekTime);
        }
      };
      Object.keys(actions).forEach(function (a) { try { ms.setActionHandler(a, actions[a]); } catch (e) {} });
    }

    setRate(rate);
    el.classList.add('is-ready');
    document.body.classList.add('has-player');
    // Expose player height so other fixed UI (step nav) and body padding can clear it.
    function measure() { document.documentElement.style.setProperty('--player-h', el.offsetHeight + 'px'); }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(el); else measure();
    paint();

    return { audio: au, play: play, pause: function () { au.pause(); }, seek: seek, skip: skip };
  }

  Kit.audio = player;

  function auto() { document.querySelectorAll('[data-audio]').forEach(function (el) { if (!el._kitAudio) el._kitAudio = player(el); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})();
