// ============================================================
// finance-data.js — constants, shared state, storage, pure helpers
// Loaded first. No DOM access at parse time.
// ============================================================

// ── Constants ────────────────────────────────────────────────
const TAB_KEY         = 'finance_active_tab';
const CURRENCY_KEY    = 'nw_currency';
const ACTIVITY_KEY    = 'nw:activity';
const NW_HISTORY_KEY  = 'nw:history';
const NW_HISTORY_MAX  = 500;
const ACTIVITY_MAX    = 50;

// Hoisted here because renderOrders runs inside the first renderAllNetWorth
// call, which fires before the orders section wiring in finance.js.
const ORD_FROM_META = {
  bank:   { name: 'Bank',   color: '#7DD3FC' },
  stocks: { name: 'Stocks', color: '#6EE7B7' },
  crypto: { name: 'Crypto', color: '#FBBF24' },
  other:  { name: 'Other',  color: '#B794F4' }
};

const NW_CATS = [
  { key: 'bank',   listId: 'bankList',   totalId: 'bankTotal',   nameId: 'bankName',   amtId: 'bankAmount',   addId: 'bankAddBtn' },
  { key: 'stocks', listId: 'stocksList', totalId: 'stocksTotal', nameId: 'stocksName', amtId: 'stocksAmount', addId: 'stocksAddBtn' },
  { key: 'crypto', listId: 'cryptoList', totalId: 'cryptoTotal', nameId: 'cryptoName', amtId: 'cryptoAmount', addId: 'cryptoAddBtn' },
  { key: 'other',  listId: 'otherList',  totalId: 'otherTotal',  nameId: 'otherName',  amtId: 'otherAmount',  addId: 'otherAddBtn' }
];

const NW_SLICE_META = {
  bank:   { name: 'Bank',    color: '#7DD3FC' },
  stocks: { name: 'Stocks',  color: '#6EE7B7' },
  crypto: { name: 'Crypto',  color: '#FBBF24' },
  other:  { name: 'Other',   color: '#B794F4' },
  subs:   { name: 'Subs/yr', color: '#FF8A8A' }
};

// ── Shared mutable state ─────────────────────────────────────
let exchangeRates = { CHF: 1, USD: 1, EUR: 1, GBP: 1 };

// ── Storage helpers ──────────────────────────────────────────
function storeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) { return null; }
}

function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// ── Pure helpers ─────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtMoney(amountCHF) {
  const currencyEl = document.getElementById('netWorthCurrency');
  const symbol = currencyEl ? currencyEl.value : 'CHF';
  const rate = exchangeRates[symbol] || 1;
  const num = (Number(amountCHF) || 0) * rate;
  return symbol + ' ' + num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function monthlyEquivalent(item) {
  const a = Number(item.amount) || 0;
  if (item.period === 'yearly') return a / 12;
  if (item.period === 'weekly') return a * 4.345;
  return a;
}

function nwGrandCHF() {
  let g = 0;
  NW_CATS.forEach(cat => {
    const items = storeGet('nw:' + cat.key) || [];
    items.forEach(it => { g += Number(it.amount) || 0; });
  });
  return g;
}

function listAllNwAccounts() {
  const out = [];
  NW_CATS.forEach(cat => {
    const items = storeGet('nw:' + cat.key) || [];
    items.forEach((it, idx) => {
      out.push({
        catKey:    cat.key,
        itemIdx:   idx,
        itemName:  String(it.name || ''),
        amountCHF: Number(it.amount) || 0
      });
    });
  });
  return out;
}

function nextRenewalDate(isoDate, period) {
  const isoSafe = (typeof isoDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoDate))
    ? isoDate + 'T00:00' : isoDate;
  let d = new Date(isoSafe);
  if (isNaN(d)) return null;
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let safety  = 0;
  while (d < today && safety++ < 600) {
    if (period === 'weekly')      d.setDate(d.getDate() + 7);
    else if (period === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else                          d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// ── Activity log ─────────────────────────────────────────────
function logActivity(catKey, name, deltaCHF, kind) {
  const arr = storeGet(ACTIVITY_KEY) || [];
  arr.push({
    ts:    Date.now(),
    cat:   catKey,
    name:  String(name || ''),
    delta: Number(deltaCHF) || 0,
    kind:  kind || 'add'
  });
  if (arr.length > ACTIVITY_MAX) arr.splice(0, arr.length - ACTIVITY_MAX);
  storeSet(ACTIVITY_KEY, arr);
}

// ── Net-worth history snapshot ────────────────────────────────
function logNetWorthSnapshot(grandCHF) {
  const v    = Number(grandCHF) || 0;
  const hist = storeGet(NW_HISTORY_KEY) || [];
  const last = hist[hist.length - 1];
  if (last && Math.abs((last.v || 0) - v) < 0.005) return;
  hist.push({ t: Date.now(), v });
  if (hist.length > NW_HISTORY_MAX) hist.splice(0, hist.length - NW_HISTORY_MAX);
  storeSet(NW_HISTORY_KEY, hist);
}

// ── Exchange rates ────────────────────────────────────────────
async function loadExchangeRates() {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/CHF');
    const data = await res.json();
    if (data && data.rates) {
      exchangeRates = {
        CHF: 1,
        USD: data.rates.USD || 1,
        EUR: data.rates.EUR || 1,
        GBP: data.rates.GBP || 1
      };
      renderAllNetWorth();
      renderSubs();
    }
  } catch (e) {}
}
