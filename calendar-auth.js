// calendar-auth.js — Google Calendar OAuth + event fetch

const SCOPES     = 'https://www.googleapis.com/auth/calendar.readonly';
const MAX_EVENTS = 15;
const GCal_COLORS = {
  '1':'#7986cb','2':'#33b679','3':'#8e24aa','4':'#e67c73',
  '5':'#f6c026','6':'#f5511d','7':'#039be5','8':'#616161',
  '9':'#3f51b5','10':'#0b8043','11':'#d60000'
};

let tokenClient = null;
let accessToken = sessionStorage.getItem('gcal_token') || null;
let tokenExpiry = parseInt(sessionStorage.getItem('gcal_token_expiry') || '0', 10);

function tokenValid() {
  return !!(accessToken && Date.now() < tokenExpiry);
}

// ── Boot ──────────────────────────────────────────────────────
async function init() {
  const clientId = window.GCAL_CONFIG?.clientId || '';

  if (!clientId) {
    showError('Google Client ID not configured. Paste your client ID into calendar-config.js and redeploy.');
    return;
  }

  await waitForGis();

  if (!window.google?.accounts?.oauth2) {
    showError('Google Identity Services failed to load.');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: onToken
  });

  tokenValid() ? (showEvents(), fetchEvents()) : showSignIn();
}

function waitForGis() {
  return new Promise(resolve => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const iv = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(iv); resolve(); }
    }, 100);
    setTimeout(() => { clearInterval(iv); resolve(); }, 5000);
  });
}

// ── Auth ──────────────────────────────────────────────────────
function onToken(resp) {
  if (resp.error) { showSignIn(); return; }
  accessToken = resp.access_token;
  tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
  sessionStorage.setItem('gcal_token', accessToken);
  sessionStorage.setItem('gcal_token_expiry', String(tokenExpiry));
  showEvents();
  fetchEvents();
}

function signIn()  { tokenClient?.requestAccessToken({ prompt: '' }); }
function signOut() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  tokenExpiry = 0;
  sessionStorage.removeItem('gcal_token');
  sessionStorage.removeItem('gcal_token_expiry');
  showSignIn();
}

// ── Fetch events ──────────────────────────────────────────────
async function fetchEvents() {
  const listEl = document.getElementById('gcalApiList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="gcal-ev-state">Loading…</div>';

  const params = new URLSearchParams({
    maxResults: MAX_EVENTS, orderBy: 'startTime',
    singleEvents: 'true', timeMin: new Date().toISOString()
  });

  let res;
  try {
    res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch {
    listEl.innerHTML = '<div class="gcal-ev-state gcal-ev-error">Network error — try again.</div>';
    return;
  }

  if (res.status === 401) { signOut(); return; }
  const data = await res.json();
  renderEvents(data.items || []);
}

// ── Render ────────────────────────────────────────────────────
function fmtDate(ev) {
  const raw = ev.start?.dateTime || ev.start?.date;
  if (!raw) return '';
  const d = new Date(raw);
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!ev.start?.dateTime) return datePart;
  return datePart + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function renderEvents(items) {
  const listEl = document.getElementById('gcalApiList');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!items.length) {
    listEl.innerHTML = '<div class="gcal-ev-state">No upcoming events</div>';
    return;
  }

  items.forEach(ev => {
    const row  = document.createElement('div');
    row.className = 'gcal-ev-item';

    const dot  = document.createElement('span');
    dot.className = 'gcal-ev-dot';
    dot.style.background = GCal_COLORS[ev.colorId] || '#93c5fd';

    const body  = document.createElement('div');
    body.className = 'gcal-ev-body';

    const title = document.createElement('div');
    title.className = 'gcal-ev-title';
    title.textContent = ev.summary || '(No title)';

    const meta  = document.createElement('div');
    meta.className = 'gcal-ev-meta';
    let m = fmtDate(ev);
    if (ev.location) m += ' · ' + ev.location;
    meta.textContent = m;

    body.append(title, meta);
    row.append(dot, body);
    listEl.appendChild(row);
  });
}

// ── UI state ──────────────────────────────────────────────────
function showSignIn() {
  document.getElementById('gcalApiAuth').hidden    = false;
  document.getElementById('gcalApiEvents').hidden  = true;
  document.getElementById('gcalSignOutPage').hidden = true;
}
function showEvents() {
  document.getElementById('gcalApiAuth').hidden    = true;
  document.getElementById('gcalApiEvents').hidden  = false;
  document.getElementById('gcalSignOutPage').hidden = false;
}
function showError(msg) {
  document.getElementById('gcalApiAuth').hidden = false;
  const e = document.getElementById('gcalAuthError');
  if (e) { e.textContent = msg; e.hidden = false; }
}

window.__gcalSignIn  = signIn;
window.__gcalSignOut = signOut;

init();
