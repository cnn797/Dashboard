// ============================================================
// finance.js — initialization, event wiring, boot sequence
// Depends on finance-data.js and finance-components.js.
// Scripts at bottom of <body> so DOM is ready when this runs.
// ============================================================

// ── Bottom tabs ───────────────────────────────────────────────
function setActiveTab(name) {
  document.querySelectorAll('.bot-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  document.querySelectorAll('.section[data-section]').forEach(s => {
    if (s.dataset.section === name) s.removeAttribute('hidden');
    else s.setAttribute('hidden', '');
  });
  storeSet(TAB_KEY, name);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('.bot-tab').forEach(b =>
  b.addEventListener('click', () => setActiveTab(b.dataset.tab))
);
const _savedTab = storeGet(TAB_KEY);
setActiveTab(_savedTab && ['net','subs','incoming','wish'].includes(_savedTab) ? _savedTab : 'net');

// ── Currency selector ─────────────────────────────────────────
const _currencyEl = document.getElementById('netWorthCurrency');
if (_currencyEl) {
  const savedCur = storeGet(CURRENCY_KEY);
  if (savedCur) _currencyEl.value = savedCur;
  _currencyEl.addEventListener('change', () => {
    storeSet(CURRENCY_KEY, _currencyEl.value);
    renderAllNetWorth();
    renderSubs();
  });
}

// ── Net Worth add buttons (bank & other) ─────────────────────
NW_CATS.forEach(cat => {
  const addBtn    = document.getElementById(cat.addId);
  const nameInput = document.getElementById(cat.nameId);
  const amtInput  = document.getElementById(cat.amtId);
  if (!addBtn) return;

  function doAdd() {
    const n = nameInput.value.trim();
    const a = parseFloat(amtInput.value);
    if (!n || isNaN(a)) return;
    const currencyEl = document.getElementById('netWorthCurrency');
    const symbol     = currencyEl ? currencyEl.value : 'CHF';
    const rate       = exchangeRates[symbol] || 1;
    const amountCHF  = a / rate;
    const items      = storeGet('nw:' + cat.key) || [];
    items.push({ name: n, amount: amountCHF });
    storeSet('nw:' + cat.key, items);
    logActivity(cat.key, n, amountCHF, 'add');
    nameInput.value = ''; amtInput.value = '';
    renderAllNetWorth();
  }
  addBtn.addEventListener('click', doAdd);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  amtInput.addEventListener('keydown',  e => { if (e.key === 'Enter') doAdd(); });
});

// ── Stock Holdings add ────────────────────────────────────────
(function () {
  const tickerInput = document.getElementById('stocksTicker');
  const sharesInput = document.getElementById('stocksShares');
  const addBtn      = document.getElementById('stocksAddBtn');
  if (!addBtn) return;

  function doAddHolding() {
    const ticker = (tickerInput.value || '').trim().toUpperCase();
    const shares = parseFloat(sharesInput.value);
    if (!ticker || isNaN(shares) || shares <= 0) return;
    const arr      = storeGet(STOCKS_HOLDINGS_KEY) || [];
    const existing = arr.findIndex(h => h.ticker.toUpperCase() === ticker);
    if (existing >= 0) {
      arr[existing].shares = shares;
    } else {
      arr.push({ ticker, name: '', shares });
    }
    storeSet(STOCKS_HOLDINGS_KEY, arr);
    tickerInput.value = '';
    sharesInput.value = '';
    renderAllNetWorth();
  }

  addBtn.addEventListener('click', doAddHolding);
  tickerInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAddHolding(); });
  sharesInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAddHolding(); });

  const refreshBtn = document.getElementById('stocksRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => renderStockHoldings(true));
}());

// ── Parse "catKey::accountName" from From-dropdown values ─────
function parseFromValue(v) {
  const s  = String(v || '');
  const ix = s.indexOf('::');
  if (ix < 0) return { cat: 'bank', name: '' };
  return { cat: s.slice(0, ix), name: s.slice(ix + 2) };
}

// ── Add subscription ──────────────────────────────────────────
function doSubAdd() {
  try {
    const nEl = document.getElementById('subName');
    const aEl = document.getElementById('subAmount');
    const ccEl = document.getElementById('subCurrency');
    const pEl  = document.getElementById('subPeriod');
    const rEl  = document.getElementById('subRenewal');
    const fEl  = document.getElementById('subFromCat');
    const tEl  = document.getElementById('subAutoDeduct');
    if (!nEl || !aEl) return;
    const n    = (nEl.value || '').trim();
    const aRaw = parseFloat(aEl.value);
    if (!n || isNaN(aRaw)) { nEl.focus(); return; }
    const enteredCcy = ccEl ? ccEl.value : 'CHF';
    const rate       = exchangeRates[enteredCcy] || 1;
    const amountCHF  = aRaw / rate;
    let fromCat = null, fromAccount = null;
    if (fEl && fEl.value) {
      const ix = fEl.value.indexOf('::');
      if (ix > 0) { fromCat = fEl.value.slice(0, ix); fromAccount = fEl.value.slice(ix + 2); }
    }
    const autoDeduct = !!(tEl && tEl.checked);
    if (autoDeduct && (!fromCat || !fromAccount)) {
      alert('Pick a "From account" first — auto-deduct needs to know where to take the money from.');
      return;
    }
    const items = storeGet('subs') || [];
    items.push({
      name: n, amount: amountCHF,
      period: pEl ? pEl.value : 'monthly',
      renewal: rEl && rEl.value ? rEl.value : null,
      entered_amount: aRaw, entered_currency: enteredCcy,
      fromCat, fromAccount, autoDeduct, lastDeductedAt: null
    });
    storeSet('subs', items);
    nEl.value = ''; aEl.value = '';
    if (rEl) rEl.value = '';
    if (tEl) tEl.checked = false;
    renderSubs();
  } catch (e) { console.error('subAdd failed', e); }
}

const _subName   = document.getElementById('subName');
const _subAmount = document.getElementById('subAmount');
if (_subName)   _subName.addEventListener('keydown',   e => { if (e.key === 'Enter') doSubAdd(); });
if (_subAmount) _subAmount.addEventListener('keydown', e => { if (e.key === 'Enter') doSubAdd(); });

// ── Add wishlist item ─────────────────────────────────────────
function doWishAdd() {
  try {
    const nEl = document.getElementById('wishName');
    const aEl = document.getElementById('wishAmount');
    const cEl = document.getElementById('wishCurrency');
    if (!nEl || !aEl) return;
    const n    = (nEl.value || '').trim();
    const aRaw = parseFloat(aEl.value);
    if (!n || isNaN(aRaw)) { nEl.focus(); return; }
    const enteredCcy = cEl ? cEl.value : 'CHF';
    const rate       = exchangeRates[enteredCcy] || 1;
    const amountCHF  = aRaw / rate;
    const arr        = storeGet('wishlist') || [];
    arr.push({ name: n, amount: amountCHF, ts: Date.now(), entered_amount: aRaw, entered_currency: enteredCcy });
    storeSet('wishlist', arr);
    nEl.value = ''; aEl.value = '';
    renderWishlist();
  } catch (e) { console.error('wishAdd failed', e); }
}

const _wishName   = document.getElementById('wishName');
const _wishAmount = document.getElementById('wishAmount');
if (_wishName)   _wishName.addEventListener('keydown',   e => { if (e.key === 'Enter') doWishAdd(); });
if (_wishAmount) _wishAmount.addEventListener('keydown', e => { if (e.key === 'Enter') doWishAdd(); });

// ── Add incoming order ────────────────────────────────────────
function doOrdAdd() {
  try {
    const nEl = document.getElementById('ordName');
    const aEl = document.getElementById('ordCost');
    const cEl = document.getElementById('ordCurrency');
    const fEl = document.getElementById('ordFromCat');
    const dEl = document.getElementById('ordArrival');
    if (!nEl || !aEl) return;
    const n    = (nEl.value || '').trim();
    const aRaw = parseFloat(aEl.value);
    if (!n || isNaN(aRaw)) { nEl.focus(); return; }
    const ccy       = cEl ? cEl.value : 'CHF';
    const rate      = exchangeRates[ccy] || 1;
    const amountCHF = aRaw / rate;
    const parsed    = parseFromValue(fEl ? fEl.value : '');
    const arr       = storeGet('incoming_orders') || [];
    arr.push({
      id: 'o_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
      name: n, amount: amountCHF, entered_amount: aRaw, entered_currency: ccy,
      fromCat: parsed.cat || 'bank', fromAccount: parsed.name || null,
      date: dEl && dEl.value ? dEl.value : null,
      ts: Date.now(), deductedAt: null, pctAtDeduction: null, deductedFrom: null
    });
    storeSet('incoming_orders', arr);
    nEl.value = ''; aEl.value = '';
    if (dEl) dEl.value = '';
    updateOrdPreview();
    renderOrders();
  } catch (e) { console.error('ordAdd failed', e); }
}

['ordName','ordCost'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doOrdAdd(); });
});
['ordCost','ordCurrency','ordFromCat'].forEach(id => {
  const el = document.getElementById(id);
  if (el) { el.addEventListener('input', updateOrdPreview); el.addEventListener('change', updateOrdPreview); }
});

// ── Global function refs for inline onclick attributes ────────
window.__addSub   = doSubAdd;
window.__addWish  = doWishAdd;
window.__addOrder = doOrdAdd;

// ── Document-level click delegation (belt-and-suspenders) ─────
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || t.hasAttribute('onclick')) return;
  if (t.id === 'subAddBtn')  { e.preventDefault(); doSubAdd();  }
  if (t.id === 'wishAddBtn') { e.preventDefault(); doWishAdd(); }
  if (t.id === 'ordAddBtn')  { e.preventDefault(); doOrdAdd();  }
});

// ── Initial render ────────────────────────────────────────────
renderAllNetWorth();
renderSubs();
renderWishlist();
renderOrders();
updateOrdPreview();
loadExchangeRates();

// ── Ticker heartbeat ──────────────────────────────────────────
safeRenderTicker();
setInterval(safeRenderTicker, 1500);
