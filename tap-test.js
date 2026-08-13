// Shared by tap-test.html and tap-test-b.html, which differ only in their meta
// tags. See tap-test.html for what this is measuring and why.

(function () {
  // Kept above the readout panel, which occupies the bottom of the screen.
  // Spread as widely as that allows: a constant offset and an offset that grows
  // down the page mean different faults, and only a spread of targets tells
  // them apart.
  var TARGETS = [0.07, 0.18, 0.29, 0.40, 0.50];
  var results = [];
  var strayTaps = 0;

  function layout() {
    var host = document.getElementById('targets');
    host.innerHTML = '';
    TARGETS.forEach(function (frac, i) {
      var el = document.createElement('div');
      el.className = 'ring';
      el.style.top = (window.innerHeight * frac) + 'px';
      el.textContent = String(i + 1);
      // The listener sits on the ring itself: if it never fires while the touch
      // clearly landed inside its box, that is the "had to tap several times"
      // symptom, counted rather than guessed at.
      el.addEventListener('pointerdown', function (e) { record(i, el, e); });
      host.appendChild(el);
    });
    report();
  }

  function record(i, el, e) {
    var box = el.getBoundingClientRect();
    results[i] = {
      dx: Math.round(e.clientX - (box.left + box.width / 2)),
      dy: Math.round(e.clientY - (box.top + box.height / 2)),
    };
    el.classList.add('hit');
    report();
  }

  // Anything landing outside every ring, so a miss shows up as a number.
  document.addEventListener('pointerdown', function (e) {
    if (e.target.closest && (e.target.closest('.ring') || e.target.closest('#panel'))) return;
    strayTaps++;
    report();
  });

  function inset(name) {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;height:env(safe-area-inset-' + name + ');';
    document.body.appendChild(probe);
    var v = probe.getBoundingClientRect().height;
    probe.remove();
    return Math.round(v);
  }

  function report() {
    var done = results.filter(Boolean);
    var lines = results.map(function (r, i) {
      return r ? ('حلقه ' + (i + 1) + ': افقی ' + r.dx + ' ، عمودی <b>' + r.dy + '</b>') : null;
    }).filter(Boolean);
    document.getElementById('deltas').innerHTML =
      lines.join('<br>') + (lines.length ? '<br>' : '') +
      'ضربه‌های بیرون از حلقه‌ها: <b>' + strayTaps + '</b>';

    if (done.length === TARGETS.length) {
      var ys = done.map(function (r) { return r.dy; });
      var avg = Math.round(ys.reduce(function (s, y) { return s + y; }, 0) / ys.length);
      document.getElementById('verdict').innerHTML =
        'میانگین خطای عمودی: <b>' + avg + '</b> پیکسل — پراکندگی: <b>' +
        (Math.max.apply(null, ys) - Math.min.apply(null, ys)) + '</b>';
    }

    var vv = window.visualViewport;
    document.getElementById('metrics').innerHTML = [
      'standalone: <b>' + (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) + '</b>',
      'innerHeight: <b>' + window.innerHeight + '</b> ، screen: ' +
        screen.width + '×' + screen.height,
      'visualViewport: ' + (vv ? (Math.round(vv.width) + '×' + Math.round(vv.height) +
        ' ، offsetTop <b>' + Math.round(vv.offsetTop) + '</b> ، pageTop ' +
        Math.round(vv.pageTop) + ' ، scale ' + vv.scale) : 'ندارد'),
      'scrollY: <b>' + Math.round(window.scrollY) + '</b> ، dpr: ' + window.devicePixelRatio,
      'safe-area بالا/پایین: <b>' + inset('top') + '</b> / ' + inset('bottom'),
    ].join('<br>');
  }

  document.getElementById('reset').addEventListener('click', function () {
    results = [];
    strayTaps = 0;
    document.getElementById('verdict').textContent = 'روی وسطِ هر پنج حلقه یک ضربه بزن';
    layout();
  });

  window.addEventListener('resize', layout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', report);
    window.visualViewport.addEventListener('scroll', report);
  }
  layout();
})();
