/* ==========================================================================
   ZeroStick EXO 3D hero — behaviour for sections/zs-exo-hero3d.liquid
   --------------------------------------------------------------------------
   1. Lazy loading: the model-viewer library (pinned to 3.5.0) and the GLB are
      only downloaded when the hero is close to the screen. Until then the
      poster image shows, so the page paints fast.
   2. Rainbow logo: every frame-ish (about 25 times a second) we move a hue
      around the colour wheel and give that colour to the glowing materials
      (the logo insert and the 4 LED lenses). One full cycle takes ~9 s.
      The cycle pauses while the hero is off screen or the tab is hidden, so
      it costs nothing when nobody is looking.
   3. Swatches: pick a fixed logo colour (stops the rainbow).
   4. "Show ports": toggles the port labels (hotspots) on the model.
   5. Reduced motion: no auto-spin and no colour cycling. The poster stays and
      a "View in 3D" button loads a still model the visitor can turn by hand.
   6. Draco: the model is the Draco-compressed web GLB (~0.68 MB). model-viewer
      is told where Google's Draco decoder lives BEFORE the model is set. If
      the Draco model (or its decoder) fails, we load the uncompressed GLB
      (data-fallback, ~3.4 MB) once instead.
   Material names come from MARKETING\web\exo-web.glb (same approach as MAIN
   EXO CHAT's reference viewer).
   ========================================================================== */
(function () {
  'use strict';
  var MV_SRC = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  var DRACO = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
  var GLOW = ['logo_insert', 'leds_D301_lens', 'leds_D302_lens', 'leds_D304_lens', 'leds_D305_lens'];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadLib() {
    if (window.customElements && customElements.get('model-viewer')) return;
    if (document.querySelector('script[data-mv-lib]')) return;
    var s = document.createElement('script');
    s.type = 'module'; s.src = MV_SRC; s.setAttribute('data-mv-lib', '');
    document.head.appendChild(s);
  }
  // resolves once model-viewer is defined, with the Draco decoder location set
  function mvReady() {
    loadLib();
    return customElements.whenDefined('model-viewer').then(function () {
      var MV = customElements.get('model-viewer');
      if (MV && MV.dracoDecoderLocation !== DRACO) MV.dracoDecoderLocation = DRACO;
    });
  }

  // hue (0..1) -> [r, g, b] (0..1), full saturation and brightness
  function hueToRgb(h) {
    var i = Math.floor(h * 6), f = h * 6 - i, q = 1 - f;
    return [[1, f, 0], [q, 1, 0], [0, 1, f], [0, q, 1], [f, 0, 1], [1, 0, q]][i % 6];
  }

  document.querySelectorAll('[data-exo-hero3d]').forEach(function (hero) {
    var stage = hero.querySelector('[data-h3d-stage]');
    var mv = stage.querySelector('model-viewer');
    var mats = {}, current = [0.96, 0.97, 0.98], rainbow = !reduce, visible = true, raf = 0, last = 0, hue = 0, started = false;

    function setGlow(rgb) {
      current = rgb;
      GLOW.forEach(function (n) { if (mats[n]) mats[n].setEmissiveFactor(rgb); });
      var ins = mats.logo_insert;
      // tint the clear insert so the colour reads even in bright light
      if (ins) ins.pbrMetallicRoughness.setBaseColorFactor([0.25 + 0.75 * rgb[0], 0.25 + 0.75 * rgb[1], 0.25 + 0.75 * rgb[2], 1]);
    }

    function tick(t) {
      raf = 0;
      if (!rainbow || !visible || document.hidden) return;
      if (t - last > 40) {                 // ~25 updates a second is plenty
        hue = (hue + (t - last) / 9000) % 1; // one full cycle in ~9 s
        last = t;
        setGlow(hueToRgb(hue));
      }
      raf = requestAnimationFrame(tick);
    }
    function startRainbow() {
      if (reduce || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (started) return;
      started = true;
      if (reduce) mv.removeAttribute('auto-rotate');
      mv.addEventListener('load', function () {
        mats = {};
        (mv.model && mv.model.materials || []).forEach(function (m) { mats[m.name] = m; });
        stage.classList.add('is-live');
        if (reduce || !rainbow) { setGlow(current); }
        else startRainbow();
      });
      mv.addEventListener('error', function () {
        // Draco model or decoder failed: try the uncompressed model once
        var fb = mv.getAttribute('data-fallback');
        if (fb && mv.getAttribute('src') !== fb) { mv.setAttribute('src', fb); return; }
        // keep the poster; say so quietly
        var l = stage.querySelector('.h3d-load'); if (l) l.textContent = '3D view unavailable';
      });
      mvReady().then(function () { mv.setAttribute('src', mv.getAttribute('data-src')); });
    }

    if (reduce) {
      // poster only until the visitor asks for the model
      stage.classList.add('is-still');
      var b = stage.querySelector('[data-h3d-load]');
      if (b) b.addEventListener('click', start);
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { start(); io.unobserve(stage); } });
      }, { rootMargin: '400px 0px' });
      io.observe(stage);
    } else { start(); }

    // pause the rainbow off screen / in a hidden tab
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && rainbow) startRainbow();
      }).observe(stage);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && rainbow) startRainbow(); });

    // swatches
    var sws = hero.querySelectorAll('.h3d-sw button');
    sws.forEach(function (sw) {
      sw.addEventListener('click', function () {
        sws.forEach(function (o) { o.setAttribute('aria-pressed', o === sw ? 'true' : 'false'); });
        var c = sw.getAttribute('data-c');
        if (c === 'rainbow') {
          rainbow = !reduce;
          if (rainbow) startRainbow(); else setGlow([0.96, 0.97, 0.98]);
        } else {
          rainbow = false;
          setGlow(c.split(',').map(Number));
        }
      });
    });
    if (reduce) {
      // the rainbow swatch would do nothing: start on white instead
      sws.forEach(function (o) { o.setAttribute('aria-pressed', o.getAttribute('aria-label') === 'White' ? 'true' : 'false'); });
    }

    // port labels
    var pb = hero.querySelector('[data-h3d-ports]');
    if (pb) pb.addEventListener('click', function () {
      var on = pb.getAttribute('aria-pressed') !== 'true';
      pb.setAttribute('aria-pressed', on ? 'true' : 'false');
      stage.classList.toggle('show-ports', on);
      if (!started) start();
    });
  });
})();
