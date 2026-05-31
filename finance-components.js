// ============================================================
// finance-components.js — all render functions and UI helpers
// Depends on finance-data.js being loaded first.
// ============================================================

// ── Ticker state ─────────────────────────────────────────────
let tickerIdx       = 0;
let tickerTimer     = null;
let tickerLastSig   = '';
let tickerLastEntries = [];

// ── Classification helpers ────────────────────────────────────
function pctClass(pct) {
  if (pct < 5)  return 'good';
  if (pct < 25) return 'warn';
  return 'bad';
}

function ordPctClass(pct) {
  if (pct < 5)  return 'good';
  if (pct < 25) return 'warn';
  return 'bad';
}

// ── Date format helpers ───────────────────────────────────────
function fmtActivityDate(ts) {
  const d         = new Date(ts);
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const dayStart  = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (dayStart === today)     return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (dayStart === yesterday) return 'yest';
  const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return mons[d.getMonth()] + ' ' + d.getDate();
}

function formatRenewal(iso) {
  if (!iso) return '';
  const isoSafe = (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso))
    ? iso + 'T00:00' : iso;
  const d = new Date(isoSafe);
  if (isNaN(d)) return iso;
  const now      = new Date();
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dayStart - todayStart) / (1000 * 60 * 60 * 24));
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let prefix = '';
  if (diffDays < 0)      prefix = 'past · ';
  else if (diffDays === 0) prefix = 'today · ';
  else if (diffDays === 1) prefix = 'tomorrow · ';
  else if (diffDays <= 7)  prefix = 'in ' + diffDays + 'd · ';
  return prefix + dateLabel;
}

function ordFmtArrival(iso) {
  if (!iso) return null;
  const isoSafe = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T00:00' : iso;
  const d = new Date(isoSafe);
  if (isNaN(d)) return null;
  const now        = new Date();
  const dayStart   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays   = Math.round((dayStart - todayStart) / 86400000);
  const dateLabel  = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let cls = '', prefix = '';
  if (diffDays < 0)        { cls = 'past';  prefix = 'late · '; }
  else if (diffDays === 0) { cls = 'today'; prefix = 'today · '; }
  else if (diffDays === 1) { cls = 'soon';  prefix = 'tomorrow · '; }
  else if (diffDays <= 7)  { cls = 'soon';  prefix = 'in ' + diffDays + 'd · '; }
  return { cls, label: prefix + dateLabel };
}

// ── SVG path helpers ─────────────────────────────────────────
function donutArcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const x1o = cx + rOuter * Math.cos(startAngle);
  const y1o = cy + rOuter * Math.sin(startAngle);
  const x2o = cx + rOuter * Math.cos(endAngle);
  const y2o = cy + rOuter * Math.sin(endAngle);
  const x1i = cx + rInner * Math.cos(endAngle);
  const y1i = cy + rInner * Math.sin(endAngle);
  const x2i = cx + rInner * Math.cos(startAngle);
  const y2i = cy + rInner * Math.sin(startAngle);
  const large = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return 'M ' + x1o.toFixed(2) + ' ' + y1o.toFixed(2)
    + ' A ' + rOuter + ' ' + rOuter + ' 0 ' + large + ' 1 ' + x2o.toFixed(2) + ' ' + y2o.toFixed(2)
    + ' L ' + x1i.toFixed(2) + ' ' + y1i.toFixed(2)
    + ' A ' + rInner + ' ' + rInner + ' 0 ' + large + ' 0 ' + x2i.toFixed(2) + ' ' + y2i.toFixed(2)
    + ' Z';
}

function nwSmoothPath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) return 'M' + points[0].x + ',' + points[0].y + ' L' + points[1].x + ',' + points[1].y;
  const d = ['M' + points[0].x + ',' + points[0].y];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push('C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + p2.x + ',' + p2.y);
  }
  return d.join(' ');
}

// ── Inline edit helpers ───────────────────────────────────────
function beginNwAmountEdit(amtEl, items, idx, catKey) {
  if (amtEl.querySelector('input')) return;
  const currencyEl = document.getElementById('netWorthCurrency');
  const symbol  = currencyEl ? currencyEl.value : 'CHF';
  const rate    = exchangeRates[symbol] || 1;
  const curCHF  = Number(items[idx].amount) || 0;
  const curDisplay = curCHF * rate;
  const input = document.createElement('input');
  input.type      = 'text';
  input.inputMode = 'decimal';
  input.value     = String(curDisplay.toFixed(curDisplay % 1 === 0 ? 0 : 2));
  input.style.cssText = 'width:110px;padding:4px 8px;font-family:var(--font-mono);font-size:12px;'
    + 'background:rgba(0,0,0,0.30);border:1px solid rgba(255,255,255,0.10);'
    + 'color:var(--text-primary);border-radius:6px;text-align:right;'
    + 'font-variant-numeric:tabular-nums;outline:none;';
  amtEl.textContent = '';
  amtEl.appendChild(input);
  setTimeout(() => { input.focus(); input.select(); }, 0);

  let saved = false;
  function save() {
    if (saved) return; saved = true;
    const v = input.value.trim();
    if (v === '') { renderAllNetWorth(); return; }
    let nextDisplay = curDisplay;
    if (/^[+\-]\s*\d/.test(v)) {
      const delta = parseFloat(v.replace(/\s+/g, ''));
      if (!isNaN(delta)) nextDisplay = curDisplay + delta;
    } else {
      const n = parseFloat(v);
      if (!isNaN(n)) nextDisplay = n;
    }
    if (nextDisplay < 0) nextDisplay = 0;
    const nextCHF  = nextDisplay / rate;
    const deltaCHF = nextCHF - curCHF;
    items[idx].amount = nextCHF;
    storeSet('nw:' + catKey, items);
    if (Math.abs(deltaCHF) > 0.005) logActivity(catKey, items[idx].name, deltaCHF, 'edit');
    renderAllNetWorth();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { saved = true; renderAllNetWorth(); }
  });
  input.addEventListener('blur', save);
}

function beginNwNameEdit(nameEl, items, idx, catKey) {
  if (nameEl.querySelector('input')) return;
  const cur   = String(items[idx].name || '');
  const input = document.createElement('input');
  input.type  = 'text';
  input.value = cur;
  input.style.cssText = 'width:100%;padding:4px 8px;font-family:inherit;font-size:13px;'
    + 'background:rgba(0,0,0,0.30);border:1px solid rgba(255,255,255,0.10);'
    + 'color:var(--text-primary);border-radius:6px;outline:none;';
  nameEl.textContent = '';
  nameEl.appendChild(input);
  setTimeout(() => { input.focus(); input.select(); }, 0);

  let saved = false;
  function save() {
    if (saved) return; saved = true;
    const v = input.value.trim();
    if (v) { items[idx].name = v; storeSet('nw:' + catKey, items); }
    renderAllNetWorth();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { saved = true; renderAllNetWorth(); }
  });
  input.addEventListener('blur', save);
}

// ── Dropdown population ───────────────────────────────────────
function populateSubFromSelect() {
  const sel = document.getElementById('subFromCat');
  if (!sel) return;
  const prev     = sel.value;
  const accounts = listAllNwAccounts();
  const ICONS    = { bank: '🏦', stocks: '📈', other: '💼' };
  if (!accounts.length) {
    sel.innerHTML = '<option value="">No accounts yet</option>';
    sel.disabled  = true;
    return;
  }
  sel.disabled  = false;
  sel.innerHTML = accounts.map(a => {
    const value = a.catKey + '::' + a.itemName;
    return '<option value="' + value + '">' + ICONS[a.catKey] + ' ' + escapeHtml(a.itemName) + '</option>';
  }).join('');
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function populateOrdFromSelect() {
  const sel = document.getElementById('ordFromCat');
  if (!sel) return;
  const accounts = listAllNwAccounts();
  const prev     = sel.value;
  const ICONS    = { bank: '🏦', stocks: '📈', other: '💼' };
  if (!accounts.length) {
    sel.innerHTML = '<option value="">No accounts yet</option>';
    sel.disabled  = true;
    return;
  }
  sel.disabled  = false;
  sel.innerHTML = accounts.map(a => {
    const value = a.catKey + '::' + a.itemName;
    return '<option value="' + value + '">' + ICONS[a.catKey] + ' ' + escapeHtml(a.itemName) + '</option>';
  }).join('');
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

// ── Auto-deduct processing ────────────────────────────────────
function processAutoDeductSubs() {
  const items = storeGet('subs') || [];
  if (!items.length) return false;
  const now     = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let changed   = false;
  items.forEach(it => {
    if (!it.autoDeduct || !it.renewal || !it.fromCat || !it.fromAccount) return;
    const isoSafe = (typeof it.renewal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.renewal))
      ? it.renewal + 'T00:00' : it.renewal;
    let renewalDate = new Date(isoSafe);
    if (isNaN(renewalDate)) return;
    let safety = 0;
    while (renewalDate.getTime() <= todayMs && safety++ < 200) {
      const renewalMs = new Date(renewalDate.getFullYear(), renewalDate.getMonth(), renewalDate.getDate()).getTime();
      if (!(it.lastDeductedAt && it.lastDeductedAt >= renewalMs)) {
        const nwItems = storeGet('nw:' + it.fromCat) || [];
        const idx     = nwItems.findIndex(x => String(x.name) === String(it.fromAccount));
        if (idx < 0) break;
        const cost = Number(it.amount) || 0;
        nwItems[idx].amount = (Number(nwItems[idx].amount) || 0) - cost;
        storeSet('nw:' + it.fromCat, nwItems);
        logActivity(it.fromCat, nwItems[idx].name, -cost, 'edit');
        it.lastDeductedAt = renewalMs;
        changed = true;
      }
      if (it.period === 'weekly')      renewalDate.setDate(renewalDate.getDate() + 7);
      else if (it.period === 'yearly') renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      else                             renewalDate.setMonth(renewalDate.getMonth() + 1);
    }
    const newRenewal = renewalDate.getFullYear() + '-'
      + String(renewalDate.getMonth() + 1).padStart(2, '0') + '-'
      + String(renewalDate.getDate()).padStart(2, '0');
    if (newRenewal !== it.renewal) { it.renewal = newRenewal; changed = true; }
  });
  if (changed) storeSet('subs', items);
  return changed;
}

// ── Net Worth category render ─────────────────────────────────
function renderNetWorthCategory(cat) {
  const items = storeGet('nw:' + cat.key) || [];
  const list  = document.getElementById(cat.listId);
  if (!list) return 0;
  list.innerHTML = '';
  let total = 0;
  items.forEach((it, idx) => {
    total += Number(it.amount) || 0;
    const row  = document.createElement('div');
    row.className = 'nw-row';
    const name = document.createElement('span');
    name.className = 'nw-name nw-name-edit';
    name.textContent = it.name;
    name.title = 'Tap to rename';
    name.addEventListener('click', () => beginNwNameEdit(name, items, idx, cat.key));
    const amt  = document.createElement('span');
    amt.className = 'nw-amt nw-amt-edit';
    amt.textContent = fmtMoney(it.amount);
    amt.title = 'Tap to edit · type +500 to add, -200 to subtract, or a new total';
    amt.addEventListener('click', () => beginNwAmountEdit(amt, items, idx, cat.key));
    const del  = document.createElement('button');
    del.className = 'nw-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      const removed = items[idx];
      items.splice(idx, 1);
      storeSet('nw:' + cat.key, items);
      if (removed) logActivity(cat.key, removed.name, -(Number(removed.amount) || 0), 'delete');
      renderAllNetWorth();
    });
    row.appendChild(name); row.appendChild(amt); row.appendChild(del);
    list.appendChild(row);
  });
  document.getElementById(cat.totalId).textContent = fmtMoney(total);
  return total;
}

// ── Stock Holdings render ─────────────────────────────────────
async function renderStockHoldings(forceRefetch) {
  const holdings  = storeGet(STOCKS_HOLDINGS_KEY) || [];
  const listEl    = document.getElementById('stocksList');
  const totalEl   = document.getElementById('stocksTotal');
  const lastUpdEl = document.getElementById('stocksLastUpdated');
  if (!listEl) return;

  _paintStockRows(holdings, listEl);

  const now   = Date.now();
  const stale = holdings.filter(h => {
    const t   = h.ticker.toUpperCase();
    const c   = stockPriceCache[t];
    if (c && (now - c.ts) <= STOCK_CACHE_TTL) return false;          // fresh
    const attempted = stockFetchAttempted[t];
    if (!forceRefetch && attempted && (now - attempted) < STOCK_CACHE_TTL) return false; // failed recently
    return true;
  });

  if (!holdings.length || (!forceRefetch && !stale.length)) {
    _calcAndUpdateStocksTotal(holdings, totalEl, lastUpdEl);
    return;
  }
  if (_stocksFetching && !forceRefetch) return;
  _stocksFetching = true;
  if (lastUpdEl) lastUpdEl.textContent = 'Updating…';

  const tickers = [...new Set(
    (forceRefetch ? holdings : stale).map(h => h.ticker.toUpperCase())
  )];
  await Promise.all(tickers.map(async t => {
    const q = await fetchStockQuote(t);
    if (q) {
      stockPriceCache[t]   = q;
      stockFetchAttempted[t] = null;
      const hold = holdings.find(h => h.ticker.toUpperCase() === t);
      if (hold && !hold.name && q.name) {
        hold.name = q.name;
        storeSet(STOCKS_HOLDINGS_KEY, holdings);
      }
    } else {
      stockFetchAttempted[t] = Date.now();
      if (stockPriceCache[t] === undefined) stockPriceCache[t] = null; // mark tried+failed
      console.warn('[stocks] price unavailable for', t);
    }
  }));

  persistStockPriceCache();
  _stocksFetching = false;
  _paintStockRows(holdings, listEl);
  _calcAndUpdateStocksTotal(holdings, totalEl, lastUpdEl);
}

function _paintStockRows(holdings, listEl) {
  listEl.innerHTML = '';
  holdings.forEach((h, idx) => {
    const cached = stockPriceCache[h.ticker.toUpperCase()];
    const shares = Number(h.shares) || 0;
    const row    = document.createElement('div');
    row.className = 'nw-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'nw-name';
    nameEl.innerHTML =
        '<span style="font-weight:700;font-family:var(--font-mono);font-size:11px;letter-spacing:0.05em;color:var(--accent)">'
      + escapeHtml(h.ticker.toUpperCase()) + '</span>'
      + (h.name ? ' <span style="color:var(--text-secondary);font-size:12px">' + escapeHtml(h.name) + '</span>' : '')
      + '<span style="display:block;margin-top:2px;font-size:10px;color:var(--text-quaternary)">'
      + shares + ' sh'
      + (cached ? ' × ' + cached.currency + ' '
          + cached.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
      + '</span>';

    let totalCHF = 0;
    const amtEl  = document.createElement('span');
    amtEl.className = 'nw-amt';
    if (cached) {
      const rate = exchangeRates[cached.currency] || exchangeRates.USD || 1;
      totalCHF = shares * cached.price / rate;
      amtEl.textContent = fmtMoney(totalCHF);
    } else if (cached === null) {
      amtEl.innerHTML = '<span style="color:var(--text-quaternary);font-size:11px">Price unavailable</span>';
    } else {
      amtEl.innerHTML = '<span style="color:var(--text-quaternary);font-size:11px">Loading…</span>';
    }

    const del = document.createElement('button');
    del.className   = 'nw-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      const arr     = storeGet(STOCKS_HOLDINGS_KEY) || [];
      const removed = arr.splice(idx, 1)[0];
      storeSet(STOCKS_HOLDINGS_KEY, arr);
      if (removed) {
        const c   = stockPriceCache[removed.ticker.toUpperCase()];
        const rate = c ? (exchangeRates[c.currency] || 1) : 1;
        const val  = c ? (Number(removed.shares) || 0) * c.price / rate : 0;
        logActivity('stocks', removed.ticker + (removed.name ? ' · ' + removed.name : ''), -val, 'delete');
      }
      renderAllNetWorth();
    });

    row.appendChild(nameEl); row.appendChild(amtEl); row.appendChild(del);
    listEl.appendChild(row);
  });
}

function _calcAndUpdateStocksTotal(holdings, totalEl, lastUpdEl) {
  let total = 0, latestTs = 0;
  holdings.forEach(h => {
    const c = stockPriceCache[h.ticker.toUpperCase()];
    if (c) {
      const rate = exchangeRates[c.currency] || exchangeRates.USD || 1;
      total += (Number(h.shares) || 0) * c.price / rate;
      if (c.ts > latestTs) latestTs = c.ts;
    }
  });
  cachedStocksTotalCHF = total;
  if (totalEl) totalEl.textContent = fmtMoney(total);
  if (lastUpdEl) {
    if (latestTs && holdings.length) {
      const mins = Math.round((Date.now() - latestTs) / 60000);
      lastUpdEl.textContent = mins < 1 ? 'just now' : mins + 'm ago';
    } else {
      lastUpdEl.textContent = holdings.length ? 'price unavailable' : '';
    }
  }
  _refreshNWTotals();
}

function _refreshNWTotals() {
  let grand = cachedStocksTotalCHF;
  const breakdown   = [];
  const sliceTotals = { stocks: cachedStocksTotalCHF };
  NW_CATS.forEach(cat => {
    const items = storeGet('nw:' + cat.key) || [];
    let sub = 0;
    items.forEach(it => { sub += Number(it.amount) || 0; });
    grand += sub;
    sliceTotals[cat.key] = sub;
    if (sub > 0) breakdown.push(cat.key + ': ' + fmtMoney(sub));
  });
  if (cachedStocksTotalCHF > 0) breakdown.unshift('stocks: ' + fmtMoney(cachedStocksTotalCHF));
  const nwTotal = document.getElementById('netWorthTotal');
  const nwBreak = document.getElementById('netWorthBreakdown');
  if (nwTotal) nwTotal.textContent = fmtMoney(grand);
  if (nwBreak) nwBreak.textContent = breakdown.join('  •  ');
  logNetWorthSnapshot(grand);
  renderNetWorthChart();
  renderAllocationDonut(sliceTotals, grand);
}

// ── Master render ─────────────────────────────────────────────
function renderAllNetWorth() {
  let grand = cachedStocksTotalCHF;
  const breakdown   = [];
  const sliceTotals = { stocks: cachedStocksTotalCHF };
  NW_CATS.forEach(cat => {
    const sub = renderNetWorthCategory(cat);
    grand += sub;
    sliceTotals[cat.key] = sub;
    if (sub > 0) breakdown.push(cat.key + ': ' + fmtMoney(sub));
  });
  if (cachedStocksTotalCHF > 0) breakdown.unshift('stocks: ' + fmtMoney(cachedStocksTotalCHF));
  const nwTotal = document.getElementById('netWorthTotal');
  const nwBreak = document.getElementById('netWorthBreakdown');
  if (nwTotal) nwTotal.textContent = fmtMoney(grand);
  if (nwBreak) nwBreak.textContent = breakdown.join('  •  ');
  logNetWorthSnapshot(grand);
  renderNetWorthChart();
  renderAllocationDonut(sliceTotals, grand);
  renderActivity();
  renderWishlist();
  renderOrders();
  updateOrdPreview();
  renderStockHoldings(false);
}

// ── Activity log render ───────────────────────────────────────
function renderActivity() {
  const list  = document.getElementById('nwActivityList');
  const empty = document.getElementById('nwActivityEmpty');
  const count = document.getElementById('nwActivityCount');
  if (!list) return;
  const arr = (storeGet(ACTIVITY_KEY) || []).slice().sort((a, b) => b.ts - a.ts);
  if (!arr.length) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    count.textContent = '–';
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  count.textContent = arr.length + ' event' + (arr.length === 1 ? '' : 's');
  list.innerHTML = arr.slice(0, 30).map(e => {
    const meta  = NW_SLICE_META[e.cat] || { name: e.cat, color: '#FFFFFF' };
    const sign  = e.delta >= 0 ? '+' : '−';
    const cls   = e.delta >= 0 ? 'up' : 'down';
    const amt   = fmtMoney(Math.abs(e.delta));
    const kind  = e.kind === 'edit' ? 'EDIT' : (e.kind === 'delete' ? 'DELETE' : 'ADD');
    return '<div class="nw-activity-row" style="color:' + meta.color + '">'
      + '<span class="nw-activity-bar" style="background:' + meta.color + '"></span>'
      + '<div class="nw-activity-info">'
      +   '<div class="nw-activity-name">' + escapeHtml(e.name || '(unnamed)') + '</div>'
      +   '<div class="nw-activity-meta">' + meta.name + ' · ' + kind + '</div>'
      + '</div>'
      + '<span class="nw-activity-amt ' + cls + '">' + sign + amt + '</span>'
      + '<span class="nw-activity-date">' + fmtActivityDate(e.ts) + '</span>'
      + '</div>';
  }).join('');
}

// ── Allocation donut ─────────────────────────────────────────
function renderAllocationDonut(catTotals, grand) {
  const svg    = document.getElementById('nwDonutSvg');
  const total  = document.getElementById('nwDonutTotal');
  const empty  = document.getElementById('nwDonutEmpty');
  const legend = document.getElementById('nwDonutLegend');
  const count  = document.getElementById('nwDonutCount');
  if (!svg || !total || !legend) return;

  const slices = [];
  NW_CATS.forEach(cat => {
    const meta  = NW_SLICE_META[cat.key] || { color: '#FFFFFF' };
    const items = storeGet('nw:' + cat.key) || [];
    items.forEach((it, i) => {
      const v = Number(it.amount) || 0;
      if (v > 0) slices.push({ key: cat.key + '::' + i, name: String(it.name || '(unnamed)'), color: meta.color, value: v });
    });
  });
  if (cachedStocksTotalCHF > 0) {
    const meta     = NW_SLICE_META.stocks;
    const holdings = storeGet(STOCKS_HOLDINGS_KEY) || [];
    const label    = holdings.length > 1 ? 'Stocks (' + holdings.length + ')' : 'Stocks';
    slices.push({ key: 'stocks', name: label, color: meta.color, value: cachedStocksTotalCHF });
  }
  const subItems       = storeGet('subs') || [];
  const annualSubsCHF  = subItems.reduce((s, it) => s + monthlyEquivalent(it) * 12, 0);
  if (annualSubsCHF > 0) {
    const meta = NW_SLICE_META.subs;
    slices.push({ key: 'subs', name: meta.name, color: meta.color, value: annualSubsCHF });
  }

  const sliceTotal = slices.reduce((s, x) => s + x.value, 0);
  if (!slices.length || sliceTotal <= 0) {
    svg.innerHTML = '<circle cx="70" cy="70" r="60" fill="rgba(255,255,255,0.025)"/>'
                  + '<circle cx="70" cy="70" r="44" fill="#0A0A0B"/>';
    total.textContent = '–';
    empty.classList.remove('hidden');
    legend.innerHTML  = '';
    count.textContent = '–';
    return;
  }
  empty.classList.add('hidden');
  total.textContent = fmtMoney(grand).split(' ')[1] || fmtMoney(grand);
  count.textContent = slices.length + ' slice' + (slices.length === 1 ? '' : 's');

  slices.sort((a, b) => b.value - a.value);
  let angle = -Math.PI / 2;
  let html  = '';
  slices.forEach(s => {
    const sliceAngle = (s.value / sliceTotal) * Math.PI * 2;
    const pad = slices.length > 1 ? 0.015 : 0;
    const a1  = angle + pad;
    const a2  = angle + sliceAngle - pad;
    if (a2 > a1) html += '<path d="' + donutArcPath(70, 70, 60, 44, a1, a2) + '" fill="' + s.color + '"></path>';
    angle += sliceAngle;
  });
  svg.innerHTML = html;
  legend.innerHTML = slices.map(s => {
    const pct = ((s.value / sliceTotal) * 100).toFixed(1);
    return '<div class="nw-leg" style="color:' + s.color + '">'
      + '<span class="nw-leg-dot" style="background:' + s.color + '"></span>'
      + '<span class="nw-leg-name">' + escapeHtml(s.name) + '</span>'
      + '<span class="nw-leg-pct">' + pct + '%</span>'
      + '</div>';
  }).join('');
}

// ── Net worth chart ───────────────────────────────────────────
function renderNetWorthChart() {
  const wrap     = document.getElementById('nwChartWrap');
  const svg      = document.getElementById('nwChartSvg');
  const linePath = document.getElementById('nwChartLine');
  const areaPath = document.getElementById('nwChartArea');
  const deltaEl  = document.getElementById('nwChartDelta');
  if (!wrap || !svg || !linePath || !areaPath) return;
  const hist = storeGet(NW_HISTORY_KEY) || [];
  if (hist.length < 1) {
    wrap.classList.remove('has-data');
    linePath.setAttribute('d', '');
    areaPath.setAttribute('d', '');
    if (deltaEl) { deltaEl.textContent = '–'; deltaEl.classList.remove('up', 'down'); }
    renderChartStats([]);
    return;
  }
  wrap.classList.add('has-data');
  const first     = hist[0].v;
  const last      = hist[hist.length - 1].v;
  const change    = last - first;
  const direction = Math.abs(change) < 0.005 ? 'flat' : (change > 0 ? 'up' : 'down');
  const color     = direction === 'up' ? '#6Be3A4' : direction === 'down' ? '#FF8A8A' : 'var(--text-tertiary)';
  svg.style.color = color;

  if (deltaEl) {
    deltaEl.classList.remove('up', 'down');
    if (direction === 'up')   deltaEl.classList.add('up');
    if (direction === 'down') deltaEl.classList.add('down');
    if (direction === 'flat') {
      deltaEl.textContent = 'Flat';
    } else if (Math.abs(first) < 0.5) {
      const sign = change > 0 ? '+' : '−';
      deltaEl.textContent = sign + fmtMoney(Math.abs(change));
    } else {
      const pct    = (change / Math.abs(first)) * 100;
      const sign   = change > 0 ? '+' : '−';
      const absPct = Math.abs(pct);
      const pctStr = absPct >= 100 ? absPct.toFixed(0) : absPct >= 10 ? absPct.toFixed(1) : absPct.toFixed(2);
      deltaEl.textContent = sign + pctStr + '%';
    }
  }

  const W = 600, H = 200, pad = 8;
  const vals = hist.map(p => p.v);
  const minV = Math.min.apply(null, vals);
  const maxV = Math.max.apply(null, vals);
  const range = (maxV - minV) || Math.max(1, Math.abs(maxV));

  if (hist.length === 1) {
    const y = H / 2;
    linePath.setAttribute('d', 'M0,' + y + ' L' + W + ',' + y);
    areaPath.setAttribute('d', 'M0,' + y + ' L' + W + ',' + y + ' L' + W + ',' + H + ' L0,' + H + ' Z');
    renderChartStats(hist);
    return;
  }

  const points = hist.map((p, i) => ({
    x: (i / (hist.length - 1)) * W,
    y: H - pad - ((p.v - minV) / range) * (H - pad * 2)
  }));
  const lineD  = nwSmoothPath(points);
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  linePath.setAttribute('d', lineD);
  areaPath.setAttribute('d', lineD + ' L' + lastPt.x + ',' + H + ' L' + firstPt.x + ',' + H + ' Z');
  renderChartStats(hist);
}

function renderChartStats(hist) {
  const oneEl   = document.getElementById('nwStat1pct');
  const highEl  = document.getElementById('nwStatHigh');
  const lowEl   = document.getElementById('nwStatLow');
  const countEl = document.getElementById('nwStatCount');
  if (!oneEl) return;
  if (!hist || !hist.length) {
    oneEl.textContent = '–'; highEl.textContent = '–';
    lowEl.textContent = '–'; countEl.textContent = '0';
    return;
  }
  const vals = hist.map(p => p.v);
  const last = vals[vals.length - 1];
  const high = Math.max.apply(null, vals);
  const low  = Math.min.apply(null, vals);
  oneEl.textContent   = fmtMoney(last / 100);
  highEl.textContent  = fmtMoney(high);
  lowEl.textContent   = fmtMoney(low);
  countEl.textContent = String(hist.length);
}

// ── Subscriptions render ──────────────────────────────────────
function renderSubs() {
  const subsList  = document.getElementById('subsList');
  const subsEmpty = document.getElementById('subsEmpty');
  const subsTotal = document.getElementById('subsTotal');
  const subsYearly = document.getElementById('subsYearly');
  const subsCount = document.getElementById('subsCount');
  if (!subsList) return;

  processAutoDeductSubs();
  populateSubFromSelect();

  const items = storeGet('subs') || [];
  subsList.innerHTML = '';

  if (!items.length) {
    subsEmpty.style.display = 'flex';
    subsTotal.innerHTML = fmtMoney(0) + ' <span style="font-size:13px;color:var(--text-tertiary);font-weight:500">/ mo</span>';
    subsYearly.textContent = '';
    subsCount.textContent  = '';
    return;
  }
  subsEmpty.style.display = 'none';
  let monthly = 0;

  items.forEach((it, idx) => {
    const m = monthlyEquivalent(it);
    monthly += m;

    let daysToRenew = null;
    if (it.renewal) {
      const next = nextRenewalDate(it.renewal, it.period);
      if (next) {
        const now    = new Date();
        const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        daysToRenew  = Math.round((next.getTime() - today) / 86400000);
      }
    }
    const isUrgent = daysToRenew != null && daysToRenew <= 5;
    const row = document.createElement('div');
    row.className = 'sub-row' + (isUrgent ? ' is-urgent' : '');
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;align-items:center;'
      + 'padding:12px 14px;background:rgba(255,255,255,0.025);border-radius:var(--radius-md);'
      + 'margin-bottom:8px;gap:12px;';

    const renewLine = it.renewal
      ? '<div class="sub-renew-line" style="font-size:10px;color:#F2C063;margin-top:3px">↻ Renews ' + formatRenewal(it.renewal) + '</div>'
      : '';

    const pills = [];
    if (it.fromCat && it.fromAccount) {
      pills.push('<span class="sub-from-pill">from · ' + escapeHtml(it.fromAccount) + '</span>');
    }
    pills.push(
      '<button class="sub-row-toggle' + (it.autoDeduct ? ' is-on' : '') + '" data-sub-toggle="' + idx + '" type="button">'
      + '<span class="sub-row-toggle-dot"></span>'
      + (it.autoDeduct ? 'Auto-deduct ON' : 'Auto-deduct off')
      + '</button>'
    );
    const metaLine = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + pills.join('') + '</div>';

    const left = document.createElement('div');
    left.style.cssText = 'min-width:0';
    left.innerHTML = '<div style="font-weight:600;color:var(--text-primary);font-size:14px">' + escapeHtml(it.name) + '</div>'
      + '<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;text-transform:capitalize">' + it.period + '</div>'
      + renewLine + metaLine;

    const bigNum = fmtMoney(m);
    const origHint = (it.entered_currency && it.entered_currency !== 'CHF' && it.entered_amount != null)
      ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">billed ' + it.entered_currency + ' '
        + Number(it.entered_amount).toLocaleString('en-US', { minimumFractionDigits: it.entered_amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
        + ' / ' + it.period + '</div>'
      : (it.period !== 'monthly'
          ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">billed ' + fmtMoney(it.amount) + ' / ' + it.period + '</div>'
          : '');

    const cost = document.createElement('div');
    cost.style.cssText = 'text-align:right;line-height:1.1';
    cost.innerHTML = '<div style="font-size:20px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums">' + bigNum + '</div>'
      + '<div style="font-size:10px;color:var(--text-tertiary);margin-top:1px">/ month</div>'
      + origHint;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-direction:column;gap:4px;align-items:center';
    const editBtn = document.createElement('button');
    editBtn.title = 'Edit';
    editBtn.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.10);'
      + 'color:var(--text-tertiary);cursor:pointer;font-size:12px;padding:3px 7px;'
      + 'border-radius:5px;font-family:inherit;line-height:1';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => editSubInline(idx));

    const del = document.createElement('button');
    del.title = 'Delete';
    del.style.cssText = editBtn.style.cssText;
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (!confirm('Delete "' + it.name + '"?')) return;
      items.splice(idx, 1); storeSet('subs', items); renderSubs();
    });

    actions.appendChild(editBtn); actions.appendChild(del);
    row.appendChild(left); row.appendChild(cost); row.appendChild(actions);
    subsList.appendChild(row);
  });

  subsList.querySelectorAll('[data-sub-toggle]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const i   = parseInt(b.dataset.subToggle, 10);
      const arr = storeGet('subs') || [];
      if (!arr[i]) return;
      if (!arr[i].autoDeduct && (!arr[i].fromCat || !arr[i].fromAccount)) {
        alert('Pick a "From account" first (use the ✎ edit button) so the deduction knows where to take the money from.');
        return;
      }
      arr[i].autoDeduct = !arr[i].autoDeduct;
      storeSet('subs', arr); renderSubs();
    });
  });

  subsTotal.innerHTML = fmtMoney(monthly) + ' <span style="font-size:13px;color:var(--text-tertiary);font-weight:500">/ mo</span>';
  subsYearly.textContent = '~' + fmtMoney(monthly * 12) + ' per year';
  subsCount.textContent  = items.length + (items.length === 1 ? ' subscription' : ' subscriptions');
  renderAllNetWorth();
}

function editSubInline(idx) {
  const items = storeGet('subs') || [];
  const it    = items[idx];
  if (!it) return;
  const subsList = document.getElementById('subsList');
  const rows  = subsList ? subsList.querySelectorAll('.sub-row') : [];
  const row   = rows[idx];
  if (!row) return;
  const enteredCcy = it.entered_currency || 'CHF';
  const enteredAmt = it.entered_amount != null ? it.entered_amount : it.amount;
  const periodOpts = ['monthly','yearly','weekly'].map(p =>
    '<option value="' + p + '"' + (p === it.period ? ' selected' : '') + '>'
    + p.charAt(0).toUpperCase() + p.slice(1) + '</option>'
  ).join('');
  const ccyOpts = ['CHF','USD','EUR','GBP'].map(c =>
    '<option value="' + c + '"' + (c === enteredCcy ? ' selected' : '') + '>' + c + '</option>'
  ).join('');
  const accounts   = listAllNwAccounts();
  const ICONS      = { bank: '🏦', stocks: '📈', other: '💼' };
  const currentFrom = (it.fromCat && it.fromAccount) ? (it.fromCat + '::' + it.fromAccount) : '';
  const fromOpts   = '<option value="">No account linked</option>'
    + accounts.map(a => {
      const v = a.catKey + '::' + a.itemName;
      return '<option value="' + v + '"' + (v === currentFrom ? ' selected' : '') + '>'
        + ICONS[a.catKey] + ' ' + escapeHtml(a.itemName) + '</option>';
    }).join('');

  row.innerHTML = '';
  row.style.gridTemplateColumns = '1fr';
  row.style.padding = '14px';

  const inStyle = 'padding:6px 10px;border:0.5px solid rgba(255,255,255,0.10);border-radius:var(--radius-md);'
    + 'font-size:12px;font-family:inherit;background:var(--bg-card);color:var(--text-primary)';
  const form = document.createElement('div');
  form.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center';
  form.innerHTML =
    '<input type="text" class="se-name" value="' + escapeHtml(it.name) + '" style="flex:1.5;min-width:120px;' + inStyle + '" />'
    + '<input type="number" step="0.01" class="se-amt" value="' + Number(enteredAmt).toFixed(2) + '" style="width:90px;' + inStyle + '" />'
    + '<select class="se-ccy" style="' + inStyle + '">' + ccyOpts + '</select>'
    + '<select class="se-per" style="' + inStyle + '">' + periodOpts + '</select>'
    + '<label class="date-field" style="min-width:140px"><span class="date-emoji" aria-hidden="true">📅</span>'
    +   '<input type="date" class="se-ren" value="' + (it.renewal && /^\d{4}-\d{2}-\d{2}/.test(it.renewal) ? it.renewal.slice(0,10) : '') + '" /></label>'
    + '<select class="se-from" style="' + inStyle + ';min-width:130px">' + fromOpts + '</select>'
    + '<label class="sub-auto-toggle" style="padding:6px 10px"><input type="checkbox" class="se-auto"' + (it.autoDeduct ? ' checked' : '') + ' />'
    +   '<span class="sub-auto-track"><span class="sub-auto-thumb"></span></span>'
    +   '<span class="sub-auto-label">Auto-deduct</span></label>'
    + '<button class="se-save quick-add-btn">Save</button>'
    + '<button class="se-cancel" style="background:transparent;border:1px solid rgba(255,255,255,0.10);color:var(--text-tertiary);cursor:pointer;font-size:12px;padding:6px 10px;border-radius:var(--radius-md);font-family:inherit">Cancel</button>';
  row.appendChild(form);

  const save = () => {
    const newName   = row.querySelector('.se-name').value.trim();
    const newAmtRaw = parseFloat(row.querySelector('.se-amt').value);
    const newCcy    = row.querySelector('.se-ccy').value;
    const newPer    = row.querySelector('.se-per').value;
    const newRen    = row.querySelector('.se-ren').value || null;
    const newFromVal = row.querySelector('.se-from').value;
    const newAuto   = row.querySelector('.se-auto').checked;
    let newFromCat = null, newFromAccount = null;
    if (newFromVal) {
      const ix = newFromVal.indexOf('::');
      if (ix > 0) { newFromCat = newFromVal.slice(0, ix); newFromAccount = newFromVal.slice(ix + 2); }
    }
    if (newAuto && (!newFromCat || !newFromAccount)) {
      alert('Pick a "From account" — auto-deduct needs somewhere to take the money from.');
      return;
    }
    if (!newName || isNaN(newAmtRaw)) return;
    const rate = exchangeRates[newCcy] || 1;
    items[idx] = { ...it, name: newName, amount: newAmtRaw / rate, period: newPer,
      renewal: newRen, entered_amount: newAmtRaw, entered_currency: newCcy,
      fromCat: newFromCat, fromAccount: newFromAccount, autoDeduct: newAuto };
    storeSet('subs', items); renderSubs();
  };
  const cancel = () => renderSubs();
  row.querySelector('.se-save').addEventListener('click', save);
  row.querySelector('.se-cancel').addEventListener('click', cancel);
  row.querySelectorAll('input').forEach(i => {
    i.addEventListener('keydown', e => {
      if (e.key === 'Enter')  save();
      if (e.key === 'Escape') cancel();
    });
  });
  row.querySelector('.se-name').focus();
}

// ── Wishlist render ───────────────────────────────────────────
function renderWishlist() {
  const wishList    = document.getElementById('wishList');
  const wishEmpty   = document.getElementById('wishEmpty');
  const wishTotalEl = document.getElementById('wishTotal');
  const wishPctEl   = document.getElementById('wishPctOfNw');
  const wishCountEl = document.getElementById('wishCount');
  const heroPctEl   = document.getElementById('wishPctOfNwHero');
  const heroFill    = document.getElementById('wishHeroFill');
  if (!wishList) return;

  const items = storeGet('wishlist') || [];
  const grand = nwGrandCHF();
  let total   = 0;
  items.forEach(it => { total += Number(it.amount) || 0; });

  if (wishTotalEl) wishTotalEl.textContent = fmtMoney(total);
  if (grand > 0) {
    const pct = (total / grand) * 100;
    const cls = pctClass(pct);
    if (heroPctEl) {
      heroPctEl.textContent = pct.toFixed(2) + '%';
      heroPctEl.className   = 'wish-hero-pct-num' + (cls === 'good' ? '' : (cls === 'warn' ? ' warn' : ' bad'));
    }
    if (heroFill) heroFill.style.width = Math.min(100, pct) + '%';
    if (wishPctEl) wishPctEl.textContent = 'Your wishlist is ' + pct.toFixed(2) + '% of your ' + fmtMoney(grand) + ' net worth';
  } else {
    if (heroPctEl) { heroPctEl.textContent = '–'; heroPctEl.className = 'wish-hero-pct-num'; }
    if (heroFill)  heroFill.style.width = '0%';
    if (wishPctEl) wishPctEl.textContent = 'Add accounts in Net Worth first to see this as a %';
  }
  if (wishCountEl) wishCountEl.textContent = items.length + (items.length === 1 ? ' item' : ' items');

  wishList.innerHTML = '';
  if (!items.length) { if (wishEmpty) wishEmpty.classList.remove('hidden'); return; }
  if (wishEmpty) wishEmpty.classList.add('hidden');

  items.slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)).forEach(it => {
    const idx      = items.indexOf(it);
    const cost     = Number(it.amount) || 0;
    const pct      = grand > 0 ? (cost / grand) * 100 : null;
    const cls      = pct == null ? 'flat' : pctClass(pct);
    const pctText  = pct == null ? '–' : pct.toFixed(2) + '%';
    const fillPct  = Math.min(100, pct == null ? 0 : pct);
    const row      = document.createElement('div');
    row.className  = 'wish-row';
    row.innerHTML  =
        '<div class="wish-row-h">'
      + '<div class="wish-row-info">'
      +   '<div class="wish-row-name">' + escapeHtml(it.name) + '</div>'
      +   '<div class="wish-row-meta">' + (it.entered_currency || 'CHF') + ' '
      +     Number(it.entered_amount != null ? it.entered_amount : it.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })
      +     ' · added ' + fmtActivityDate(it.ts || Date.now()) + '</div>'
      + '</div>'
      + '<div class="wish-row-amt-wrap">'
      +   '<div class="wish-row-amt">' + fmtMoney(cost) + '</div>'
      +   '<div class="wish-row-pct ' + cls + '">' + pctText + ' of NW</div>'
      + '</div>'
      + '<button class="wish-row-x" data-i="' + idx + '" aria-label="Remove">×</button>'
      + '</div>'
      + '<div class="wish-row-bar"><div class="wish-row-bar-fill ' + cls + '" style="width:' + fillPct + '%"></div></div>';
    wishList.appendChild(row);
  });

  wishList.querySelectorAll('.wish-row-x').forEach(b => {
    b.addEventListener('click', () => {
      const i   = parseInt(b.dataset.i, 10);
      const arr = storeGet('wishlist') || [];
      arr.splice(i, 1); storeSet('wishlist', arr); renderWishlist();
    });
  });
}

// ── Orders render ─────────────────────────────────────────────
function renderOrders() {
  const list  = document.getElementById('ordList');
  const empty = document.getElementById('ordEmpty');
  const count = document.getElementById('ordCount');
  if (!list) return;
  populateOrdFromSelect();

  const items = storeGet('incoming_orders') || [];
  const grand = nwGrandCHF();
  if (count) count.textContent = items.length + (items.length === 1 ? ' item' : ' items');
  list.innerHTML = '';

  if (!items.length) { if (empty) empty.classList.remove('hidden'); return; }
  if (empty) empty.classList.add('hidden');

  items.slice().sort((a, b) => {
    if (!a.date) return 1; if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  }).forEach(o => {
    const cost       = Number(o.amount) || 0;
    const isDeducted = !!o.deductedAt;
    let pct, pctText, pctCls;
    if (isDeducted && typeof o.pctAtDeduction === 'number') {
      pct     = o.pctAtDeduction;
      pctText = pct.toFixed(2) + '% of NW';
      pctCls  = ordPctClass(pct) + ' frozen';
    } else if (grand > 0) {
      pct     = (cost / grand) * 100;
      pctText = pct.toFixed(2) + '% of NW';
      pctCls  = ordPctClass(pct);
    } else {
      pct     = null;
      pctText = '– of NW';
      pctCls  = '';
    }

    const fromMeta         = ORD_FROM_META[o.fromCat] || ORD_FROM_META.bank;
    const fromAccountLabel = o.fromAccount ? escapeHtml(o.fromAccount) : fromMeta.name;
    const arr              = ordFmtArrival(o.date);
    const arrHtml          = arr
      ? '<span class="ord-meta-pill date ' + arr.cls + '">' + arr.label + '</span>'
      : '<span class="ord-meta-pill date">no arrival</span>';

    const row = document.createElement('div');
    row.className = 'ord-card cat-' + (o.fromCat || 'bank') + (isDeducted ? ' is-deducted' : '');

    const footHtml = isDeducted
      ? '<div class="ord-card-foot">'
        + '<span class="ord-deducted-pill">Deducted from '
        + escapeHtml(o.deductedFrom && o.deductedFrom.name ? o.deductedFrom.name : fromAccountLabel)
        + '</span>'
        + '<button class="ord-deduct-undo" data-undo-id="' + o.id + '">Undo</button>'
        + '</div>'
      : '<div class="ord-card-foot">'
        + '<button class="ord-deduct-btn" data-deduct-id="' + o.id + '">→ Deduct from net worth</button>'
        + '</div>';

    row.innerHTML =
        '<div class="ord-card-h">'
      +   '<div class="ord-card-name">' + escapeHtml(o.name) + '</div>'
      +   '<div class="ord-card-amt">' + fmtMoney(cost) + '</div>'
      +   '<button class="ord-card-x" data-id="' + o.id + '" aria-label="Remove">×</button>'
      + '</div>'
      + '<div class="ord-card-meta">'
      +   '<span class="ord-meta-pill from">from · ' + fromAccountLabel + '</span>'
      +   '<span class="ord-meta-pill pct ' + pctCls + '">' + pctText + '</span>'
      +   arrHtml
      + '</div>'
      + footHtml;
    list.appendChild(row);
  });

  list.querySelectorAll('.ord-card-x').forEach(b => {
    b.addEventListener('click', () => {
      const id  = b.dataset.id;
      const arr = (storeGet('incoming_orders') || []).filter(x => x.id !== id);
      storeSet('incoming_orders', arr); renderOrders();
    });
  });
  list.querySelectorAll('.ord-deduct-btn').forEach(b => {
    b.addEventListener('click', () => openDeductChooser(b.dataset.deductId, b.closest('.ord-card')));
  });
  list.querySelectorAll('.ord-deduct-undo').forEach(b => {
    b.addEventListener('click', () => undoDeduct(b.dataset.undoId));
  });
}

// ── Order add-form live preview ───────────────────────────────
function updateOrdPreview() {
  const costEl = document.getElementById('ordCost');
  const ccyEl  = document.getElementById('ordCurrency');
  const fromEl = document.getElementById('ordFromCat');
  const prev   = document.getElementById('ordAddPreview');
  if (!prev) return;
  const aRaw = parseFloat(costEl && costEl.value);
  if (!costEl || isNaN(aRaw) || aRaw <= 0) {
    prev.textContent = 'Type a cost — preview will show what % of net worth it takes.';
    prev.className   = 'ord-add-preview';
    return;
  }
  const ccy       = ccyEl ? ccyEl.value : 'CHF';
  const rate      = exchangeRates[ccy] || 1;
  const amountCHF = aRaw / rate;
  const grand     = nwGrandCHF();
  const parsed    = parseFromValue(fromEl ? fromEl.value : '');
  const fromName  = parsed.name || (ORD_FROM_META[parsed.cat] || ORD_FROM_META.bank).name;
  if (grand > 0) {
    const pct = (amountCHF / grand) * 100;
    const cls = ordPctClass(pct);
    prev.textContent = fmtMoney(amountCHF) + ' from ' + fromName + ' · ' + pct.toFixed(2) + '% of your ' + fmtMoney(grand) + ' net worth';
    prev.className   = 'ord-add-preview ' + (cls === 'good' ? '' : cls);
  } else {
    prev.textContent = fmtMoney(amountCHF) + ' from ' + fromName + ' · add net worth first to see %';
    prev.className   = 'ord-add-preview';
  }
}

// ── Deduct chooser ────────────────────────────────────────────
function openDeductChooser(orderId, cardEl) {
  if (!cardEl) return;
  const existing = cardEl.querySelector('.ord-deduct-chooser');
  if (existing) { existing.remove(); return; }
  const order    = (storeGet('incoming_orders') || []).find(x => x.id === orderId);
  if (!order) return;
  const accounts = listAllNwAccounts();
  if (!accounts.length) { alert('Add at least one net worth account before deducting.'); return; }
  const ICONS = { bank: '🏦', stocks: '📈', other: '💼' };
  const cost  = Number(order.amount) || 0;
  const optsHtml = accounts.map(a => {
    const insufficient = a.amountCHF < cost - 0.005;
    const cls = 'ord-deduct-opt' + (insufficient ? ' insufficient' : '');
    return '<button class="' + cls + '" data-cat="' + a.catKey + '" data-name="' + escapeHtml(a.itemName) + '"'
      + (insufficient ? ' data-insuf="1"' : '') + '>'
      + ICONS[a.catKey] + ' ' + escapeHtml(a.itemName)
      + '<small>' + fmtMoney(a.amountCHF) + (insufficient ? ' · not enough' : ' available') + '</small>'
      + '</button>';
  }).join('');
  const chooser = document.createElement('div');
  chooser.className = 'ord-deduct-chooser';
  chooser.innerHTML =
      '<div class="ord-deduct-chooser-title">Deduct ' + fmtMoney(cost) + ' from…</div>'
    + '<div class="ord-deduct-options">' + optsHtml + '</div>'
    + '<button class="ord-deduct-cancel" type="button">cancel</button>';
  cardEl.appendChild(chooser);
  chooser.querySelectorAll('.ord-deduct-opt').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.insuf === '1' && !confirm('That account doesn\'t have enough — deduct anyway?')) return;
      confirmDeduct(orderId, b.dataset.cat, b.dataset.name);
    });
  });
  chooser.querySelector('.ord-deduct-cancel').addEventListener('click', () => chooser.remove());
}

function confirmDeduct(orderId, catKey, itemName) {
  const orders = storeGet('incoming_orders') || [];
  const oIdx   = orders.findIndex(x => x.id === orderId);
  if (oIdx < 0) return;
  const order  = orders[oIdx];
  if (order.deductedAt) return;
  const items  = storeGet('nw:' + catKey) || [];
  const itemIdx = items.findIndex(it => String(it.name) === String(itemName));
  if (itemIdx < 0) { alert('That account no longer exists. Refresh the chooser.'); return; }
  const cost         = Number(order.amount) || 0;
  const grandBefore  = nwGrandCHF();
  const pctAtDeduction = grandBefore > 0 ? (cost / grandBefore) * 100 : 0;
  items[itemIdx].amount = (Number(items[itemIdx].amount) || 0) - cost;
  storeSet('nw:' + catKey, items);
  logActivity(catKey, items[itemIdx].name, -cost, 'edit');
  orders[oIdx] = { ...order, deductedAt: Date.now(), pctAtDeduction,
    deductedFrom: { cat: catKey, name: items[itemIdx].name } };
  storeSet('incoming_orders', orders);
  renderAllNetWorth();
}

function undoDeduct(orderId) {
  const orders = storeGet('incoming_orders') || [];
  const oIdx   = orders.findIndex(x => x.id === orderId);
  if (oIdx < 0) return;
  const order  = orders[oIdx];
  if (!order.deductedAt || !order.deductedFrom) return;
  const cost  = Number(order.amount) || 0;
  const items = storeGet('nw:' + order.deductedFrom.cat) || [];
  const itemIdx = items.findIndex(it => String(it.name) === String(order.deductedFrom.name));
  if (itemIdx >= 0) {
    items[itemIdx].amount = (Number(items[itemIdx].amount) || 0) + cost;
    storeSet('nw:' + order.deductedFrom.cat, items);
    logActivity(order.deductedFrom.cat, items[itemIdx].name, cost, 'edit');
  }
  orders[oIdx] = { ...order, deductedAt: null, pctAtDeduction: null, deductedFrom: null };
  storeSet('incoming_orders', orders);
  renderAllNetWorth();
}

// ── Finance ticker ────────────────────────────────────────────
function buildTickerEntries() {
  const subs  = storeGet('subs') || [];
  const out   = [];
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  subs.forEach(s => {
    if (!s.renewal) return;
    const next = nextRenewalDate(s.renewal, s.period);
    if (!next) return;
    const days = Math.round((next.getTime() - today) / 86400000);
    out.push({ name: s.name, amount: Number(s.amount) || 0, days, period: s.period });
  });
  out.sort((a, b) => a.days - b.days);
  return out;
}

function tickerSig(entries) {
  return entries.map(e => e.name + '|' + e.amount + '|' + e.days + '|' + (e.period || '')).join('~');
}

function paintTickerActive(wrap, stream, dots, entries) {
  if (tickerIdx >= entries.length) tickerIdx = 0;
  stream.querySelectorAll('.ticker-item').forEach((el, i) => el.classList.toggle('active', i === tickerIdx));
  dots.querySelectorAll('.ticker-dot').forEach((el, i) => el.classList.toggle('active', i === tickerIdx));
  const cur = entries[tickerIdx];
  wrap.classList.toggle('urgent', !!(cur && cur.days <= 5));
}

function renderTicker() {
  const wrap   = document.getElementById('financeTicker');
  const stream = document.getElementById('tickerStream');
  const dots   = document.getElementById('tickerDots');
  if (!wrap || !stream || !dots) return;
  const entries = buildTickerEntries();
  const sig     = tickerSig(entries);
  if (sig === tickerLastSig) {
    if (entries.length) paintTickerActive(wrap, stream, dots, entries);
    return;
  }
  tickerLastSig     = sig;
  tickerLastEntries = entries;
  if (!entries.length) {
    wrap.classList.add('hidden');
    stream.innerHTML = ''; dots.innerHTML = '';
    if (tickerTimer) { clearInterval(tickerTimer); tickerTimer = null; }
    return;
  }
  wrap.classList.remove('hidden');
  if (tickerIdx >= entries.length) tickerIdx = 0;

  stream.innerHTML = entries.map((e, i) => {
    const daysLabel = e.days < 0 ? Math.abs(e.days) + 'd late'
      : e.days === 0 ? 'TODAY'
      : e.days === 1 ? 'TOMORROW'
      : 'in ' + e.days + 'd';
    return '<div class="ticker-item' + (i === tickerIdx ? ' active' : '') + '" data-i="' + i + '">'
      + '<span class="ticker-item-name">' + escapeHtml(e.name) + '</span>'
      + '<span class="ticker-item-amt">' + fmtMoney(e.amount) + '</span>'
      + '<span class="ticker-item-days">' + daysLabel + '</span>'
      + '</div>';
  }).join('');
  dots.innerHTML = entries.map((_, i) =>
    '<span class="ticker-dot' + (i === tickerIdx ? ' active' : '') + '"></span>'
  ).join('');
  paintTickerActive(wrap, stream, dots, entries);

  if (tickerTimer) { clearInterval(tickerTimer); tickerTimer = null; }
  if (entries.length > 1) {
    tickerTimer = setInterval(() => {
      if (!tickerLastEntries.length) return;
      tickerIdx = (tickerIdx + 1) % tickerLastEntries.length;
      const w = document.getElementById('financeTicker');
      const s = document.getElementById('tickerStream');
      const d = document.getElementById('tickerDots');
      if (w && s && d) paintTickerActive(w, s, d, tickerLastEntries);
    }, 5000);
  }
}

function safeRenderTicker() {
  try { renderTicker(); } catch (e) { console.error('ticker render failed', e); }
}
