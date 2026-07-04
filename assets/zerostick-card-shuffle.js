/* ZeroStick listing enhancements:
   1) Auto-cycle color-variant images on listing cards.
   2) Products tagged "coming-soon" become non-clickable and show a
      "Coming Soon" badge (and a disabled state on the product page). */
(function () {
  function abs(u) { return u && u.indexOf('//') === 0 ? 'https:' + u : u; }

  function comingSoon(p) {
    var t = p.tags;
    if (!t) return false;
    if (typeof t === 'string') t = t.split(',');
    return t.map(function (x) { return ('' + x).trim().toLowerCase(); }).indexOf('coming-soon') >= 0;
  }

  function colorImages(p) {
    var seen = {}, out = [];
    (p.variants || []).forEach(function (v) {
      var u = v.featured_image && v.featured_image.src;
      if (u) { u = abs(u); if (!seen[u]) { seen[u] = 1; out.push(u); } }
    });
    return out;
  }

  function markCard(card) {
    card.classList.add('zs-coming-soon');
    card.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }, true);
      a.style.pointerEvents = 'none';
      a.style.cursor = 'default';
      a.removeAttribute('href');
    });
    var media = card.querySelector('.card__media, .card__inner') || card;
    if (getComputedStyle(media).position === 'static') media.style.position = 'relative';
    if (!card.querySelector('.zs-cs-badge')) {
      var b = document.createElement('div');
      b.className = 'zs-cs-badge';
      b.textContent = 'Coming Soon';
      media.appendChild(b);
    }
    var price = card.querySelector('.price');
    if (price) price.innerHTML = '<span class="zs-cs-price">Coming Soon</span>';
  }

  function initCard(card) {
    if (card.dataset.zsInit) return;
    card.dataset.zsInit = '1';
    var link = card.querySelector('a[href*="/products/"]');
    if (!link) return;
    var handle = (link.getAttribute('href').split('/products/')[1] || '').split('?')[0].split('#')[0];
    if (!handle) return;

    fetch('/products/' + handle + '.js').then(function (r) { return r.json(); }).then(function (p) {
      if (comingSoon(p)) { markCard(card); return; }
      var imgs = colorImages(p);
      if (imgs.length < 2) return;
      var el = card.querySelector('.card__media img') || card.querySelector('img');
      if (!el) return;
      imgs.forEach(function (u) { var x = new Image(); x.src = u; });
      el.style.transition = 'opacity .35s ease';
      var i = 0;
      setInterval(function () {
        i = (i + 1) % imgs.length;
        el.style.opacity = '0';
        setTimeout(function () { el.removeAttribute('srcset'); el.src = imgs[i]; el.style.opacity = '1'; }, 350);
      }, 2000);
    }).catch(function () {});
  }

  function addShipNote() {
    if (document.querySelector('.zs-ship-note')) return;
    var buttons = document.querySelector('.product-form__buttons') || document.querySelector('.product-form');
    if (!buttons) return;
    var note = document.createElement('div');
    note.className = 'zs-ship-note';
    note.textContent = 'Ships next business day after purchase';
    buttons.parentNode.insertBefore(note, buttons);
  }

  function productPage() {
    if (!/template-product/.test(document.body.className)) return;
    var handle = (location.pathname.split('/products/')[1] || '').split('?')[0].split('#')[0];
    if (!handle) return;
    fetch('/products/' + handle + '.js').then(function (r) { return r.json(); }).then(function (p) {
      var form = document.querySelector('product-form') || document.querySelector('.product-form');
      var buttons = document.querySelector('.product-form__buttons') || form;
      if (comingSoon(p)) {
        if (buttons) {
          var notice = document.createElement('div');
          notice.className = 'zs-cs-productbtn';
          notice.textContent = 'Coming Soon';
          buttons.parentNode.insertBefore(notice, buttons);
          buttons.style.display = 'none';
        }
        return;
      }
      addShipNote();
    }).catch(function () {});
  }

  function run() {
    document.querySelectorAll('.card-wrapper').forEach(initCard);
    productPage();
  }
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
