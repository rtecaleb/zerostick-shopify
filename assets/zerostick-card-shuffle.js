/* ZeroStick — auto-cycle color-variant images on collection/search listing cards.
   For products with multiple color options (each variant has its own image),
   the card's main image fades through the colors instead of staying static. */
(function () {
  function abs(u) { return u && u.indexOf('//') === 0 ? 'https:' + u : u; }

  function colorImages(p) {
    var seen = {}, out = [];
    (p.variants || []).forEach(function (v) {
      var u = v.featured_image && v.featured_image.src;
      if (u) { u = abs(u); if (!seen[u]) { seen[u] = 1; out.push(u); } }
    });
    return out; // only cycle when there are distinct per-variant images
  }

  function initCard(card) {
    if (card.dataset.zsShuffle) return;
    card.dataset.zsShuffle = '1';
    var link = card.querySelector('a[href*="/products/"]');
    if (!link) return;
    var handle = (link.getAttribute('href').split('/products/')[1] || '').split('?')[0].split('#')[0];
    if (!handle) return;

    fetch('/products/' + handle + '.js').then(function (r) { return r.json(); }).then(function (p) {
      var imgs = colorImages(p);
      if (imgs.length < 2) return;
      var el = card.querySelector('.card__media img') || card.querySelector('img');
      if (!el) return;
      imgs.forEach(function (u) { var x = new Image(); x.src = u; }); // preload
      el.style.transition = 'opacity .35s ease';
      var i = 0;
      setInterval(function () {
        i = (i + 1) % imgs.length;
        el.style.opacity = '0';
        setTimeout(function () {
          el.removeAttribute('srcset');
          el.src = imgs[i];
          el.style.opacity = '1';
        }, 350);
      }, 2000);
    }).catch(function () {});
  }

  function run() {
    document.querySelectorAll('.card-wrapper').forEach(initCard);
  }
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
