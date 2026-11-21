/* ==========================================================================
   ZeroStick EXO v2 landing page: page-only behaviour
   --------------------------------------------------------------------------
   Loaded by sections/zerostick-exo-v2.liquid AFTER the shared assets/zs-exo2.js
   (both use "defer", so they run in that order once the page has loaded).
   The shared file already does: reveal on scroll, the sticky phone story,
   the lazy 3D model, the port viewer and the games list. This file adds:

   1. --x2l-head   the store header's height, so our sticky bits sit under it
   2. --hp / --sp  scroll progress for the hero and the exploded-view sequence
                   (CSS turns them into transform/opacity: see the landing CSS)
   3. page nav     highlights the link for the section you're reading
   4. story extras glow colour + progress rail follow the phone story's step
   5. count-up     numbers count up when they scroll into view

   PERFORMANCE RULES followed here (why the page stays at 60 fps)
   - Scroll work runs at most once per screen frame (requestAnimationFrame).
   - All measuring (getBoundingClientRect) happens first, all writing after,
     so the browser never has to re-calculate layout mid-frame.
   - Only elements near the screen are measured (IntersectionObserver).
   - We only write CSS variables; the CSS uses them for transform/opacity.
   Reduced motion: no scroll motion and no count-up; the CSS shows it still.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.x2l');
  if (!root) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ---------- 1. store header height ---------- */
  // The store's header sticks to the top of the screen. We measure where its
  // bottom edge is (0 if it isn't stuck/visible) and hand that to the CSS.
  var header = document.querySelector('.site-header') || document.querySelector('body > header, header.header');
  var headerSticks = false;
  if (header) {
    var pos = getComputedStyle(header).position;
    headerSticks = pos === 'sticky' || pos === 'fixed';
  }
  var navEl = root.querySelector('.x2l-nav');
  var lastHead = -1;
  var headPx = 0;        // header bottom, px
  var topPx = 0;         // header + our page nav, px (where sticky things start)
  function readHead() {
    headPx = headerSticks ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
    topPx = headPx + (navEl ? navEl.offsetHeight : 0);
  }
  function writeHead() {
    if (headPx !== lastHead) { lastHead = headPx; root.style.setProperty('--x2l-head', headPx + 'px'); }
  }

  /* ---------- 2. scroll progress for the hero and the exploded sequence ---------- */
  var hero = root.querySelector('[data-x2l-hero]');
  var xp = root.querySelector('[data-x2l-xp]');
  var caps = xp ? xp.querySelectorAll('[data-cap]') : [];
  var bars = xp ? xp.querySelectorAll('.x2l-xp-bar li') : [];
  var near = { hero: true, xp: false };    // is it close to the screen right now?
  var last = { hp: -1, sp: -1, cap: 0 };

  if (hasIO) {
    // Mark the hero / sequence as "near" when they are within one screen.
    var nearIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === hero) near.hero = e.isIntersecting;
        if (e.target === xp) near.xp = e.isIntersecting;
      });
      requestTick();
    }, { rootMargin: '100% 0px' });
    if (hero) nearIO.observe(hero);
    if (xp) nearIO.observe(xp);
  } else { near.xp = true; }

  var ticking = false;
  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  function frame() {
    ticking = false;
    var vh = window.innerHeight;

    // --- READ everything first ---
    readHead();
    var heroR = (!reduce && hero && near.hero) ? hero.getBoundingClientRect() : null;
    var xpR = (xp && near.xp) ? xp.getBoundingClientRect() : null;

    // --- then WRITE ---
    writeHead();

    if (heroR) {
      // 0 while the hero sits under the nav, 1 once you've scrolled its height
      var hp = clamp01((topPx - heroR.top) / Math.max(1, heroR.height));
      hp = Math.round(hp * 1000) / 1000;
      if (hp !== last.hp) { last.hp = hp; hero.style.setProperty('--hp', hp); }
    }

    if (xpR) {
      // 0 when the stage first pins under the nav, 1 when the track ends
      var travel = Math.max(1, xpR.height - (vh - topPx));
      var sp = clamp01((topPx - xpR.top) / travel);
      sp = Math.round(sp * 1000) / 1000;
      if (sp !== last.sp) {
        last.sp = sp;
        if (!reduce) xp.style.setProperty('--sp', sp);
        // which caption is showing: first third, middle, last third
        var cap = sp < 0.36 ? 0 : sp < 0.66 ? 1 : 2;
        if (cap !== last.cap) {
          last.cap = cap;
          caps.forEach(function (c, i) { c.classList.toggle('is-on', i === cap); });
        }
        // the three small progress bars above the captions fill in turn
        bars.forEach(function (b, i) { b.style.setProperty('--f', clamp01(sp * 3 - i).toFixed(3)); });
      }
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  frame();

  /* ---------- 3. page nav: highlight the current section ---------- */
  var links = root.querySelectorAll('[data-x2l-navlinks] a');
  if (hasIO && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-on'); a.removeAttribute('aria-current'); });
        var a = byId[e.target.id];
        if (a) { a.classList.add('is-on'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(byId).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) navIO.observe(sec);
    });
  }
  // In-page links glide instead of jumping (unless reduced motion).
  // scroll-margin-top in the CSS keeps the target clear of the sticky bars.
  root.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var target = id && document.getElementById(id);
    if (!target) return;  // placeholder links like #discord-invite-placeholder do nothing special
    ev.preventDefault();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ---------- 4. story extras: glow colour + progress rail ---------- */
  // Same trigger line as the shared story (the middle of the screen), so the
  // rail and glow change exactly when the phone screenshot changes.
  var story = root.querySelector('.x2l-story');
  if (story && hasIO) {
    var steps = story.querySelectorAll('[data-step]');
    var rail = story.querySelectorAll('.x2l-rail li');
    var setActive = function (i) {
      story.setAttribute('data-active', String(i));
      rail.forEach(function (li, n) { li.classList.toggle('is-on', n === i); });
    };
    setActive(0);
    var storyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) setActive(Array.prototype.indexOf.call(steps, e.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    steps.forEach(function (s) { storyIO.observe(s); });
  }

  /* ---------- 5. numbers count up ---------- */
  // The final number is already in the HTML; we only animate towards it.
  var counters = root.querySelectorAll('[data-x2l-count]');
  if (!reduce && hasIO && counters.length) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countIO.unobserve(e.target);
        var el = e.target, end = parseInt(el.getAttribute('data-x2l-count'), 10) || 0;
        if (!end) return;
        var t0 = null, dur = 1200;
        el.textContent = '0';
        var step = function (t) {
          if (t0 === null) t0 = t;
          var k = clamp01((t - t0) / dur);
          k = 1 - Math.pow(1 - k, 3);             // ease-out: fast start, gentle finish
          el.textContent = String(Math.round(end * k));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { countIO.observe(c); });
  }
})();
