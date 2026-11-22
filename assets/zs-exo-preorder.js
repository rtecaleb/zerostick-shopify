/* ==========================================================================
   ZeroStick EXO pre-order page — behaviour for sections/zs-exo-preorder.liquid
   1. Gallery: thumbnails cross-fade the big picture (arrow keys work too).
   2. Version cards (Xbox / PS5): copy the picked variant id into the product
      form, update the price, the button and the "in the box" list, and the
      address bar (?variant=…) so the link can be shared.
   3. Pre-order button: adds to cart with /cart/add.js and shows a small
      panel with Checkout. If anything fails we fall back to a normal form
      post, so the customer can always order.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-xp]');
  if (!root) return;
  var dataEl = document.querySelector('[data-xp-data]');
  var data = dataEl ? JSON.parse(dataEl.textContent) : { variants: [] };

  /* ---------- 1. gallery ---------- */
  var slides = root.querySelectorAll('.xp-slide');
  var thumbs = root.querySelectorAll('.xp-thumb');
  var cur = 0;
  function show(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('is-on', n === cur); });
    thumbs.forEach(function (t, n) { t.setAttribute('aria-current', n === cur ? 'true' : 'false'); });
  }
  thumbs.forEach(function (t, n) { t.addEventListener('click', function () { show(n); }); });
  var main = root.querySelector('[data-xp-main]');
  if (main) {
    main.setAttribute('tabindex', '0');
    main.setAttribute('aria-label', 'Product pictures. Use the arrow keys to change picture.');
    main.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'ArrowLeft') show(cur - 1);
    });
    // simple swipe on phones
    var x0 = null;
    main.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  /* ---------- 2. version cards ---------- */
  var idInput = root.querySelector('[data-xp-id]');
  var priceEl = root.querySelector('[data-price]');
  var addBtn = root.querySelector('[data-xp-add]');
  var ps5Only = root.querySelectorAll('[data-xp-ps5-only]');
  var needPs5 = root.querySelector('[data-xp-need-ps5]');
  var needXbox = root.querySelector('[data-xp-need-xbox]');
  function byId(id) {
    for (var i = 0; i < data.variants.length; i++) if (String(data.variants[i].id) === String(id)) return data.variants[i];
    return null;
  }
  function pick(radio, push) {
    var v = byId(radio.value);
    if (!v) return;
    var isPs5 = radio.getAttribute('data-ps5') === 'true';
    if (idInput) idInput.value = v.id;
    if (priceEl) {
      priceEl.style.opacity = '0';
      setTimeout(function () { priceEl.textContent = v.price; priceEl.style.opacity = '1'; }, 140);
    }
    if (addBtn) {
      addBtn.disabled = !v.available;
      addBtn.textContent = v.available ? 'Pre-order — ships ' + data.shipShort : 'Unavailable';
    }
    ps5Only.forEach(function (li) { li.hidden = !isPs5; });
    if (needPs5) needPs5.hidden = !isPs5;
    if (needXbox) needXbox.hidden = isPs5;
    if (push && window.history && history.replaceState) {
      var u = new URL(location.href); u.searchParams.set('variant', v.id);
      history.replaceState(null, '', u.toString());
    }
  }
  var radios = root.querySelectorAll('input[name="xp-version"]');
  radios.forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) pick(r, true); });
    if (r.checked) pick(r, false);
  });

  /* ---------- 3. add to cart ---------- */
  var form = root.querySelector('[data-xp-form]');
  var toast = root.querySelector('[data-xp-toast]');
  var hideTimer = null;
  if (form && window.fetch && window.FormData) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!addBtn || addBtn.disabled) return;
      addBtn.classList.add('is-loading');
      fetch('/cart/add.js', { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) })
        .then(function (r) { if (!r.ok) throw r; return r.json(); })
        .then(function (item) {
          addBtn.classList.remove('is-loading');
          if (!toast) { location.href = '/cart'; return; }
          toast.querySelector('[data-xp-toast-title]').textContent = 'Pre-order added: ' + (item.variant_title || item.title);
          toast.querySelector('[data-xp-toast-sub]').textContent = 'Ships ' + (item.properties && item.properties['Pre-order'] ? item.properties['Pre-order'].replace(/^Ships /, '') : '');
          toast.classList.add('is-on');
          clearTimeout(hideTimer);
          hideTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 9000);
          document.dispatchEvent(new CustomEvent('cart:refresh'));
        })
        .catch(function () {
          // fall back to the plain form post so the order still goes through
          addBtn.classList.remove('is-loading');
          form.submit();
        });
    });
  }
})();
