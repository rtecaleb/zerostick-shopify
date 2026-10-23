/* ZeroStick premium product page — behaviour for sections/zs-product-pro.liquid. */
  (function () {
    var root = document.querySelector('[data-zsp]');
    if (!root) return;
    var data = JSON.parse(document.querySelector('[data-zsp-data]').textContent);
    var track = root.querySelector('[data-track]'), thumbs = root.querySelector('[data-thumbs]'), dots = root.querySelector('[data-dots]');
    var input = root.querySelector('[data-variant-input]'), add = root.querySelector('[data-add]');
    var shared = data.media.filter(function (m) { return !m.variantOnly; });
    var byId = {}; data.media.forEach(function (m) { byId[m.id] = m; });
    var variant = data.variants.filter(function (v) { return v.id === data.current; })[0] || data.variants[0];
    var images = [], index = 0;

    function build(animate) {
      var lead = variant.media && byId[variant.media] ? [byId[variant.media]] : [];
      var next = lead.concat(shared);
      if (animate && images.length && track.firstChild) {
        var first = track.firstChild; first.classList.add('is-swapping');
        setTimeout(function () { render(next); go(0, false); }, 220);
      } else { render(next); }
    }
    function render(list) {
      images = list;
      track.innerHTML = list.map(function (m, i) {
        return '<div class="zsp-slide"><img src="' + m.src + '" alt="' + m.alt.replace(/"/g, '&quot;') + '"' + (i ? ' loading="lazy"' : '') + '></div>';
      }).join('');
      thumbs.innerHTML = list.map(function (m, i) {
        return '<button type="button" class="zsp-thumb" data-i="' + i + '" aria-label="Show image ' + (i + 1) + '"><img src="' + m.thumb + '" alt=""></button>';
      }).join('');
      dots.innerHTML = list.map(function () { return '<i></i>'; }).join('');
      mark(0);
    }
    function mark(i) {
      index = i;
      thumbs.querySelectorAll('.zsp-thumb').forEach(function (t, k) { t.classList.toggle('is-on', k === i); });
      dots.querySelectorAll('i').forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
      var on = thumbs.children[i];
      if (on) thumbs.scrollTo({ left: on.offsetLeft - thumbs.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
    }
    function go(i, smooth) {
      i = (i + images.length) % images.length;
      track.scrollTo({ left: track.clientWidth * i, behavior: smooth === false ? 'auto' : 'smooth' });
      mark(i);
    }
    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== index) mark(i); }, 60);
    }, { passive: true });
    thumbs.addEventListener('click', function (e) { var b = e.target.closest('.zsp-thumb'); if (b) go(+b.dataset.i); });
    root.querySelector('[data-prev]').addEventListener('click', function () { go(index - 1); });
    root.querySelector('[data-next]').addEventListener('click', function () { go(index + 1); });

    function setVariant(v) {
      variant = v;
      input.value = v.id;
      root.querySelectorAll('.zsp-swatch').forEach(function (s) {
        var on = +s.dataset.variant === v.id;
        s.classList.toggle('is-on', on); s.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      var name = root.querySelector('[data-variant-name]'); if (name) name.textContent = v.title;
      var amt = root.querySelector('[data-amount]'), cmp = root.querySelector('[data-compare]');
      amt.style.opacity = 0;
      setTimeout(function () { amt.textContent = v.price; amt.style.opacity = 1; }, 160);
      if (v.compare) { cmp.textContent = v.compare; cmp.hidden = false; } else { cmp.hidden = true; }
      add.disabled = !v.available; add.textContent = v.available ? 'Add to cart' : 'Sold out';
      if (history.replaceState) {
        var u = new URL(location.href); u.searchParams.set('variant', v.id); history.replaceState(null, '', u);
      }
      build(true);
    }
    root.querySelectorAll('.zsp-swatch').forEach(function (s) {
      s.addEventListener('click', function () {
        var v = data.variants.filter(function (x) { return x.id === +s.dataset.variant; })[0];
        if (v && v.id !== variant.id) setVariant(v);
      });
    });

    var qty = root.querySelector('[data-qty-input]');
    root.querySelectorAll('[data-qty]').forEach(function (b) {
      b.addEventListener('click', function () { qty.value = Math.max(1, (+qty.value || 1) + (+b.dataset.qty)); });
    });

    var form = root.querySelector('[data-zsp-form]'), toast = root.querySelector('[data-toast]'), hide;
    form.addEventListener('submit', function (e) {
      if (e.submitter && e.submitter !== add) return;
      e.preventDefault();
      add.classList.add('is-loading'); add.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variant.id, quantity: Math.max(1, +qty.value || 1) }] })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); })
        .then(function () {
          var lead = byId[variant.media] || images[0];
          toast.querySelector('[data-toast-img]').src = lead ? lead.thumb : '';
          toast.querySelector('[data-toast-title]').textContent = 'Added to cart';
          toast.querySelector('[data-toast-sub]').textContent = variant.title + ' · Qty ' + Math.max(1, +qty.value || 1);
          toast.classList.add('is-on'); clearTimeout(hide); hide = setTimeout(function () { toast.classList.remove('is-on'); }, 6000);
        })
        .catch(function (err) {
          toast.querySelector('[data-toast-title]').textContent = 'Couldn’t add to cart';
          toast.querySelector('[data-toast-sub]').textContent = (err && (err.description || err.message)) || 'Please try again.';
          toast.classList.add('is-on'); clearTimeout(hide); hide = setTimeout(function () { toast.classList.remove('is-on'); }, 6000);
        })
        .finally(function () { add.classList.remove('is-loading'); add.disabled = !variant.available; });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { threshold: .15 });
      root.querySelectorAll('.zsp-reveal').forEach(function (el, i) { el.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(el); });
    } else { root.querySelectorAll('.zsp-reveal').forEach(function (el) { el.classList.add('is-in'); }); }

    build(false);
  })();
