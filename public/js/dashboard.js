/**
 * Chatbot Builder Dashboard v3.0
 */

let bots = [];
let editingBotId = null;
let embedSnippet = '';
let pendingAvatarFile = null;
let currentTab = 'basics';
let quickReplies = []; // [{question:'', options:['']}]

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadBots);

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(name, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  el.classList.add('active');
  if (name === 'chats') loadChats();
}

// ── Tab switching inside modal ────────────────────────────────────────────────
function switchTab(name, el) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  currentTab = name;
  // Load docs if switching to knowledge tab while editing
  if (name === 'knowledge' && editingBotId) loadDocs(editingBotId);
}

// ── Bots ──────────────────────────────────────────────────────────────────────
async function loadBots() {
  try {
    const res = await fetch('/api/bots');
    bots = await res.json();
    renderBots();
  } catch (e) { showToast('Could not connect to server', 'error'); }
}

function renderBots() {
  const c = document.getElementById('bots-container');
  if (!bots.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">🤖</div><div class="empty-title">No chatbots yet</div><div class="empty-sub">Create your first chatbot and embed it anywhere</div><button class="btn btn-primary" onclick="openCreateModal()">Create Your First Chatbot</button></div>`;
    return;
  }
  c.innerHTML = `<div class="bot-grid">${bots.map(botCard).join('')}</div>`;
}

function botCard(bot) {
  const color = bot.widget_color || '#6366f1';
  const tags  = [];
  if (bot.calendar_link) tags.push('<span class="bot-tag green">📅 Calendar</span>');
  if (bot.notify_email)  tags.push('<span class="bot-tag green">📧 Emails</span>');

  const avatar = bot.avatar_url
    ? `<img class="bot-avatar" src="${esc(bot.avatar_url)}" alt="avatar">`
    : `<div class="bot-avatar-placeholder" style="background:${color}20;color:${color}">🤖</div>`;

  return `<div class="bot-card">
    ${avatar}
    <div class="bot-name">${esc(bot.name)}</div>
    <div class="bot-model">${esc(bot.model)} · ${esc(bot.widget_pos)}</div>
    <div class="bot-desc">${esc(bot.instructions)}</div>
    ${tags.length ? `<div class="bot-tags">${tags.join('')}</div>` : ''}
    <div class="bot-actions">
      <button class="btn btn-secondary btn-sm" onclick="openEditModal('${bot.id}')">✏️ Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="openEmbedModal('${bot.id}')">📋 Embed</button>
      <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">🗑️</button>
    </div>
  </div>`;
}

// ── Create modal ──────────────────────────────────────────────────────────────
function openCreateModal() {
  editingBotId = null;
  pendingAvatarFile = null;
  document.getElementById('modal-title').textContent = 'New Chatbot';
  document.getElementById('modal-sub').textContent   = 'Set up your AI chatbot';
  clearForm();
  // Hide knowledge upload (need to save first)
  document.getElementById('knowledge-upload-area').style.display = 'none';
  document.getElementById('knowledge-save-first').style.display  = 'block';
  // Load quick replies
  quickReplies = bot.quick_replies ? JSON.parse(JSON.stringify(bot.quick_replies)) : [];
  renderQuickReplies();

  switchTabByName('basics');
  document.getElementById('bot-modal').classList.add('open');
}

function switchTabByName(name) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    const tabs = ['basics','appearance','knowledge','calendar','email'];
    if (tabs[i] === name) b.classList.add('active'); else b.classList.remove('active');
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

// ── Edit modal ────────────────────────────────────────────────────────────────
async function openEditModal(id) {
  const bot = bots.find(b => b.id === id);
  if (!bot) return;
  editingBotId = id;
  pendingAvatarFile = null;

  document.getElementById('modal-title').textContent = 'Edit Chatbot';
  document.getElementById('modal-sub').textContent   = bot.name;

  document.getElementById('f-name').value          = bot.name;
  document.getElementById('f-instructions').value  = bot.instructions;
  document.getElementById('f-welcome').value        = bot.welcome_msg;
  document.getElementById('f-apikey').value         = '';
  document.getElementById('f-apikey').placeholder   = 'Leave blank to keep existing key';
  document.getElementById('f-model').value          = bot.model;
  document.getElementById('f-temp').value           = bot.temperature;
  document.getElementById('temp-val').textContent   = bot.temperature;
  document.getElementById('f-color').value          = bot.widget_color;
  document.getElementById('f-pos').value            = bot.widget_pos;
  document.getElementById('f-origins').value        = bot.allowed_origins || '';
  document.getElementById('f-bubble').value         = bot.bubble_msg       || '';
  document.getElementById('f-calendar').value       = bot.calendar_link   || '';
  document.getElementById('f-notify-email').value   = bot.notify_email    || '';
  document.getElementById('f-smtp-key').value       = '';
  document.getElementById('f-smtp-key').placeholder = bot.smtp_api_key ? 'Leave blank to keep existing' : 'api-XXXXXXXXXX';
  document.getElementById('f-smtp-from').value      = bot.smtp_from || '';

  // Avatar preview
  if (bot.avatar_url) {
    document.getElementById('avatar-preview').src     = bot.avatar_url;
    document.getElementById('avatar-preview').style.display = 'block';
    document.getElementById('avatar-placeholder').style.display = 'none';
  } else {
    document.getElementById('avatar-preview').style.display = 'none';
    document.getElementById('avatar-placeholder').style.display = 'flex';
  }

  // Show knowledge upload area
  document.getElementById('knowledge-upload-area').style.display = 'block';
  document.getElementById('knowledge-save-first').style.display  = 'none';
  await loadDocs(id);

  // Load quick replies
  quickReplies = bot.quick_replies ? JSON.parse(JSON.stringify(bot.quick_replies)) : [];
  renderQuickReplies();

  switchTabByName('basics');
  document.getElementById('bot-modal').classList.add('open');
}

function clearForm() {
  ['f-name','f-instructions','f-welcome','f-apikey','f-origins','f-calendar','f-notify-email','f-smtp-key','f-smtp-from'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-apikey').placeholder = 'sk-…';
  document.getElementById('f-smtp-key').placeholder = 'api-XXXXXXXXXX';
  document.getElementById('f-model').value = 'gpt-4o-mini';
  document.getElementById('f-temp').value  = '0.7';
  document.getElementById('temp-val').textContent = '0.7';
  document.getElementById('f-color').value  = '#6366f1';
  document.getElementById('f-pos').value    = 'bottom-right';
  document.getElementById('f-bubble').value = '';
  quickReplies = [];
  renderQuickReplies();
  document.getElementById('avatar-preview').style.display = 'none';
  document.getElementById('avatar-placeholder').style.display = 'flex';
  document.getElementById('docs-list').innerHTML = '';
}

// ── Save bot ──────────────────────────────────────────────────────────────────
async function saveBot() {
  const name   = document.getElementById('f-name').value.trim();
  const apikey = document.getElementById('f-apikey').value.trim();
  if (!name)               return showToast('Please enter a bot name', 'error');
  if (!editingBotId && !apikey) return showToast('Please enter your OpenAI API key', 'error');

  const btn = document.getElementById('save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const payload = {
    name,
    instructions:    document.getElementById('f-instructions').value.trim() || 'You are a helpful assistant.',
    welcome_msg:     document.getElementById('f-welcome').value.trim()       || 'Hello! How can I help you?',
    api_key:         apikey,
    model:           document.getElementById('f-model').value,
    temperature:     parseFloat(document.getElementById('f-temp').value),
    widget_color:    document.getElementById('f-color').value,
    widget_pos:      document.getElementById('f-pos').value,
    allowed_origins: document.getElementById('f-origins').value.trim(),
    bubble_msg:      document.getElementById('f-bubble').value.trim(),
    quick_replies:   quickReplies.filter(qr => qr.question.trim() && qr.options.filter(o=>o.trim()).length > 0),
    calendar_link:   document.getElementById('f-calendar').value.trim(),
    notify_email:    document.getElementById('f-notify-email').value.trim(),
    smtp_api_key:    document.getElementById('f-smtp-key').value.trim(),
    smtp_from:       document.getElementById('f-smtp-from').value.trim(),
  };

  try {
    const url = editingBotId ? `/api/bots/${editingBotId}` : '/api/bots';
    const res = await fetch(url, { method: editingBotId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    const saved = await res.json();

    // Upload avatar if pending
    if (pendingAvatarFile) {
      const fd = new FormData();
      fd.append('avatar', pendingAvatarFile);
      await fetch(`/api/bots/${saved.id}/avatar`, { method: 'POST', body: fd });
      pendingAvatarFile = null;
    }

    closeModal();
    await loadBots();
    showToast(editingBotId ? '✅ Chatbot updated!' : '✅ Chatbot created!', 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save Chatbot';
  }
}

async function deleteBot(id) {
  const bot = bots.find(b => b.id === id);
  if (!confirm(`Delete "${bot?.name}"? This cannot be undone.`)) return;
  await fetch(`/api/bots/${id}`, { method: 'DELETE' });
  await loadBots();
  showToast('🗑️ Chatbot deleted');
}

function closeModal() { document.getElementById('bot-modal').classList.remove('open'); editingBotId = null; }
function closeModalOnOverlay(e) { if (e.target === e.currentTarget) closeModal(); }
function closeEmbedModalOnOverlay(e) { if (e.target === e.currentTarget) document.getElementById('embed-modal').classList.remove('open'); }

// ── Avatar upload ─────────────────────────────────────────────────────────────
function handleAvatarPreview(input) {
  const file = input.files[0];
  if (!file) return;
  pendingAvatarFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('avatar-preview').src = e.target.result;
    document.getElementById('avatar-preview').style.display = 'block';
    document.getElementById('avatar-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ── Document upload ───────────────────────────────────────────────────────────
async function handleDocUpload(input) {
  if (!editingBotId) return;
  const file = input.files[0];
  if (!file) return;

  showToast('Uploading document…');
  const fd = new FormData();
  fd.append('document', file);

  try {
    const res  = await fetch(`/api/bots/${editingBotId}/document`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Upload failed', 'error');
    showToast(`✅ "${data.name}" uploaded (${Math.round(data.chars/100)/10}k chars)`, 'success');
    input.value = '';
    await loadDocs(editingBotId);
  } catch (e) { showToast('Upload error: ' + e.message, 'error'); }
}

async function loadDocs(botId) {
  try {
    const res  = await fetch(`/api/bots/${botId}/documents`);
    const docs = await res.json();
    renderDocs(docs, botId);
  } catch { document.getElementById('docs-list').innerHTML = ''; }
}

function renderDocs(docs, botId) {
  const el = document.getElementById('docs-list');
  if (!docs.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:12px 0;">No documents uploaded yet</p>'; return; }
  el.innerHTML = docs.map(d => `
    <div class="doc-item">
      <div class="doc-icon">📄</div>
      <div style="flex:1;">
        <div class="doc-name">${esc(d.name)}</div>
        <div class="doc-meta">${Math.round(d.chars/100)/10}k characters · ${new Date(d.uploaded_at).toLocaleDateString()}</div>
      </div>
      <button class="doc-del" onclick="deleteDoc('${botId}','${d.id}','${esc(d.name)}')" title="Remove">✕</button>
    </div>`).join('');
}

async function deleteDoc(botId, docId, name) {
  if (!confirm(`Remove "${name}" from knowledge base?`)) return;
  await fetch(`/api/bots/${botId}/documents/${docId}`, { method: 'DELETE' });
  await loadDocs(botId);
  showToast('Document removed');
}

// ── Embed modal ───────────────────────────────────────────────────────────────
function openEmbedModal(id) {
  const bot    = bots.find(b => b.id === id);
  if (!bot) return;
  const origin = window.location.origin;
  embedSnippet = `<script\n  src="${origin}/js/widget.js"\n  data-bot-key="${bot.key}"\n  data-api-base="${origin}"\n><\/script>`;
  document.getElementById('embed-code-display').textContent = embedSnippet;
  document.getElementById('embed-modal').classList.add('open');
}

function copyEmbed() {
  navigator.clipboard.writeText(embedSnippet)
    .then(() => showToast('📋 Snippet copied!', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = embedSnippet;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      showToast('📋 Snippet copied!', 'success');
    });
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function loadChats() {
  const c = document.getElementById('chats-container');
  c.innerHTML = '<p style="color:var(--muted);font-size:14px;">Loading…</p>';
  try {
    const res   = await fetch('/api/chats');
    const chats = await res.json();
    if (!chats.length) {
      c.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">No conversations yet</div><div class="empty-sub">Conversations will appear here once visitors start chatting</div></div>`;
      return;
    }
    c.innerHTML = `<div class="chats-list">${chats.map(chatRow).join('')}</div>`;
  } catch { c.innerHTML = '<p style="color:var(--muted);">Could not load conversations.</p>'; }
}

function chatRow(chat) {
  const bot   = bots.find(b => b.key === chat.bot_key);
  const color = bot?.widget_color || '#6366f1';
  const msgs  = chat.messages || [];
  const last  = msgs[msgs.length - 1];
  const time  = chat.last_activity ? new Date(chat.last_activity).toLocaleString() : '—';
  const lead  = chat.lead || {};
  const name  = lead.first_name ? `${lead.first_name} ${lead.last_name || ''}`.trim() : '';
  const leadBadge = name ? `<span style="font-size:11px;background:#f0fdf4;color:#065f46;border:1px solid #bbf7d0;border-radius:20px;padding:2px 8px;margin-left:6px;">${esc(name)}</span>` : '';
  const emailBadge = lead.email ? `<span style="font-size:11px;color:var(--muted);margin-left:4px;">${esc(lead.email)}</span>` : '';
  return `<div class="chat-row">
    <div class="chat-dot" style="background:${color}"></div>
    <div class="chat-meta">
      <div class="chat-bot">${esc(bot?.name || 'Unknown bot')}${leadBadge}${emailBadge}</div>
      <div class="chat-preview">${esc((last?.content || '(no messages)').slice(0,120))}</div>
    </div>
    <div class="chat-count">${msgs.length} msg${msgs.length !== 1 ? 's' : ''}</div>
    <div class="chat-time">${time}</div>
  </div>`;
}

// ── Quick Replies ────────────────────────────────────────────────────────────
function addQuickReply() {
  quickReplies.push({ question: '', options: ['', ''] });
  renderQuickReplies();
  // Focus the new question input
  const inputs = document.querySelectorAll('.qr-q');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeQuickReply(idx) {
  quickReplies.splice(idx, 1);
  renderQuickReplies();
}

function addOption(qrIdx) {
  quickReplies[qrIdx].options.push('');
  renderQuickReplies();
  // Focus the new option
  const blocks = document.querySelectorAll('.qr-options');
  if (blocks[qrIdx]) {
    const inputs = blocks[qrIdx].querySelectorAll('.qr-opt-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }
}

function removeOption(qrIdx, optIdx) {
  quickReplies[qrIdx].options.splice(optIdx, 1);
  renderQuickReplies();
}

function renderQuickReplies() {
  const el = document.getElementById('qr-list');
  if (!el) return;
  if (!quickReplies.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0;">No quick replies yet. Click the button below to add one.</p>';
    return;
  }
  el.innerHTML = quickReplies.map((qr, qi) => `
    <div class="qr-block">
      <div class="qr-block-header">
        <span style="font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap;">Question ${qi + 1}</span>
        <input class="qr-q" type="text" placeholder="e.g. What would you like to do?" value="${esc(qr.question)}"
          oninput="quickReplies[${qi}].question=this.value">
        <button class="qr-del-block" onclick="removeQuickReply(${qi})" title="Remove">✕</button>
      </div>
      <div class="qr-options" id="qr-opts-${qi}">
        ${qr.options.map((opt, oi) => `
          <div class="qr-opt-row">
            <span style="font-size:11px;color:var(--muted);width:16px;text-align:right;flex-shrink:0;">${oi+1}</span>
            <input class="qr-opt-input" type="text" placeholder="e.g. Get a quote" value="${esc(opt)}"
              oninput="quickReplies[${qi}].options[${oi}]=this.value">
            <button class="qr-del-opt" onclick="removeOption(${qi},${oi})" title="Remove option">✕</button>
          </div>`).join('')}
      </div>
      <button class="qr-add-opt" onclick="addOption(${qi})">＋ Add option</button>
    </div>`).join('');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3200);
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
