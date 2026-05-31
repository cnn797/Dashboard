// calendar.js — state, rendering, event wiring

const CAL_KEY = 'cal:events';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function storeGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

let viewYear  = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selected  = todayStr();

function getEvents() { return storeGet(CAL_KEY) || {}; }

// ── Calendar grid ──
function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  const grid  = document.getElementById('calDays');
  if (!label || !grid) return;

  label.textContent = MONTHS[viewMonth] + ' ' + viewYear;
  grid.innerHTML = '';

  const events   = getEvents();
  const today    = todayStr();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset   = (firstDay + 6) % 7; // Mon = 0
  const total    = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day cal-day-empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= total; d++) {
    const dateStr = viewYear + '-' + String(viewMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (dateStr === today)     cell.classList.add('cal-day-today');
    if (dateStr === selected)  cell.classList.add('cal-day-selected');

    const num = document.createElement('span');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if ((events[dateStr] || []).length) {
      const dot = document.createElement('span');
      dot.className = 'cal-day-dot';
      cell.appendChild(dot);
    }

    cell.addEventListener('click', () => {
      selected = dateStr;
      renderCalendar();
      renderDayPanel();
    });
    grid.appendChild(cell);
  }
}

// ── Day panel ──
function renderDayPanel() {
  const titleEl = document.getElementById('calDayTitle');
  const listEl  = document.getElementById('calEventsList');
  if (!titleEl || !listEl) return;

  const [y, m, d] = selected.split('-').map(Number);
  titleEl.textContent = DAYS_LONG[new Date(y, m-1, d).getDay()] + ', ' + MONTHS[m-1] + ' ' + d;

  const events    = getEvents();
  const dayEvents = (events[selected] || []).slice().sort((a, b) => (a.time||'').localeCompare(b.time||''));

  listEl.innerHTML = '';
  if (!dayEvents.length) {
    const empty = document.createElement('div');
    empty.className = 'cal-events-empty';
    empty.textContent = 'No events';
    listEl.appendChild(empty);
    return;
  }

  dayEvents.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'cal-event-item';

    const info = document.createElement('div');
    info.className = 'cal-event-info';

    if (ev.time) {
      const t = document.createElement('span');
      t.className = 'cal-event-time';
      t.textContent = ev.time;
      info.appendChild(t);
    }

    const name = document.createElement('span');
    name.className = 'cal-event-name';
    name.textContent = ev.name;
    info.appendChild(name);

    const del = document.createElement('button');
    del.className = 'cal-event-del';
    del.textContent = '×';
    del.addEventListener('click', () => {
      const all = getEvents();
      all[selected] = (all[selected] || []).filter(e => e.id !== ev.id);
      if (!all[selected].length) delete all[selected];
      storeSet(CAL_KEY, all);
      renderCalendar();
      renderDayPanel();
    });

    item.appendChild(info);
    item.appendChild(del);
    listEl.appendChild(item);
  });
}

// ── Add event ──
function doAdd() {
  const nameEl = document.getElementById('calEventName');
  const timeEl = document.getElementById('calEventTime');
  if (!nameEl) return;
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }

  const all = getEvents();
  if (!all[selected]) all[selected] = [];
  all[selected].push({
    id:   'e_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    name,
    time: timeEl ? timeEl.value : ''
  });
  storeSet(CAL_KEY, all);
  nameEl.value = '';
  if (timeEl) timeEl.value = '';
  renderCalendar();
  renderDayPanel();
}

// ── Event wiring ──
document.getElementById('calPrev').addEventListener('click', () => {
  if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', () => {
  if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});
document.getElementById('calAddBtn').addEventListener('click', doAdd);
document.getElementById('calEventName').addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

// ── Boot ──
renderCalendar();
renderDayPanel();
