// ============================================================
// outreach.js — Outreach Tracker page logic
// ============================================================

const CONTACTS_KEY  = 'outreach_contacts';
const TEMPLATES_KEY = 'outreach_templates';
const META_KEY      = 'outreach_meta';

const STATUS_ORDER  = ['not-sent', 'sent', 'replied', 'call-booked', 'completed'];
const STATUS_LABELS = {
  'not-sent':    'Not sent',
  'sent':        'Sent',
  'replied':     'Replied',
  'call-booked': 'Call booked',
  'completed':   'Completed'
};
const STATUS_COLORS = {
  'not-sent':    '#76746E',
  'sent':        '#93C5FD',
  'replied':     '#F2C063',
  'call-booked': '#B794F4',
  'completed':   '#6BE3A4'
};
const NEXT_ACTIONS = {
  'not-sent':    'Send your first message →',
  'sent':        'Follow up if no reply in 3–5 days →',
  'replied':     'Book a call or keep the conversation going →',
  'call-booked': 'Prepare for the call →',
  'completed':   null
};
const TOAST_MESSAGES = [
  'Great move — keep the momentum going!',
  "One step closer. You're building something real.",
  'Nice. Consistency is everything.',
  "That's how it's done. What's next?",
  'Progress made. Keep showing up.',
  'Every message is a door. You just opened one.',
  'Solid. The best networkers are just the most consistent ones.'
];

// ── Storage helpers ───────────────────────────────────────────
function orGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch { return null; }
}
function orSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Supabase stubs (future integration) ──────────────────────
function _pushToSupabase(data) { /* TODO */ }
function _pullFromSupabase()   { /* TODO */ }

// ── Escape HTML ───────────────────────────────────────────────
function orEsc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── Avatar initials ───────────────────────────────────────────
function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── ID generators ─────────────────────────────────────────────
function nextCid() { return 'c_' + Date.now() + '_' + Math.floor(Math.random() * 9999); }
function nextTid() { return 't_' + Date.now() + '_' + Math.floor(Math.random() * 9999); }

// ── Pre-load default data ─────────────────────────────────────
function preloadIfEmpty() {
  const today = new Date().toISOString().slice(0, 10);

  const contacts = orGet(CONTACTS_KEY);
  if (!contacts || !contacts.length) {
    orSet(CONTACTS_KEY, [
      { id: 'c_pre_1', name: 'Andres Chico Hernandez', company: '',
        source: 'NU Alumni Portal — Batch 1', background: '',
        date: today, status: 'not-sent', notes: '' },
      { id: 'c_pre_2', name: 'Anna Kan', company: '',
        source: 'NU Alumni Portal — Batch 1', background: '',
        date: today, status: 'not-sent', notes: '' },
      { id: 'c_pre_3', name: 'Akshat Ghiya', company: '',
        source: 'NU Alumni Portal — Batch 1', background: '',
        date: today, status: 'not-sent', notes: '' }
    ]);
  }

  const templates = orGet(TEMPLATES_KEY);
  if (!templates || !templates.length) {
    orSet(TEMPLATES_KEY, [
      {
        id: 't_pre_1',
        name: 'NU Alumni — Standard outreach',
        context: 'NU Alumni Portal',
        subject: 'Quick question from a Northwestern student',
        body: 'Hi [NAME],\n\nI came across your profile through the Northwestern alumni network and wanted to reach out. [HOOK]\n\nI\'d love to learn more about your experience — would you be open to a quick 15-minute chat?\n\nThanks so much,\nChristoph',
        notes: ''
      },
      {
        id: 't_pre_2',
        name: 'NU Alumni — Alum-to-alum',
        context: 'NU Alumni Portal',
        subject: 'Quick question from a fellow Northwestern alum',
        body: 'Hi [NAME],\n\nFellow Wildcat here — I found your profile through the alumni network and wanted to connect. [HOOK]\n\nWould love to grab 15 minutes to hear about your path. Let me know if you\'d be open to a quick chat!\n\nBest,\nChristoph',
        notes: ''
      }
    ]);
  }
}

// ── Streak ────────────────────────────────────────────────────
function recordAction() {
  const meta  = orGet(META_KEY) || {};
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (meta.lastActionDate === today) return;
  meta.streak = (meta.lastActionDate === yest) ? (meta.streak || 0) + 1 : 1;
  meta.lastActionDate = today;
  orSet(META_KEY, meta);
}

function getStreak() {
  const meta  = orGet(META_KEY) || {};
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (meta.lastActionDate !== today && meta.lastActionDate !== yest) return 0;
  return meta.streak || 0;
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('orToast');
  if (!el) return;
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  el.textContent = msg;
  el.classList.remove('or-toast-in');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('or-toast-in');
      _toastTimer = setTimeout(() => {
        el.classList.remove('or-toast-in');
      }, 3500);
    });
  });
}
function randomToast() {
  showToast(TOAST_MESSAGES[Math.floor(Math.random() * TOAST_MESSAGES.length)]);
}

// ── Source filter ─────────────────────────────────────────────
function populateSourceFilter() {
  const sel = document.getElementById('filterSource');
  if (!sel) return;
  const prev     = sel.value;
  const contacts = orGet(CONTACTS_KEY) || [];
  const sources  = [...new Set(contacts.map(c => c.source || '').filter(Boolean))].sort();
  sel.innerHTML  = '<option value="">All sources</option>'
    + sources.map(s => '<option value="' + orEsc(s) + '"' + (s === prev ? ' selected' : '') + '>'
      + orEsc(s) + '</option>').join('');
}

// ── Metrics ───────────────────────────────────────────────────
function renderMetrics() {
  const all     = orGet(CONTACTS_KEY) || [];
  const total   = all.length;
  const sent    = all.filter(c => STATUS_ORDER.indexOf(c.status) >= 1).length;
  const replies = all.filter(c => STATUS_ORDER.indexOf(c.status) >= 2).length;
  const streak  = getStreak();
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('metricTotal',   total);
  s('metricSent',    sent);
  s('metricReplies', replies);
  s('metricStreak',  streak);
}

// ── Pipeline ──────────────────────────────────────────────────
function renderPipeline() {
  const fill   = document.getElementById('pipelineFill');
  const stages = document.getElementById('pipelineStages');
  if (!stages) return;

  const all    = orGet(CONTACTS_KEY) || [];
  const total  = all.length;
  const counts = {};
  STATUS_ORDER.forEach(s => { counts[s] = 0; });
  all.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });

  if (fill) {
    const pct = total > 0 ? ((total - (counts['not-sent'] || 0)) / total * 100) : 0;
    fill.style.width = Math.min(100, pct).toFixed(1) + '%';
  }

  let html = '';
  STATUS_ORDER.forEach((s, i) => {
    html += '<div class="or-stage">'
      + '<span class="or-stage-num" style="color:' + STATUS_COLORS[s] + '">' + (counts[s] || 0) + '</span>'
      + '<span class="or-stage-label">' + orEsc(STATUS_LABELS[s]) + '</span>'
      + '</div>';
    if (i < STATUS_ORDER.length - 1)
      html += '<span class="or-stage-arrow">›</span>';
  });
  stages.innerHTML = html;
}

// ── Contact card builder ──────────────────────────────────────
function buildContactCard(c) {
  const statusIdx  = STATUS_ORDER.indexOf(c.status);
  const nextStatus = STATUS_ORDER[statusIdx + 1];
  const nextAction = NEXT_ACTIONS[c.status];
  const isDone     = c.status === 'completed';
  const color      = STATUS_COLORS[c.status] || '#76746E';
  const wrapId     = 'nw_' + c.id;

  return '<div class="or-contact-card" data-id="' + c.id + '">'
    + '<div class="or-avatar" style="background:' + color + '22;color:' + color + ';border-color:' + color + '55">'
    +   orEsc(getInitials(c.name))
    + '</div>'
    + '<div class="or-card-body">'
    +   '<div class="or-card-header">'
    +     '<div>'
    +       '<div class="or-card-name">' + orEsc(c.name) + '</div>'
    +       (c.company ? '<div class="or-card-company">' + orEsc(c.company) + '</div>' : '')
    +     '</div>'
    +     (c.source ? '<span class="or-source-tag">' + orEsc(c.source) + '</span>' : '')
    +   '</div>'
    +   (c.background ? '<div class="or-card-bg">' + orEsc(c.background) + '</div>' : '')
    +   '<div class="or-card-status-row">'
    +     (c.date ? '<span class="or-date">' + orEsc(c.date) + '</span>' : '')
    +     '<span class="or-status-badge" style="background:' + color + '22;color:' + color + ';border-color:' + color + '55">'
    +       STATUS_LABELS[c.status]
    +     '</span>'
    +     (isDone
          ? '<span class="or-done-badge">Done</span>'
          : '<button class="or-advance-btn" data-action="advance" data-next="' + nextStatus + '">→ ' + STATUS_LABELS[nextStatus] + '</button>')
    +   '</div>'
    +   (nextAction && !isDone
        ? '<div class="or-next-action">' + orEsc(nextAction) + '</div>'
        : '')
    +   '<button class="or-notes-toggle" data-wrap="' + wrapId + '">Notes</button>'
    +   '<div class="or-notes-wrap hidden" id="' + wrapId + '" style="margin-top:8px">'
    +     '<textarea class="or-notes-area" placeholder="Add notes...">' + orEsc(c.notes || '') + '</textarea>'
    +     '<div style="display:flex;justify-content:flex-end;margin-top:6px">'
    +       '<button class="or-btn-ghost" data-action="save-notes">Save notes</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="or-card-actions">'
    +     '<button class="or-btn-ghost" data-action="edit">Edit</button>'
    +     '<button class="or-btn-ghost or-btn-danger" data-action="delete">Delete</button>'
    +   '</div>'
    + '</div>'
    + '</div>';
}

// ── Contact list render ───────────────────────────────────────
function renderContacts() {
  const list = document.getElementById('contactList');
  if (!list) return;

  populateSourceFilter();

  const all = orGet(CONTACTS_KEY) || [];
  const srcFilter = (document.getElementById('filterSource') || {}).value || '';
  const stFilter  = (document.getElementById('filterStatus') || {}).value || '';

  const filtered = all.filter(c => {
    if (srcFilter && c.source !== srcFilter) return false;
    if (stFilter  && c.status !== stFilter)  return false;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="or-empty">'
      + (all.length ? 'No contacts match this filter.' : 'No contacts yet. Add your first one!')
      + '</div>';
    return;
  }

  list.innerHTML = filtered.map(c => buildContactCard(c)).join('');

  list.querySelectorAll('.or-notes-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = document.getElementById(btn.dataset.wrap);
      if (!wrap) return;
      const hidden = wrap.classList.contains('hidden');
      wrap.classList.toggle('hidden', !hidden);
      btn.textContent = hidden ? 'Hide notes' : 'Notes';
    });
  });

  list.querySelectorAll('[data-action="advance"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.closest('.or-contact-card').dataset.id;
      const next = btn.dataset.next;
      if (!next) return;
      const all2 = orGet(CONTACTS_KEY) || [];
      const idx  = all2.findIndex(x => x.id === id);
      if (idx < 0) return;
      all2[idx].status = next;
      orSet(CONTACTS_KEY, all2);
      recordAction();
      randomToast();
      renderAll();
    });
  });

  list.querySelectorAll('[data-action="save-notes"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card  = btn.closest('.or-contact-card');
      const id    = card.dataset.id;
      const textarea = btn.closest('.or-notes-wrap').querySelector('.or-notes-area');
      const all2  = orGet(CONTACTS_KEY) || [];
      const idx   = all2.findIndex(x => x.id === id);
      if (idx < 0) return;
      all2[idx].notes = textarea.value;
      orSet(CONTACTS_KEY, all2);
      showToast('Notes saved.');
    });
  });

  list.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openContactModal(btn.closest('.or-contact-card').dataset.id);
    });
  });

  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.closest('.or-contact-card').dataset.id;
      const all2 = orGet(CONTACTS_KEY) || [];
      const c    = all2.find(x => x.id === id);
      if (!c) return;
      if (!confirm('Delete "' + c.name + '"?')) return;
      orSet(CONTACTS_KEY, all2.filter(x => x.id !== id));
      renderAll();
    });
  });
}

// ── Placeholder highlighter ───────────────────────────────────
function highlightPlaceholders(text) {
  return orEsc(text).replace(/\[([A-Z_]+)\]/g,
    '<span class="or-placeholder">[$1]</span>'
  );
}

// ── Template list render ──────────────────────────────────────
function renderTemplates() {
  const list = document.getElementById('templateList');
  if (!list) return;
  const all = orGet(TEMPLATES_KEY) || [];

  if (!all.length) {
    list.innerHTML = '<div class="or-empty">No templates yet.</div>';
    return;
  }

  list.innerHTML = all.map(t =>
    '<div class="card or-tpl-card" data-tid="' + t.id + '">'
    + '<div class="or-tpl-head">'
    +   '<div>'
    +     '<div class="or-tpl-name">' + orEsc(t.name) + '</div>'
    +     (t.context ? '<div style="font-size:11px;color:var(--text-quaternary);margin-top:2px">' + orEsc(t.context) + '</div>' : '')
    +   '</div>'
    +   '<div class="or-tpl-btns">'
    +     '<button class="or-btn-copy" data-action="copy">Copy</button>'
    +     '<button class="or-btn-ghost" data-action="edit-tpl">Edit</button>'
    +     '<button class="or-btn-ghost or-btn-danger" data-action="del-tpl">Delete</button>'
    +   '</div>'
    + '</div>'
    + (t.subject ? '<div class="or-tpl-subject">Subject: ' + orEsc(t.subject) + '</div>' : '')
    + '<div class="or-tpl-body">' + highlightPlaceholders(t.body) + '</div>'
    + (t.notes ? '<div class="or-tpl-notes">' + orEsc(t.notes) + '</div>' : '')
    + '</div>'
  ).join('');

  list.querySelectorAll('[data-action="copy"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.closest('.or-tpl-card').dataset.tid;
      const tpl = (orGet(TEMPLATES_KEY) || []).find(x => x.id === tid);
      if (!tpl) return;
      const text = (tpl.subject ? 'Subject: ' + tpl.subject + '\n\n' : '') + tpl.body;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Template copied to clipboard!');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }).catch(() => showToast('Copy failed — select the text manually.'));
    });
  });

  list.querySelectorAll('[data-action="edit-tpl"]').forEach(btn => {
    btn.addEventListener('click', () => {
      openTemplateModal(btn.closest('.or-tpl-card').dataset.tid);
    });
  });

  list.querySelectorAll('[data-action="del-tpl"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid  = btn.closest('.or-tpl-card').dataset.tid;
      const all2 = orGet(TEMPLATES_KEY) || [];
      const t    = all2.find(x => x.id === tid);
      if (!t) return;
      if (!confirm('Delete template "' + t.name + '"?')) return;
      orSet(TEMPLATES_KEY, all2.filter(x => x.id !== tid));
      renderTemplates();
    });
  });
}

// ── Intention restore ─────────────────────────────────────────
function renderIntention() {
  const meta  = orGet(META_KEY) || {};
  const today = new Date().toISOString().slice(0, 10);
  const el    = document.getElementById('intentionText');
  if (el && meta.intentionSet === today && meta.intention)
    el.value = meta.intention;
}

// ── Master render ─────────────────────────────────────────────
function renderAll() {
  renderMetrics();
  renderPipeline();
  renderContacts();
}

// ── Contact modal ─────────────────────────────────────────────
let _editContactId = null;

function openContactModal(id) {
  _editContactId = id || null;
  const titleEl = document.getElementById('contactModalTitle');
  if (id) {
    const c = (orGet(CONTACTS_KEY) || []).find(x => x.id === id);
    if (!c) return;
    if (titleEl) titleEl.textContent = 'Edit Contact';
    document.getElementById('cName').value       = c.name       || '';
    document.getElementById('cCompany').value    = c.company    || '';
    document.getElementById('cSource').value     = c.source     || '';
    document.getElementById('cBackground').value = c.background || '';
    document.getElementById('cDate').value       = c.date       || '';
    document.getElementById('cStatus').value     = c.status     || 'not-sent';
    document.getElementById('cNotes').value      = c.notes      || '';
  } else {
    if (titleEl) titleEl.textContent = 'Add Contact';
    document.getElementById('cName').value       = '';
    document.getElementById('cCompany').value    = '';
    document.getElementById('cSource').value     = '';
    document.getElementById('cBackground').value = '';
    document.getElementById('cDate').value       = new Date().toISOString().slice(0, 10);
    document.getElementById('cStatus').value     = 'not-sent';
    document.getElementById('cNotes').value      = '';
  }
  document.getElementById('contactModal').classList.add('show');
  document.getElementById('cName').focus();
}

function saveContact() {
  const name = (document.getElementById('cName').value || '').trim();
  if (!name) { document.getElementById('cName').focus(); return; }
  const rec = {
    name,
    company:    (document.getElementById('cCompany').value    || '').trim(),
    source:     (document.getElementById('cSource').value     || '').trim(),
    background: (document.getElementById('cBackground').value || '').trim(),
    date:       document.getElementById('cDate').value        || new Date().toISOString().slice(0, 10),
    status:     document.getElementById('cStatus').value      || 'not-sent',
    notes:      (document.getElementById('cNotes').value      || '').trim()
  };
  const all = orGet(CONTACTS_KEY) || [];
  if (_editContactId) {
    const idx = all.findIndex(x => x.id === _editContactId);
    if (idx >= 0) all[idx] = { ...all[idx], ...rec };
  } else {
    all.push({ id: nextCid(), ...rec });
  }
  orSet(CONTACTS_KEY, all);
  closeModal('contactModal');
  renderAll();
}

// ── Template modal ────────────────────────────────────────────
let _editTemplateId = null;

function openTemplateModal(id) {
  _editTemplateId = id || null;
  const titleEl = document.getElementById('templateModalTitle');
  if (id) {
    const t = (orGet(TEMPLATES_KEY) || []).find(x => x.id === id);
    if (!t) return;
    if (titleEl) titleEl.textContent = 'Edit Template';
    document.getElementById('tName').value    = t.name    || '';
    document.getElementById('tContext').value = t.context || '';
    document.getElementById('tSubject').value = t.subject || '';
    document.getElementById('tBody').value    = t.body    || '';
    document.getElementById('tNotes').value   = t.notes   || '';
  } else {
    if (titleEl) titleEl.textContent = 'Add Template';
    ['tName', 'tContext', 'tSubject', 'tBody', 'tNotes'].forEach(elId => {
      document.getElementById(elId).value = '';
    });
  }
  document.getElementById('templateModal').classList.add('show');
  document.getElementById('tName').focus();
}

function saveTemplate() {
  const name = (document.getElementById('tName').value || '').trim();
  if (!name) { document.getElementById('tName').focus(); return; }
  const rec = {
    name,
    context: (document.getElementById('tContext').value || '').trim(),
    subject: (document.getElementById('tSubject').value || '').trim(),
    body:    (document.getElementById('tBody').value    || '').trim(),
    notes:   (document.getElementById('tNotes').value   || '').trim()
  };
  const all = orGet(TEMPLATES_KEY) || [];
  if (_editTemplateId) {
    const idx = all.findIndex(x => x.id === _editTemplateId);
    if (idx >= 0) all[idx] = { ...all[idx], ...rec };
  } else {
    all.push({ id: nextTid(), ...rec });
  }
  orSet(TEMPLATES_KEY, all);
  closeModal('templateModal');
  renderTemplates();
}

// ── Modal helpers ─────────────────────────────────────────────
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ── Tabs ──────────────────────────────────────────────────────
function setTab(name) {
  document.querySelectorAll('.or-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.or-tab-pane').forEach(p => {
    if (p.id === 'pane-' + name) p.removeAttribute('hidden');
    else p.setAttribute('hidden', '');
  });
  if (name === 'templates') renderTemplates();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  preloadIfEmpty();
  renderIntention();
  renderAll();

  // Tabs
  document.querySelectorAll('.or-tab').forEach(t => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
  });

  // Intention save
  const intentionSaveBtn = document.getElementById('intentionSaveBtn');
  if (intentionSaveBtn) {
    intentionSaveBtn.addEventListener('click', () => {
      const text = (document.getElementById('intentionText').value || '').trim();
      const meta = orGet(META_KEY) || {};
      meta.intention    = text;
      meta.intentionSet = new Date().toISOString().slice(0, 10);
      orSet(META_KEY, meta);
      showToast("Intention set. Let's go!");
    });
  }

  // Add contact
  const addContactBtn = document.getElementById('addContactBtn');
  if (addContactBtn) addContactBtn.addEventListener('click', () => openContactModal(null));

  // Add template
  const addTplBtn = document.getElementById('addTemplateBtn');
  if (addTplBtn) addTplBtn.addEventListener('click', () => openTemplateModal(null));

  // Filters
  ['filterSource', 'filterStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderContacts);
  });

  // Contact modal save
  const cSave = document.getElementById('contactModalSave');
  if (cSave) cSave.addEventListener('click', saveContact);

  // Template modal save
  const tSave = document.getElementById('templateModalSave');
  if (tSave) tSave.addEventListener('click', saveTemplate);

  // Modal close buttons (× and Cancel)
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Click backdrop to close
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('show'); });
  });

  // Enter key in contact modal name/company fields
  ['cName', 'cCompany', 'cSource'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') saveContact(); });
  });
}

init();
