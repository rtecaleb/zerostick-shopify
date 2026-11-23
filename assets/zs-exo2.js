/* ==========================================================================
   ZeroStick EXO v2 — shared behaviour for every staged EXO page
   --------------------------------------------------------------------------
   Load it once per page with:
     <script src="{{ 'zs-exo2.js' | asset_url }}" defer></script>
   It looks for these hooks (all optional) inside any element with class .x2:

   [data-reveal]        fades/slides in when scrolled into view (CSS in zs-exo2.css)
   [data-x2-progress]   gets a CSS variable --p from 0 to 1 while it crosses
                        the screen, so CSS can tie movement to scrolling
   [data-x2-story]      sticky "story": the phone image changes as each
                        [data-step] text block reaches the middle of the screen
   [data-x2-model]      a 3D viewer; the model-viewer library is only
                        downloaded when the viewer is close to the screen
   [data-x2-filter]     filter buttons for the games grid
   [data-x2-glow]       cards whose glow follows the mouse pointer

   Anyone with "reduced motion" switched on gets no movement: no auto-rotate,
   no scroll-linked motion, content is simply shown.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var roots = document.querySelectorAll('.x2');
  if (!roots.length) return;
  roots.forEach(function (r) { r.classList.add('x2-js'); });

  /* ---------- 1. reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.x2 [data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 2. scroll progress (--p from 0 to 1) ---------- */
  var progEls = Array.prototype.slice.call(document.querySelectorAll('.x2 [data-x2-progress]'));
  var ticking = false;
  function updateProgress() {
    ticking = false;
    var vh = window.innerHeight;
    progEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      // 0 when the element's top reaches the bottom of the screen,
      // 1 when its bottom leaves the top of the screen
      var p = (vh - r.top) / (vh + r.height);
      p = Math.max(0, Math.min(1, p));
      el.style.setProperty('--p', p.toFixed(4));
    });
  }
  if (progEls.length && !reduce) {
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
    }, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
  }

  /* ---------- 3. sticky story ---------- */
  document.querySelectorAll('.x2 [data-x2-story]').forEach(function (story) {
    var steps = story.querySelectorAll('[data-step]');
    var shots = story.querySelectorAll('[data-shot]');
    function show(i) {
      steps.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
      shots.forEach(function (img, n) {
        img.classList.toggle('is-on', n === i);
        // load the image just before it is needed
        if (Math.abs(n - i) <= 1 && img.dataset.src && !img.src) img.src = img.dataset.src;
      });
    }
    show(0);
    if (!('IntersectionObserver' in window)) return;
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) show(Array.prototype.indexOf.call(steps, e.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    steps.forEach(function (s) { so.observe(s); });
  });

  /* ---------- 4. 3D model: load model-viewer only when needed ----------
     The model is the Draco-compressed web GLB. model-viewer is told where
     Google's Draco decoder lives before any model is set; if the Draco model
     (or the decoder) fails, the uncompressed GLB in data-fallback loads once.
     A stage with data-x2-rainbow cycles the logo glow through the rainbow
     (logo_insert + the 4 LED lenses, via setEmissiveFactor). */
  var MV_SRC = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  var DRACO = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
  var GLOW = ['logo_insert', 'leds_D301_lens', 'leds_D302_lens', 'leds_D304_lens', 'leds_D305_lens'];
  var mvLoading = false;
  function loadModelViewer() {
    if (mvLoading || window.customElements && customElements.get('model-viewer')) return;
    if (document.querySelector('script[data-mv-lib]')) return;
    mvLoading = true;
    var s = document.createElement('script');
    s.type = 'module'; s.src = MV_SRC; s.setAttribute('data-mv-lib', '');
    document.head.appendChild(s);
  }
  function mvReady() {
    loadModelViewer();
    return customElements.whenDefined('model-viewer').then(function () {
      var MV = customElements.get('model-viewer');
      if (MV && MV.dracoDecoderLocation !== DRACO) MV.dracoDecoderLocation = DRACO;
    });
  }
  function hueToRgb(h) {
    var i = Math.floor(h * 6), f = h * 6 - i, q = 1 - f;
    return [[1, f, 0], [q, 1, 0], [0, 1, f], [0, q, 1], [f, 0, 1], [1, 0, q]][i % 6];
  }
  function rainbow(stage, mv) {
    var mats = {}, raf = 0, last = 0, hue = 0, seen = true;
    (mv.model && mv.model.materials || []).forEach(function (m) { mats[m.name] = m; });
    function glow(rgb) {
      GLOW.forEach(function (n) { if (mats[n]) mats[n].setEmissiveFactor(rgb); });
      var ins = mats.logo_insert;
      if (ins) ins.pbrMetallicRoughness.setBaseColorFactor([0.25 + 0.75 * rgb[0], 0.25 + 0.75 * rgb[1], 0.25 + 0.75 * rgb[2], 1]);
    }
    if (reduce) { glow([0.96, 0.97, 0.98]); return; }
    function tick(t) {
      raf = 0;
      if (!seen || document.hidden) return;
      if (t - last > 40) { hue = (hue + (t - last) / 9000) % 1; last = t; glow(hueToRgb(hue)); }
      raf = requestAnimationFrame(tick);
    }
    function go() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) go(); }).observe(stage);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) go(); });
    go();
  }
  function wakeStage(stage) {
    var mv = stage.querySelector('model-viewer');
    if (!mv) return;
    if (reduce) { mv.removeAttribute('auto-rotate'); }
    mv.addEventListener('load', function () {
      stage.classList.add('is-live');
      if (stage.hasAttribute('data-x2-rainbow')) rainbow(stage, mv);
    }, { once: true });
    mv.addEventListener('error', function () {
      var fb = mv.getAttribute('data-fallback');
      if (fb && mv.getAttribute('src') !== fb) mv.setAttribute('src', fb);
    });
    mvReady().then(function () { if (!mv.getAttribute('src')) mv.setAttribute('src', mv.dataset.src); });
  }
  var stages = document.querySelectorAll('.x2 [data-x2-model]');
  if (stages.length) {
    if ('IntersectionObserver' in window) {
      var mo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { wakeStage(e.target); mo.unobserve(e.target); }
        });
      }, { rootMargin: '300px 0px' });
      stages.forEach(function (s) { mo.observe(s); });
    } else { stages.forEach(wakeStage); }
  }

  /* ---------- 4b. port viewer: hotspots <-> explanation list ---------- */
  // Front/Back buttons turn the model; tapping a dot or a list row highlights
  // the matching port in both places.
  document.querySelectorAll('.x2 [data-x2-ports]').forEach(function (box) {
    var mv = box.querySelector('model-viewer');
    var rows = box.querySelectorAll('.x2-ports-list li');
    var flips = box.querySelectorAll('[data-face]');
    var ORBIT = { back: '180deg 72deg auto', front: '0deg 72deg auto' };
    function face(f) {
      box.querySelectorAll('.x2-ports-flip button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-face') === f ? 'true' : 'false');
      });
      rows.forEach(function (r) { r.classList.toggle('is-dim', r.getAttribute('data-face') !== f); });
      if (mv) mv.cameraOrbit = ORBIT[f];
    }
    function pick(port) {
      var f = 'back';
      rows.forEach(function (r) {
        var on = r.getAttribute('data-port') === port;
        r.classList.toggle('is-on', on);
        if (on) f = r.getAttribute('data-face');
      });
      box.querySelectorAll('.x2-hot').forEach(function (h) { h.classList.toggle('is-on', h.getAttribute('data-port') === port); });
      face(f);
    }
    box.querySelectorAll('.x2-ports-flip button').forEach(function (b) {
      b.addEventListener('click', function () { face(b.getAttribute('data-face')); });
    });
    rows.forEach(function (r) {
      r.setAttribute('tabindex', '0');
      r.addEventListener('click', function () { pick(r.getAttribute('data-port')); });
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r.getAttribute('data-port')); } });
    });
    box.querySelectorAll('.x2-hot').forEach(function (h) {
      h.addEventListener('click', function () { pick(h.getAttribute('data-port')); });
      h.addEventListener('mouseenter', function () { pick(h.getAttribute('data-port')); });
    });
    face('back');
  });

  /* ---------- 5. games filter ---------- */
  document.querySelectorAll('.x2 [data-x2-filter]').forEach(function (bar) {
    var target = document.querySelector(bar.getAttribute('data-x2-filter'));
    if (!target) return;
    var cards = target.querySelectorAll('[data-status]');
    var live = document.querySelector(bar.getAttribute('data-x2-live') || '#none');
    bar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-value]');
      if (!btn) return;
      var v = btn.getAttribute('data-value'), shown = 0;
      bar.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      cards.forEach(function (c, n) {
        var on = v === 'all' || c.getAttribute('data-status') === v;
        c.hidden = !on;
        if (on) {
          shown++;
          if (!reduce && c.animate) {
            c.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }],
              { duration: 450, delay: Math.min(shown, 12) * 35, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'backwards' });
          }
        }
      });
      if (live) live.textContent = shown + (shown === 1 ? ' game shown' : ' games shown');
    });
  });

  /* ---------- 6. pointer-following glow on cards ---------- */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.x2 [data-x2-glow]').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      });
    });
  }

  /* ---------- 7. logo colour gallery ---------- */
  // Swatch buttons swap the big photo. Hidden photos are lazy, so only the
  // colour someone picks is downloaded.
  document.querySelectorAll('.x2 [data-x2-colours]').forEach(function (box) {
    var imgs = box.querySelectorAll('[data-c-img]');
    var btns = box.querySelectorAll('[data-c-btn]');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-c-btn');
        btns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        imgs.forEach(function (i) { i.classList.toggle('is-on', i.getAttribute('data-c-img') === c); });
      });
    });
  });

  /* ---------- 8. logo loop video: load + play only near the screen ---------- */
  document.querySelectorAll('.x2 [data-x2-video]').forEach(function (v) {
    function wake() {
      v.querySelectorAll('source[data-src]').forEach(function (s) { s.src = s.getAttribute('data-src'); s.removeAttribute('data-src'); });
      v.load();
      if (reduce) { v.removeAttribute('autoplay'); v.setAttribute('controls', ''); return; }
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    }
    if ('IntersectionObserver' in window) {
      var vo = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            if (v.querySelector('source[data-src]')) wake();
            else if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          } else if (!v.paused) v.pause();
        });
      }, { rootMargin: '200px 0px' });
      vo.observe(v);
    } else wake();
  });
})();
