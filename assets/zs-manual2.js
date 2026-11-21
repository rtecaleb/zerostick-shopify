/* ==========================================================================
   ZeroStick EXO manual v2: behaviour for sections/zs-manual-v2.liquid
   --------------------------------------------------------------------------
   The manual is one long Shopify page full of <article class="m2-page">
   blocks. This script turns it into a "one page at a time" manual:

     1. links that depend on section settings (#discord, #app-store, ...)
     2. find the pages, hide parts whose snippet doesn't exist yet
     3. polish the content: zoomable screenshots, screenshot+legend pairs,
        phone-friendly tables, copy-link buttons on every H2
     4. the left sidebar (grouped by data-group, groups fold open/closed)
     5. the router: the address after # decides which page shows
        (#p-platforms-ps5 = a page, #p-platforms-ps5--hdmi = a heading)
     6. "On this page" list, scroll-spy, reading progress bar
     7. previous / next cards and the "Step n of 12" journey bar
     8. search (titles, headings, bold app labels, symptoms, synonyms)
     9. the phone bottom sheet (menu or "On this page")
    10. the picture zoom (lightbox)
    11. keyboard shortcuts ( / or Ctrl+K opens search, Esc closes)

   Nothing here needs editing to add a page: add an article to a snippet.
   Plain JavaScript (no libraries), written for a beginner to follow.
   Last change: 2026-11-21 (instant page scroll, chip refresh).
   ========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('m2');
  if (!root) return;

  /* ---------- small helpers ---------- */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  // localStorage can throw (private mode, blocked storage): never let that break the page
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  var toastEl = $('[data-m2-toast]');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  // The fixed order of sidebar groups (MANUAL-CONTRACT.md). A group that has
  // no pages yet is simply left out.
  var GROUPS = ['Start here', 'Get Started', 'Connect', 'The App', 'Aim', 'Buttons & Scripts', 'Smart Features', 'Games', 'Help', 'Reference'];

  // Old or guessed page ids that should open a real page instead.
  var ALIASES = {
    'p-start': 'p-start-quick-start',
    'p-start-ports': 'p-start-ports-and-buttons',
    'p-start-wifi': 'p-start-updates',
    'p-platforms': 'p-platforms-compatibility',
    'p-app': 'p-app-tour',
    'p-help-status-lights': 'p-app-lights',
    'p-help-preorder-and-shipping': 'p-help-preorder',
    'p-reference': 'p-reference-settings'
  };

  /* =====================================================================
     1. Links that come from the section settings
     ===================================================================== */
  var cfg = {
    discord: root.getAttribute('data-discord-url') || '#discord-invite-placeholder',
    appStore: root.getAttribute('data-app-store-url') || '#app-store-placeholder',
    playStore: root.getAttribute('data-play-store-url') || '#play-store-placeholder',
    email: root.getAttribute('data-support-email') || 'caleb@zerostickgaming.com',
    preorder: root.getAttribute('data-preorder-url') || '/products/zerostick-exo',
    games: root.getAttribute('data-games-url') || '/pages/supported-games'
  };
  // A setting that still starts with # is a placeholder: keep the link, but
  // clicking it shows a helpful message instead of going nowhere.
  var PH_MSG = {
    discord: 'The Discord invite isn\'t set up yet. Email ' + cfg.email + ' for help.',
    appStore: 'Search for "ZeroStick" in the App Store on your iPhone.',
    playStore: 'Search for "ZeroStick" in Google Play on your Android phone.'
  };
  function setLink(selector, url, key) {
    $$('a[href="' + selector + '"]').forEach(function (a) {
      a.setAttribute('href', url);
      if (url.charAt(0) === '#') { a.setAttribute('data-m2-ph', key); }
      else if (/^https?:/.test(url)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    });
  }
  setLink('#discord', cfg.discord, 'discord');
  setLink('#app-store', cfg.appStore, 'appStore');
  setLink('#play-store', cfg.playStore, 'playStore');
  setLink('#support-email', 'mailto:' + cfg.email, 'email');
  setLink('#preorder', cfg.preorder, 'preorder');
  setLink('#games', cfg.games, 'games');
  // show the email address wherever a snippet left a [data-m2-email] slot
  $$('[data-m2-email]').forEach(function (el) { el.textContent = cfg.email; });

  /* =====================================================================
     2. Find the pages
     ===================================================================== */
  $$('.m2-chunk').forEach(function (c) {
    if (!c.querySelector('.m2-page')) {
      // The snippet for this part doesn't exist yet (Shopify printed
      // "Could not find asset" in here). Hide it; it's expected for now.
      c.classList.add('is-missing');
    }
  });
  var pages = $$('.m2-page').filter(function (p) { return p.id; }).map(function (el, i) {
    var h1 = el.querySelector('h1');
    return {
      el: el,
      id: el.id,
      i: i,
      title: el.getAttribute('data-title') || text(h1) || el.id,
      group: el.getAttribute('data-group') || 'Reference',
      journey: parseInt(el.getAttribute('data-journey'), 10) || 0,
      time: el.getAttribute('data-time') || ''
    };
  });
  if (!pages.length) return;
  var byId = {};
  pages.forEach(function (p) { byId[p.id] = p; });
  var home = byId['p-home'] || pages[0];
  root.classList.add('m2-ready');

  /* =====================================================================
     3. Polish the content
     ===================================================================== */
  // 3a. screenshots: wrap each in a button so it can be zoomed (mouse, touch, keyboard)
  $$('.m2-fig img, .m2-media img').forEach(function (img) {
    if (img.closest('.m2-zoom') || img.closest('[data-x2-model]')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'm2-zoom';
    b.setAttribute('aria-label', 'Enlarge picture' + (img.alt ? ': ' + img.alt : ''));
    img.parentNode.insertBefore(b, img);
    b.appendChild(img);
  });
  // 3b. a screenshot followed by its legend table sits side by side on wide screens
  $$('.m2-fig').forEach(function (fig) {
    var next = fig.nextElementSibling;
    if (!next || fig.parentNode.classList.contains('m2-figpair')) return;
    if (next.matches('.m2-legend') || (next.matches('.m2-table') && next.querySelector('.m2-legend'))) {
      var pair = document.createElement('div');
      pair.className = 'm2-figpair';
      fig.parentNode.insertBefore(pair, fig);
      pair.appendChild(fig);
      pair.appendChild(next);
    }
  });
  // 3c. tables whose cells carry data-label turn into stacked cards on phones (CSS)
  $$('table').forEach(function (t) { if (t.querySelector('td[data-label]')) t.classList.add('m2-stack'); });
  // 3d. copy-link button on every H2 that has an anchor
  var LINK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
  function copyText(str) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(str);
    return new Promise(function (ok, fail) {
      var ta = document.createElement('textarea');
      ta.value = str; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); }
      document.body.removeChild(ta);
    });
  }
  function sectionOf(h2) {
    var sec = h2.parentNode;
    if (sec && sec.classList && sec.classList.contains('m2-sec') && sec.id) return sec;
    return h2.id ? h2 : null;
  }
  $$('.m2-page h2').forEach(function (h2) {
    var target = sectionOf(h2);
    if (!target || h2.closest('.m2-door')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'm2-anchor';
    b.setAttribute('aria-label', 'Copy a link to "' + text(h2) + '"');
    b.innerHTML = LINK_SVG;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var url = location.href.split('#')[0] + '#' + target.id;
      copyText(url).then(function () {
        b.classList.add('is-done'); toast('Link copied');
        setTimeout(function () { b.classList.remove('is-done'); }, 1600);
      }, function () { toast('Copy this link: ' + url); });
    });
    h2.appendChild(b);
  });
  // 3e. links to pages that aren't written yet (another agent's part) get a gentle message
  function resolveId(id) {
    if (!id) return null;
    if (ALIASES[id]) id = ALIASES[id];
    var parts = id.split('--');
    if (parts.length > 1 && ALIASES[parts[0]]) id = ALIASES[parts[0]] + '--' + parts.slice(1).join('--');
    var el = document.getElementById(id);
    if (el && root.contains(el) && el.closest('.m2-page')) return el;
    // a heading anchor whose page exists but heading doesn't: open the page
    if (parts.length > 1) {
      el = document.getElementById(parts[0]);
      if (el && root.contains(el) && el.classList.contains('m2-page')) return el;
    }
    return null;
  }

  /* =====================================================================
     4. Sidebar (also reused inside the phone bottom sheet)
     ===================================================================== */
  var groupNames = [];
  var groupPages = {};
  pages.forEach(function (p) {
    if (!groupPages[p.group]) { groupPages[p.group] = []; groupNames.push(p.group); }
    groupPages[p.group].push(p);
  });
  groupNames.sort(function (a, b) {
    var ia = GROUPS.indexOf(a), ib = GROUPS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  // which groups are folded: remembered per browser (only a convenience)
  var folded = {};
  try { folded = JSON.parse(store('m2-folded') || '{}') || {}; } catch (e) { folded = {}; }
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function navHTML(prefix) {
    return groupNames.map(function (g, gi) {
      var id = prefix + '-g' + gi;
      var open = folded[g] === undefined ? (g === 'Start here' || g === 'Get Started') : !folded[g];
      return '<div class="m2-group" data-group="' + esc(g) + '">' +
        '<button type="button" class="m2-group-btn" aria-expanded="' + open + '" aria-controls="' + id + '">' + esc(g) + CHEV + '</button>' +
        '<div class="m2-group-body" id="' + id + '"><ul>' +
        groupPages[g].map(function (p) {
          return '<li><a class="m2-navlink" href="#' + p.id + '" data-page="' + p.id + '">' + esc(p.title) +
            (p.journey ? '<span class="m2-navnum" title="First-run step ' + p.journey + '">' + p.journey + '</span>' : '') + '</a></li>';
        }).join('') + '</ul></div></div>';
    }).join('');
  }
  var nav = $('[data-m2-nav]');
  nav.innerHTML = navHTML('m2s');
  // folding a group (event delegation: one listener handles every button, sheet included)
  root.addEventListener('click', function (e) {
    var b = e.target.closest('.m2-group-btn');
    if (!b) return;
    var open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    var g = b.parentNode.getAttribute('data-group');
    folded[g] = !open;
    store('m2-folded', JSON.stringify(folded));
  });
  function markNav(container) {
    $$('.m2-navlink', container).forEach(function (a) {
      var on = a.getAttribute('data-page') === current.id;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $$('.m2-group', container).forEach(function (g) {
      var has = g.getAttribute('data-group') === current.group;
      g.classList.toggle('has-current', has);
      if (has) g.querySelector('.m2-group-btn').setAttribute('aria-expanded', 'true');
    });
  }

  /* =====================================================================
     5. Router: which page is on screen
     ===================================================================== */
  var current = null;
  var side = $('.m2-side');
  var lastHash = null;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // How far down the sticky bars reach (theme header + manual bar)
  var headerEl = document.querySelector('sticky-header, .shopify-section-header-sticky, [data-sticky-header], .header-wrapper--sticky');
  var bar = $('#m2-bar');
  function themeTop() {
    if (!headerEl) return 0;
    var cs = getComputedStyle(headerEl);
    var host = headerEl.closest('.shopify-section') || headerEl;
    var hs = getComputedStyle(host);
    var pos = (hs.position === 'sticky' || hs.position === 'fixed') ? hs.position : cs.position;
    if (pos !== 'sticky' && pos !== 'fixed') return 0;
    var r = host.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, 200));
  }
  var topNow = 0;
  function measureTop() {
    var t = Math.round(themeTop());
    if (t !== topNow) { topNow = t; root.style.setProperty('--m2-top', t + 'px'); }
  }
  function stickyOffset() { return topNow + (bar ? bar.offsetHeight : 0) + 16; }
  function scrollToY(y, smooth) {
    // 'instant' (not 'auto'): the theme sets html{scroll-behavior:smooth}, and
    // 'auto' would follow it, so a new page would glide instead of opening at its top
    window.scrollTo({ top: Math.max(0, y), behavior: (smooth && !reduce) ? 'smooth' : 'instant' });
  }
  function scrollToEl(el, smooth) {
    scrollToY(el.getBoundingClientRect().top + window.pageYOffset - stickyOffset() + 8, smooth);
  }
  function manualTop() { return root.getBoundingClientRect().top + window.pageYOffset - topNow; }

  // first = true only for the very first page shown after the page loads
  function show(p, target, smooth, first) {
    var changed = p !== current;
    if (changed) {
      if (current) current.el.classList.remove('is-current', 'm2-enter');
      p.el.classList.add('is-current');
      if (!reduce) { p.el.classList.remove('m2-enter'); void p.el.offsetWidth; p.el.classList.add('m2-enter'); }
      current = p;
      document.title = (p === home ? 'ZeroStick EXO Manual' : p.title + ' · ZeroStick EXO Manual');
      if (p.journey === 4) sstore('m2-plat', p.id);
      markNav(nav);
      buildToc();
      buildPn();
      buildJourney();
      keepNavInView();
    }
    if (target) {
      // wait one frame so the newly shown page has its real size
      requestAnimationFrame(function () { scrollToEl(target, smooth && !changed); });
    } else if (changed && !first) {
      // a new page starts at its top
      scrollToY(manualTop(), false);
    }
    requestAnimationFrame(onScroll);
  }
  function keepNavInView() {
    if (!side || getComputedStyle(side).display === 'none') return;
    var a = $('.m2-navlink.is-current', side);
    if (!a) return;
    var sr = side.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (ar.top < sr.top + 40 || ar.bottom > sr.bottom - 40) side.scrollTop += ar.top - sr.top - sr.height / 3;
  }
  function route(smooth) {
    var raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (raw === lastHash) return;
    var first = lastHash === null;
    var el = raw ? resolveId(raw) : null;
    if (raw && !el) {
      // not a manual address (for example the theme's own #MainContent link)
      if (raw.indexOf('p-') !== 0) { if (first) { lastHash = raw; show(home, null, false, true); } return; }
      toast('That part of the manual is still being written. Here is the manual home.');
      lastHash = raw;
      show(home, null, false, first);
      return;
    }
    lastHash = raw;
    if (!el) { show(home, null, false, first); return; }
    var art = el.classList.contains('m2-page') ? el : el.closest('.m2-page');
    var p = byId[art.id];
    show(p, el === art ? null : el, smooth, first);
  }
  function go(id, smooth) {
    if (('#' + id) !== location.hash) history.pushState(null, '', '#' + id);
    route(smooth);
  }
  // Clicks on manual links: handled here so same-page jumps can scroll smoothly
  root.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var ph = a.getAttribute('data-m2-ph');
    if (ph) { e.preventDefault(); toast(PH_MSG[ph] || 'This link isn\'t set up yet.'); return; }
    var id = a.getAttribute('href').slice(1);
    if (a.hasAttribute('data-m2-top') || id === 'm2') { e.preventDefault(); scrollToY(manualTop(), true); return; }
    if (id.indexOf('p-') !== 0) return;
    e.preventDefault();
    closeSheet(); closeSearch();
    if (!resolveId(id)) { toast('That page is still being written. Check back soon.'); return; }
    if ('#' + id === location.hash) lastHash = '';   // same link again: let route() scroll to it again
    go(id, true);
  });
  window.addEventListener('popstate', function () { route(false); });
  window.addEventListener('hashchange', function () { route(true); });

  /* =====================================================================
     6. "On this page", scroll-spy, progress bar, phone chip
     ===================================================================== */
  var tocList = $('[data-m2-toc]');
  var tocBox = $('.m2-toc-in');
  var chip = $('[data-m2-open="toc"]');
  var chipVal = $('[data-m2-chip]');
  var secs = [];
  function buildToc() {
    secs = $$('.m2-sec[id]', current.el).filter(function (s) { return s.querySelector('h2'); });
    tocList.innerHTML = secs.map(function (s) {
      return '<li><a href="#' + s.id + '">' + esc(text(s.querySelector('h2'))) + '</a></li>';
    }).join('');
    if (tocBox) tocBox.hidden = secs.length < 2;
    if (chip) chip.hidden = secs.length < 2;
    activeSec = -2;   // forces the next scroll check to refresh the chip and highlights
  }
  var progressHost = root;
  var activeSec = -1;
  function onScroll() {
    ticking = false;
    measureTop();
    if (!current) return;
    var off = stickyOffset() + 60;
    var idx = -1;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= off) idx = i; else break;
    }
    if (idx !== activeSec) {
      activeSec = idx;
      $$('a', tocList).forEach(function (a, n) { a.classList.toggle('is-on', n === idx); });
      $$('.m2-sheet-body ol a').forEach(function (a, n) { a.classList.toggle('is-on', n === idx); });
      if (chipVal) chipVal.textContent = idx >= 0 ? text(secs[idx].querySelector('h2')) : current.title;
    }
    // reading progress through the current page (0 to 1)
    var r = current.el.getBoundingClientRect();
    var span = r.height - window.innerHeight + stickyOffset();
    var p = span > 0 ? (stickyOffset() - r.top) / span : 1;
    progressHost.style.setProperty('--m2-read', Math.max(0, Math.min(1, p)).toFixed(4));
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () { activeSec = -2; onScroll(); });

  /* =====================================================================
     7. Previous / next + the first-run journey (Step n of 12)
     ===================================================================== */
  var pnBox = $('[data-m2-pn]');
  var jBox = $('[data-m2-journey]');
  var JOURNEY_MAX = 12;
  // the page for journey step n (step 4 has three platform pages: use the one the reader picked)
  function journeyPage(n) {
    var list = pages.filter(function (p) { return p.journey === n; });
    if (!list.length) return null;
    if (list.length > 1) {
      var pick = byId[sstore('m2-plat')];
      if (pick && pick.journey === n) return pick;
    }
    return list[0];
  }
  function pnLink(p, cls, label) {
    if (!p) return '';
    return '<a class="' + cls + '" href="#' + p.id + '"><small>' + esc(label) + '</small><b>' + esc(p.title) + '</b></a>';
  }
  function buildPn() {
    var prev = null, next = null, prevLabel = 'Previous', nextLabel = 'Next', journeyCls = '';
    if (current.journey) {
      for (var a = current.journey - 1; a >= 1 && !prev; a--) { prev = journeyPage(a); if (prev) prevLabel = 'Step ' + a + ' of ' + JOURNEY_MAX; }
      for (var b = current.journey + 1; b <= JOURNEY_MAX && !next; b++) { next = journeyPage(b); if (next) nextLabel = 'Next: step ' + b + ' of ' + JOURNEY_MAX; }
      if (!prev) { prev = byId['p-start-quick-start'] || null; prevLabel = '10-minute setup'; }
      journeyCls = ' is-journey';
    } else {
      prev = pages[current.i - 1] || null;
      next = pages[current.i + 1] || null;
    }
    pnBox.innerHTML = pnLink(prev, 'is-prev' + journeyCls, prevLabel) + pnLink(next, 'is-next' + journeyCls, nextLabel);
  }
  function buildJourney() {
    var n = current.journey;
    if (!n) { jBox.hidden = true; jBox.innerHTML = ''; return; }
    var cells = '';
    for (var k = 1; k <= JOURNEY_MAX; k++) {
      var p = journeyPage(k);
      var cls = k < n ? 'is-done' : (k === n ? 'is-now' : '');
      var label = 'Step ' + k + (p ? ': ' + p.title : '');
      cells += p ? '<a class="' + cls + '" href="#' + p.id + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"' + (k === n ? ' aria-current="step"' : '') + '></a>'
                 : '<span class="' + cls + '" title="' + esc(label) + '"></span>';
    }
    jBox.innerHTML = '<p class="m2-journey-txt">Step ' + n + ' of ' + JOURNEY_MAX + '<small>First-run setup</small></p><div class="m2-jtrack">' + cells + '</div>';
    jBox.hidden = false;
  }

  /* =====================================================================
     8. Search
     ===================================================================== */
  // Players don't always use the app's words. Each rule: if the search has
  // one of the words on the left, also look for the words on the right.
  var SYNONYMS = [
    [['sens', 'sensitivity', 'sensi'], ['speed']],
    [['turbo', 'rapidfire', 'auto fire', 'autofire'], ['rapid fire']],
    [['anti recoil', 'antirecoil', 'no recoil', 'recoil'], ['anti recoil lab', 'pull down']],
    [['navigate', 'navigate mode', 'passthrough', 'pass through'], ['pass through']],
    [['smart actions', 'smart action', 'macro', 'macros', 'combo'], ['scripts', 'advanced script maker']],
    [['gun detection', 'weapon detection', 'auto detect', 'detect gun'], ['ai scripts', 'gun detection']],
    [['remap', 'rebind', 'bind', 'binding', 'keybind', 'buttons'], ['mappings']],
    [['profile', 'profiles', 'preset', 'presets'], ['config']],
    [['dongle', 'auth', 'authentication'], ['auth dongle', 'auth']],
    [['firmware', 'update', 'upgrade'], ['updates']],
    [['bluetooth', 'pairing', 'connect phone', 'phone'], ['pair']],
    [['led', 'leds', 'light', 'lights', 'rgb', 'colour', 'color', 'glow'], ['light']],
    [['headset', 'mic', 'microphone', 'audio', 'sound', 'chat audio'], ['headset']],
    [['refund', 'shipping', 'ship', 'ships', 'price', 'cost', 'order', 'preorder', 'pre order', 'cancel', 'subscription'], ['pre order', 'shipping']],
    [['ads', 'scope', 'zoom'], ['aim down sights', 'ads']],
    [['dead zone', 'deadzone', 'drift'], ['deadzone']],
    [['kbm', 'mnk', 'm&k', 'mouse and keyboard', 'keyboard and mouse'], ['mouse', 'keyboard']],
    [['nba', '2k', 'green', 'shot timing'], ['auto green', 'nba 2k27']],
    [['tournament', 'esports', 'event', 'lan'], ['tournament mode']],
    [['reset', 'restart', 'factory', 'reboot'], ['reset', 'restart']],
    [['warranty', 'support', 'contact', 'email', 'discord', 'help me'], ['get support']],
    [['size', 'dimensions', 'weight', 'specs'], ['specifications']],
    [['hz', 'polling', 'poll rate', 'report rate'], ['polling rate', 'check rate']],
    [['xbox one', 'series x', 'series s'], ['xbox']],
    [['playstation', 'ps 5'], ['ps5']],
    [['windows', 'computer', 'laptop'], ['pc']],
    [['hdmi', 'tv', 'monitor', 'capture'], ['hdmi']],
    [['power', 'usb power', 'charger', 'charging'], ['power', 'aux']],
    [['tutorial', 'getting started', 'setup', 'set up', 'start'], ['10 minute setup', 'quick start']]
  ];
  function norm(s) {
    return String(s).toLowerCase().replace(/[‐-―\-_/]/g, ' ').replace(/[^\w\s&+°]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var index = null;
  function buildIndex() {
    index = [];
    pages.forEach(function (p) {
      var el = p.el;
      var labels = $$('b, strong, .m2-call-label', el).map(text).join(' · ');
      var kw = el.getAttribute('data-keywords') || '';
      var get = text(el.querySelector('.m2-get'));
      index.push({ p: p, id: p.id, kind: 'page', head: p.title, title: norm(p.title + ' ' + kw), h2: '',
        labels: norm(labels), body: norm(text(el)).slice(0, 4000), raw: get || text(el).slice(0, 200) });
      $$('.m2-sec[id]', el).forEach(function (s) {
        var h = s.querySelector('h2');
        if (!h) return;
        var symptom = s.classList.contains('m2-symptom');
        index.push({ p: p, id: s.id, kind: symptom ? 'symptom' : 'h2', head: text(h), title: norm(p.title),
          h2: norm(text(h) + ' ' + (s.getAttribute('data-keywords') || '')), labels: norm($$('b, strong', s).map(text).join(' ')),
          body: norm(text(s)), raw: text(s).replace(text(h), '').trim().slice(0, 400) });
      });
    });
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // turn the query into groups: each group must match somewhere (synonyms count)
  function parseQuery(q) {
    var n = ' ' + norm(q) + ' ';
    var groups = [];
    SYNONYMS.forEach(function (rule) {
      rule[0].forEach(function (trig) {
        var t = ' ' + norm(trig) + ' ';
        if (n.indexOf(t) >= 0) {
          n = n.replace(t, ' ');
          groups.push([norm(trig)].concat(rule[1].map(norm)));
        }
      });
    });
    n.split(' ').forEach(function (w) { if (w.length >= 2 || /\d/.test(w)) groups.push([w]); });
    return groups.map(function (alts) {
      return alts.map(function (a) { return new RegExp('(^|\\s)' + reEsc(a)); });
    });
  }
  function score(e, groups) {
    var total = 0;
    for (var g = 0; g < groups.length; g++) {
      var best = 0;
      groups[g].forEach(function (re, ai) {
        var w = ai === 0 ? 1 : 0.8;                    // the word typed beats a synonym a little
        var s = 0;
        if (re.test(e.kind === 'page' ? e.title : e.h2)) s = e.kind === 'page' ? 10 : 9;
        else if (e.kind !== 'page' && re.test(e.title)) s = 3;
        if (re.test(e.labels)) s = Math.max(s, 4);
        if (!s && re.test(e.body)) s = 1;
        best = Math.max(best, s * w);
      });
      if (!best) return 0;                             // every group must match
      total += best;
    }
    if (e.kind === 'symptom') total += 1;              // symptoms help people who are stuck
    return total;
  }
  function snippet(raw, groups) {
    var t = raw.replace(/\s+/g, ' ');
    var lower = t.toLowerCase(), at = -1, len = 0;
    for (var g = 0; g < groups.length && at < 0; g++) {
      var word = groups[g][0].source.replace('(^|\\s)', '').replace(/\\/g, '');
      at = lower.indexOf(word); len = word.length;
    }
    if (at < 0) return esc(t.slice(0, 110));
    var start = Math.max(0, at - 40);
    return (start ? '…' : '') + esc(t.slice(start, at)) + '<mark>' + esc(t.slice(at, at + len)) + '</mark>' + esc(t.slice(at + len, at + len + 90));
  }
  var sBox = $('#m2-search');
  var sInput = $('#m2-q');
  var sList = $('#m2-results');
  var sSel = 0;
  var POPULAR = ['p-start-quick-start', 'p-start-pair-your-phone', 'p-platforms-ps5', 'p-platforms-xbox', 'p-platforms-pc', 'p-app-passthrough', 'p-help', 'p-help-preorder'];
  function resultHTML(id, small, title, snip, i) {
    return '<li><a class="m2-res" role="option" id="m2-r' + i + '" href="#' + id + '" aria-selected="' + (i === 0) + '"><small>' + small + '</small><b>' + title + '</b>' +
      (snip ? '<span>' + snip + '</span>' : '') + '</a></li>';
  }
  function runSearch() {
    if (!index) buildIndex();
    var q = sInput.value.trim();
    sSel = 0;
    if (!q) {
      sList.innerHTML = POPULAR.filter(function (id) { return byId[id]; }).map(function (id, i) {
        var p = byId[id];
        return resultHTML(id, 'Popular · ' + esc(p.group), esc(p.title), '', i);
      }).join('');
      return;
    }
    var groups = parseQuery(q);
    if (!groups.length) { sList.innerHTML = ''; return; }
    var hits = index.map(function (e) { return { e: e, s: score(e, groups) }; })
      .filter(function (h) { return h.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.e.p.i - b.e.p.i; });
    var perPage = {}, out = [];
    hits.forEach(function (h) {
      var k = h.e.p.id;
      perPage[k] = (perPage[k] || 0) + 1;
      if (perPage[k] <= 3 && out.length < 14) out.push(h.e);
    });
    if (!out.length) {
      sList.innerHTML = '<li class="m2-empty">No matches for "' + esc(q) + '". Try other words, or open <a href="#p-help">Fix a problem</a>.</li>';
      return;
    }
    sList.innerHTML = out.map(function (e, i) {
      var small = esc(e.p.group) + (e.kind === 'page' ? '' : ' · ' + esc(e.p.title));
      var title = e.kind === 'symptom' ? '<i>Fix:</i> ' + esc(e.head) : esc(e.head);
      return resultHTML(e.id, small, title, snippet(e.raw, groups), i);
    }).join('');
  }
  function selectResult(n) {
    var items = $$('.m2-res', sList);
    if (!items.length) return;
    sSel = (n + items.length) % items.length;
    items.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === sSel)); });
    items[sSel].scrollIntoView({ block: 'nearest' });
    sInput.setAttribute('aria-activedescendant', items[sSel].id);
  }
  var lastFocus = null;
  function openOverlay(box) {
    lastFocus = document.activeElement;
    box.hidden = false;
    void box.offsetWidth;                                // let the browser see "hidden" go away first
    box.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
  }
  function closeOverlay(box, after) {
    if (!box || box.hidden) return;
    box.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(function () { box.hidden = true; if (after) after(); }, reduce ? 0 : 320);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); } }
  }
  function openSearch(prefill) {
    openOverlay(sBox);
    if (typeof prefill === 'string') sInput.value = prefill;
    runSearch();
    setTimeout(function () { sInput.focus(); sInput.select(); }, 30);
  }
  function closeSearch() { closeOverlay(sBox); }
  sInput.addEventListener('input', runSearch);
  sInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); selectResult(sSel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectResult(sSel - 1); }
    else if (e.key === 'Enter') {
      var a = $$('.m2-res', sList)[sSel];
      if (a) { e.preventDefault(); a.click(); }
    }
  });

  /* =====================================================================
     9. Phone bottom sheet: the menu, or "On this page"
     ===================================================================== */
  var sheet = $('#m2-sheet');
  var sheetBody = $('[data-m2-sheet-body]');
  var sheetTitle = $('#m2-sheet-title');
  function openSheet(mode) {
    if (mode === 'toc') {
      sheetTitle.textContent = 'On this page';
      sheetBody.innerHTML = '<ol>' + secs.map(function (s, i) {
        return '<li><a href="#' + s.id + '"' + (i === activeSec ? ' class="is-on"' : '') + '>' + esc(text(s.querySelector('h2'))) + '</a></li>';
      }).join('') + '</ol>';
    } else {
      sheetTitle.textContent = 'Manual';
      sheetBody.innerHTML = navHTML('m2b');
      markNav(sheetBody);
    }
    openOverlay(sheet);
    var on = $('.is-current, .is-on', sheetBody);
    if (on) on.scrollIntoView({ block: 'center' });
    setTimeout(function () { var x = $('.m2-sheet-head .m2-iconbtn', sheet); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function closeSheet() { closeOverlay(sheet); }

  /* =====================================================================
     10. Picture zoom (lightbox)
     ===================================================================== */
  var lb = $('#m2-lb');
  var lbImg = $('.m2-lb-img', lb);
  var lbCap = $('.m2-lb-cap', lb);
  var lbFrom = null;
  // "FLIP" animation: the big picture starts exactly over the small one and
  // grows into place (transform only, so it stays smooth).
  function flip(fromRect, reverse, done) {
    if (reduce || !lbImg.animate || !fromRect) { if (done) done(); return; }
    var to = lbImg.getBoundingClientRect();
    if (!to.width) { if (done) done(); return; }
    var dx = fromRect.left + fromRect.width / 2 - (to.left + to.width / 2);
    var dy = fromRect.top + fromRect.height / 2 - (to.top + to.height / 2);
    var sc = fromRect.width / to.width;
    var a = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')';
    var frames = reverse ? [{ transform: 'none' }, { transform: a }] : [{ transform: a }, { transform: 'none' }];
    var anim = lbImg.animate(frames, { duration: reverse ? 260 : 380, easing: 'cubic-bezier(.22,.61,.36,1)' });
    anim.onfinish = function () { if (done) done(); };
  }
  function openLightbox(btn) {
    var img = btn.querySelector('img');
    if (!img) return;
    lbFrom = btn;
    lb.classList.remove('is-zoomed');
    // copy the picture's real size first, so the zoomed picture keeps its shape while it loads
    if (img.getAttribute('width')) { lbImg.setAttribute('width', img.getAttribute('width')); lbImg.setAttribute('height', img.getAttribute('height')); }
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    var cap = btn.closest('figure') && btn.closest('figure').querySelector('figcaption');
    lbCap.textContent = cap ? text(cap) : (img.alt || '');
    openOverlay(lb);
    var rect = img.getBoundingClientRect();
    var start = function () { flip(rect, false); };
    if (lbImg.complete) requestAnimationFrame(start); else lbImg.onload = start;
    setTimeout(function () { $('.m2-lb-x', lb).focus({ preventScroll: true }); }, 50);
  }
  function closeLightbox() {
    if (lb.hidden) return;
    var img = lbFrom && lbFrom.querySelector('img');
    var rect = img ? img.getBoundingClientRect() : null;
    if (lb.classList.contains('is-zoomed')) rect = null;
    flip(rect, true);
    closeOverlay(lb, function () { lbImg.removeAttribute('src'); });
  }
  lbImg.addEventListener('click', function () { lb.classList.toggle('is-zoomed'); });

  /* ---------- one click handler for every "open"/"close" button ---------- */
  root.addEventListener('click', function (e) {
    var z = e.target.closest('.m2-zoom');
    if (z) { e.preventDefault(); openLightbox(z); return; }
    var o = e.target.closest('[data-m2-open]');
    if (o) {
      var what = o.getAttribute('data-m2-open');
      if (what === 'search') openSearch(); else openSheet(what);
      return;
    }
    if (e.target.closest('[data-m2-close]')) {
      if (!lb.hidden) closeLightbox(); else if (!sBox.hidden) closeSearch(); else closeSheet();
    }
  });

  /* =====================================================================
     11. Keyboard: / or Ctrl+K = search, Esc = close, Tab stays inside open windows
     ===================================================================== */
  function openBox() { return [lb, sBox, sheet].filter(function (b) { return !b.hidden; })[0] || null; }
  document.addEventListener('keydown', function (e) {
    var box = openBox();
    if (e.key === 'Escape' && box) { e.preventDefault(); if (box === lb) closeLightbox(); else closeOverlay(box); return; }
    if (box && e.key === 'Tab') {
      // keep keyboard focus inside the open window
      var f = $$('a[href], button:not([disabled]), input', box).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') || (document.activeElement && document.activeElement.isContentEditable);
    if (!box && !typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')))) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ---------- start ---------- */
  measureTop();
  route(false);
  window.addEventListener('load', function () { measureTop(); onScroll(); });
})();
