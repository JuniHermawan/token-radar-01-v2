// Launch Radar v2's dashboard: filters, sorting, detail view and the model sandbox.
// Reads window.LAUNCH_RADAR from ../data.js. No network, no external assets.
(function () {
  'use strict';
  var DATA = window.LAUNCH_RADAR;
  if (!DATA) { document.body.innerHTML = '<p style="padding:40px">Radar data not found.</p>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  }
  function pctClass(n) { return n === null || n === undefined ? 'flat' : n > 0 ? 'pos' : n < 0 ? 'neg' : 'flat'; }
  function ageStr(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function driverClass(d) {
    return { 'Growth-led': 'tag-growth', 'Seasoned': 'tag-season', 'Multi-chain': 'tag-multi', 'Scale-led': 'tag-scale' }[d] || 'tag-scale';
  }

  // ---- state ---------------------------------------------------------------
  var state = { tab: 'pre', sort: 'rank', dir: 1, q: '', category: '', chain: '', driver: '', watch: false };
  var sandbox = { base: DATA.model.base_multiple, growth: DATA.model.growth_weight, maturity: DATA.model.maturity_range, reach: DATA.model.reach_weight };
  var sandboxOn = false;

  // ---- static header facts ---------------------------------------------------
  $('meta').textContent = 'Snapshot ' + DATA.as_of + ' · DeFiLlama protocol index · radar-3 model';
  $('as-of').textContent = DATA.as_of;
  $('foot-as-of').textContent = DATA.as_of;
  $('board-count').textContent = DATA.board_size;
  $('fact-watch').textContent = DATA.watchlist_size + ' / ' + DATA.watchlist_size;
  $('fact-rows').textContent = DATA.board_size;
  $('fact-early').textContent = DATA.early_size;
  $('fact-live').textContent = DATA.live_size;
  $('fact-surging').textContent = DATA.surging;
  $('fact-median').textContent = money(DATA.median_implied_usd);
  $('model-line').innerHTML = 'Model: <code>implied = TVL × 0.25 × growth × maturity × reach</code> — growth is the 7-day change, floored at −90%, linear to +150% then logarithmic; maturity rewards time running with no token; reach adds 0.03 per extra chain.';

  // ---- filter options --------------------------------------------------------
  function fillOptions(select, values) {
    var seen = {};
    values.forEach(function (v) { if (v) seen[v] = true; });
    Object.keys(seen).sort().forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      select.appendChild(o);
    });
  }
  fillOptions($('category'), DATA.rows.map(function (r) { return r.category; }));
  fillOptions($('chain'), DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []));

  // ---- the model, recomputed live for the sandbox -----------------------------
  function effectiveGrowth(g) {
    if (g <= 150) return Math.max(-90, g);
    return 150 + 50 * Math.log10(g / 150);
  }
  function impliedOf(r, m) {
    var g = r.change_7d === null ? 0 : r.change_7d;
    var gEff = effectiveGrowth(g);
    var growthMult = 1 + (gEff / 100) * m.growth;
    var age = r.age_days === null ? 365 : r.age_days;
    var maturityMult = 0.6 + (Math.min(age, 1095) / 1095) * m.maturity;
    var reachMult = 1 + m.reach * Math.min(Math.max(r.chains.length - 1, 0), 5);
    return { implied: Math.max(1, Math.round(r.tvl_usd * m.base * growthMult * maturityMult * reachMult)), growthMult: growthMult, maturityMult: maturityMult, reachMult: reachMult };
  }

  // ---- filtering and sorting ---------------------------------------------------
  function visibleRows() {
    var list = state.tab === 'pre' ? DATA.rows : DATA.live;
    var q = state.q.trim().toLowerCase();
    list = list.filter(function (r) {
      if (state.tab === 'pre') {
        if (state.watch && !r.on_watchlist) return false;
        if (state.driver && r.driver !== state.driver) return false;
      }
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    list = list.slice();
    list.sort(function (a, b) {
      var av, bv;
      if (state.tab === 'live') {
        av = a.mcap_usd === null ? -1 : a.mcap_usd; bv = b.mcap_usd === null ? -1 : b.mcap_usd;
      } else if (key === 'rank') {
        av = sandboxOn ? impliedOf(a, sandbox).implied : a.implied_value_usd;
        bv = sandboxOn ? impliedOf(b, sandbox).implied : b.implied_value_usd;
        return bv - av;
      } else if (key === 'age_days') {
        av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days;
      } else if (key === 'change_7d') {
        av = a.change_7d === null ? -999 : a.change_7d; bv = b.change_7d === null ? -999 : b.change_7d;
      } else {
        av = a[key]; bv = b[key];
      }
      if (av === bv) return a.slug < b.slug ? -1 : 1;
      return (av < bv ? -1 : 1) * dir;
    });
    return list;
  }

  // ---- picks ------------------------------------------------------------------
  function renderPicks() {
    var top = DATA.rows.slice(0, 5);
    $('picks').innerHTML = top.map(function (r) {
      return '<button class="pick" data-slug="' + esc(r.slug) + '">' +
        '<span class="rank">Rank ' + r.rank + '</span>' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<p class="imp">' + money(r.implied_value_usd) + ' implied</p>' +
        '<p class="sub">' + money(r.tvl_usd) + ' TVL · <span class="' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + ' 7d</span></p>' +
        '<span class="tag ' + driverClass(r.driver) + '">' + esc(r.driver) + '</span>' +
        '</button>';
    }).join('');
  }
  renderPicks();

  // ---- table ------------------------------------------------------------------
  function renderTable() {
    var list = visibleRows();
    var tbody = $('rows');
    var isLive = state.tab === 'live';
    $('board-title').textContent = isLive
      ? 'Live-token protocols, strongest market cap first. These already trade — shown with the market\u2019s own value, never ranked.'
      : 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.';
    $('shown').textContent = list.length + ' rows shown' + (sandboxOn ? ' · sandbox model active — the submitted board uses the radar-3 constants' : '');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">No protocols match these filters.</td></tr>';
      return;
    }
    var maxImp = 0;
    list.forEach(function (r) {
      var v = isLive ? (r.mcap_usd || 0) : (sandboxOn ? impliedOf(r, sandbox).implied : r.implied_value_usd);
      if (v > maxImp) maxImp = v;
    });
    tbody.innerHTML = list.map(function (r) {
      var imp = isLive ? r.mcap_usd : (sandboxOn ? impliedOf(r, sandbox).implied : r.implied_value_usd);
      var width = maxImp ? Math.max(2, Math.round((imp || 0) / maxImp * 100)) : 0;
      var driver = isLive ? '<span class="tag tag-scale">Live token</span>' : '<span class="tag ' + driverClass(r.driver) + '">' + esc(r.driver) + '</span>';
      var token = isLive ? '<span class="token-live">live · ' + money(r.mcap_usd) + '</span>' : '<span class="token-dot">no token</span>';
      var badge = (!isLive && r.on_watchlist) ? '<span class="watch-badge">WATCHLIST</span>' : '';
      var rankCell = isLive ? '—' : r.rank;
      return '<tr data-slug="' + esc(r.slug) + '" data-live="' + (isLive ? '1' : '0') + '">' +
        '<td>' + rankCell + '</td>' +
        '<td class="proto"><b>' + esc(r.name) + badge + '</b><span>' + esc(r.category || 'Uncategorised') + ' on ' + esc(r.chains[0] || '—') + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + pctClass(r.change_7d) + '">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + (isLive ? '—' : ageStr(r.age_days)) + '</td>' +
        '<td class="num">' + r.chains.length + '</td>' +
        '<td>' + driver + '</td>' +
        '<td class="num"><span class="bar"><i style="width:' + width + '%"></i></span><span class="imp-val">' + money(imp) + '</span></td>' +
        '<td>' + token + '</td>' +
        '</tr>';
    }).join('');
  }

  // ---- detail view --------------------------------------------------------------
  function splitStep(step) {
    var costIdx = step.indexOf(' Cost: ');
    var timeIdx = step.indexOf(' Time: ');
    if (costIdx < 0 || timeIdx < 0) return { action: step, cost: '', time: '' };
    return { action: step.slice(0, costIdx), cost: step.slice(costIdx + 7, timeIdx), time: step.slice(timeIdx + 7).replace(/\.$/, '') };
  }
  function cmpBar(label, value, median, fmt) {
    var max = Math.max(value, median);
    var wv = max ? Math.round(value / max * 100) : 0;
    var wm = max ? Math.round(median / max * 100) : 0;
    return '<div><h4>' + label + '</h4>' +
      '<p class="cmp-num">' + fmt(value) + '</p>' +
      '<p class="cmp-sub">Board median: ' + fmt(median) + '</p>' +
      '<svg width="100%" height="34" role="img" aria-label="' + label + ' comparison">' +
      '<rect x="0" y="2" width="' + wv + '%" height="9" rx="4" fill="#2dd4a7"></rect>' +
      '<rect x="0" y="19" width="' + wm + '%" height="9" rx="4" fill="#3a4a6b"></rect>' +
      '</svg></div>';
  }
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { r = DATA.rows[i]; break; }
    if (!r) return;
    var m = DATA.model;
    var g = r.change_7d === null ? 0 : r.change_7d;
    var gEff = effectiveGrowth(g);
    var base = r.tvl_usd * m.base_multiple;
    var why = '<p class="why"><b>Why rank ' + r.rank + ':</b> ' + money(r.tvl_usd) + ' of TVL at the 0.25× base gives ' + money(base) + '; ' +
      (g > 0 ? '+' + g.toFixed(1) + '% growth over seven days' : g < 0 ? g.toFixed(1) + '% over seven days' : 'flat seven-day growth') +
      ' gives it the ' + r.growth_multiplier.toFixed(4) + '× growth multiple; ' +
      (r.age_days === null ? 'an unknown listing date, counted as 365 days,' : ageStr(r.age_days) + ' running with no token,') +
      ' gives it the ' + r.maturity_multiplier.toFixed(4) + '× maturity multiple; and ' + r.chains.length + (r.chains.length === 1 ? ' chain' : ' chains') +
      ' give it the ' + r.reach_multiplier.toFixed(4) + '× reach multiple — for ' + money(r.implied_value_usd) + ' implied.</p>';
    var steps = r.farm_steps.map(function (s) {
      var p = splitStep(s);
      return '<li>' + esc(p.action) + '<br><span class="cost">Cost: ' + esc(p.cost) + ' · Time: ' + esc(p.time) + '</span></li>';
    }).join('');
    $('detail-body').innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="d-sub">Rank ' + r.rank + ' of ' + DATA.board_size + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + ' · ' + (r.on_watchlist ? 'on the watchlist' : 'early radar') + ' · <span class="tag ' + driverClass(r.driver) + '">' + esc(r.driver) + '</span></p>' +
      why +
      '<table class="eq"><thead><tr><th>Factor</th><th>Input</th><th>Multiple</th><th>Value</th></tr></thead><tbody>' +
      '<tr><td>Base</td><td>' + money(r.tvl_usd) + ' TVL × 0.25</td><td>—</td><td>' + money(base) + '</td></tr>' +
      '<tr><td>Growth</td><td>' + pct(r.change_7d) + ' 7d → ' + gEff.toFixed(1) + '% effective</td><td>' + r.growth_multiplier.toFixed(4) + '×</td><td>' + money(base * r.growth_multiplier) + '</td></tr>' +
      '<tr><td>Maturity</td><td>' + (r.age_days === null ? 'unknown age (365d)' : ageStr(r.age_days)) + '</td><td>' + r.maturity_multiplier.toFixed(4) + '×</td><td>' + money(base * r.growth_multiplier * r.maturity_multiplier) + '</td></tr>' +
      '<tr><td>Reach</td><td>' + r.chains.length + (r.chains.length === 1 ? ' chain' : ' chains') + '</td><td>' + r.reach_multiplier.toFixed(4) + '×</td><td>' + money(r.implied_value_usd) + '</td></tr>' +
      '</tbody><tfoot><tr><td>Implied value</td><td></td><td></td><td>' + money(r.implied_value_usd) + '</td></tr></tfoot></table>' +
      '<div class="cmp">' + cmpBar('TVL vs the board', r.tvl_usd, DATA.median_tvl_usd, money) + cmpBar('Implied value vs the board', r.implied_value_usd, DATA.median_implied_usd, money) + '</div>' +
      '<div class="farm"><h3>Farm plan — eight steps</h3><ol>' + steps + '</ol></div>';
    var dlg = $('detail');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setHash({ p: slug });
  }
  function closeDetail() {
    var dlg = $('detail');
    if (typeof dlg.close === 'function' && dlg.open) dlg.close();
    setHash({ p: '' });
  }

  // ---- hash routing ----------------------------------------------------------------
  function setHash(patch) {
    var h = new URLSearchParams(location.hash.slice(1));
    Object.keys(patch).forEach(function (k) { if (patch[k]) h.set(k, patch[k]); else h.delete(k); });
    history.replaceState(null, '', '#' + h.toString());
  }
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    return { q: h.get('q') || '', category: h.get('category') || '', chain: h.get('chain') || '', driver: h.get('driver') || '', watch: h.get('watch') === '1', tab: h.get('tab') || 'pre', p: h.get('p') || '' };
  }

  // ---- events -----------------------------------------------------------------------
  function syncControls() {
    $('q').value = state.q; $('category').value = state.category; $('chain').value = state.chain;
    $('driver').value = state.driver; $('watch').checked = state.watch;
    $('tab-pre').classList.toggle('on', state.tab === 'pre');
    $('tab-pre').setAttribute('aria-selected', state.tab === 'pre' ? 'true' : 'false');
    $('tab-live').classList.toggle('on', state.tab === 'live');
    $('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    document.querySelectorAll('.sort').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sort') === state.sort); });
  }
  function applyAndRender(push) {
    syncControls();
    renderTable();
    if (push) setHash({ q: state.q, category: state.category, chain: state.chain, driver: state.driver, watch: state.watch ? '1' : '', tab: state.tab === 'pre' ? '' : 'live' });
  }
  $('q').addEventListener('input', function () { state.q = $('q').value; applyAndRender(true); });
  $('category').addEventListener('change', function () { state.category = $('category').value; applyAndRender(true); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; applyAndRender(true); });
  $('driver').addEventListener('change', function () { state.driver = $('driver').value; applyAndRender(true); });
  $('watch').addEventListener('change', function () { state.watch = $('watch').checked; applyAndRender(true); });
  $('tab-pre').addEventListener('click', function () { state.tab = 'pre'; applyAndRender(true); });
  $('tab-live').addEventListener('click', function () { state.tab = 'live'; applyAndRender(true); });
  document.querySelectorAll('.sort').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = 1; }
      if (key === 'rank') state.dir = 1;
      applyAndRender(false);
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr && tr.getAttribute('data-live') !== '1') openDetail(tr.getAttribute('data-slug'));
  });
  $('picks').addEventListener('click', function (e) {
    var b = e.target.closest('.pick');
    if (b) openDetail(b.getAttribute('data-slug'));
  });
  $('detail').addEventListener('click', function (e) { if (e.target === $('detail')) closeDetail(); });
  $('detail').addEventListener('close', function () { setHash({ p: '' }); });

  // ---- sandbox -----------------------------------------------------------------------
  function sandboxChanged() {
    sandbox.base = parseFloat($('sb-base').value);
    sandbox.growth = parseFloat($('sb-growth').value);
    sandbox.maturity = parseFloat($('sb-maturity').value);
    sandbox.reach = parseFloat($('sb-reach').value);
    $('sb-base-v').textContent = sandbox.base.toFixed(2);
    $('sb-growth-v').textContent = sandbox.growth.toFixed(2);
    $('sb-maturity-v').textContent = sandbox.maturity.toFixed(2);
    $('sb-reach-v').textContent = sandbox.reach.toFixed(2);
    sandboxOn = sandbox.base !== DATA.model.base_multiple || sandbox.growth !== DATA.model.growth_weight || sandbox.maturity !== DATA.model.maturity_range || sandbox.reach !== DATA.model.reach_weight;
    if (state.tab === 'pre' && state.sort === 'rank') state.dir = 1;
    renderTable();
  }
  ['sb-base', 'sb-growth', 'sb-maturity', 'sb-reach'].forEach(function (id) { $(id).addEventListener('input', sandboxChanged); });
  $('sb-reset').addEventListener('click', function () {
    $('sb-base').value = DATA.model.base_multiple;
    $('sb-growth').value = DATA.model.growth_weight;
    $('sb-maturity').value = DATA.model.maturity_range;
    $('sb-reach').value = DATA.model.reach_weight;
    sandboxChanged();
  });

  // ---- init ---------------------------------------------------------------------------
  var init = readHash();
  state.q = init.q; state.category = init.category; state.chain = init.chain;
  state.driver = init.driver; state.watch = init.watch; state.tab = init.tab === 'live' ? 'live' : 'pre';
  applyAndRender(false);
  if (init.p) openDetail(init.p);
})();
