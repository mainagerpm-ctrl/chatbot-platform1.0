/**
 * Chatbot Builder Platform – Server v3.0
 * Features:
 *  - Avatar image upload per bot
 *  - Document upload for knowledge base (txt, md, csv, json)
 *  - Calendar link integration
 *  - Email notifications after conversations
 *  - Pure Node.js, zero external dependencies
 */

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const urlMod = require('url');

const PORT        = process.env.PORT || 3000;
const DATA_DIR    = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_FILE   = path.join(DATA_DIR, 'bots.json');
const CHATS_FILE  = path.join(DATA_DIR, 'chats.json');
const DOCS_FILE   = path.join(DATA_DIR, 'docs.json');

[DATA_DIR, UPLOADS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
[DATA_FILE, CHATS_FILE, DOCS_FILE].forEach(f => { if (!fs.existsSync(f)) fs.writeFileSync(f, '{}'); });

// ── Helpers ──────────────────────────────────────────────────────────────────
const loadJSON = (f, fb = {}) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const saveJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
const uid = () => crypto.randomBytes(16).toString('hex');

const MIME = {
  '.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=([^\s;]+)/);
    if (!bm) return reject(new Error('No boundary in multipart'));
    const boundary = '--' + bm[1];

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf    = Buffer.concat(chunks);
      const delim  = Buffer.from('\r\n' + boundary);
      const fields = {};
      const files  = {};

      // Split on boundary
      let start = buf.indexOf(boundary) + boundary.length;
      while (start < buf.length) {
        if (buf.slice(start, start + 2).toString() === '--') break;
        start += 2; // skip \r\n after boundary
        const headerEnd = buf.indexOf('\r\n\r\n', start);
        if (headerEnd === -1) break;
        const header  = buf.slice(start, headerEnd).toString();
        let   bodyEnd = buf.indexOf('\r\n' + boundary, headerEnd + 4);
        if (bodyEnd === -1) bodyEnd = buf.length;
        const body    = buf.slice(headerEnd + 4, bodyEnd);

        const nameM = header.match(/name="([^"]+)"/);
        const fileM = header.match(/filename="([^"]+)"/);
        const ctM   = header.match(/Content-Type:\s*(.+)/i);
        if (!nameM) { start = bodyEnd + ('\r\n' + boundary).length; continue; }

        if (fileM) {
          files[nameM[1]] = { filename: fileM[1], contentType: ctM ? ctM[1].trim() : 'application/octet-stream', data: body };
        } else {
          fields[nameM[1]] = body.toString();
        }
        start = bodyEnd + ('\r\n' + boundary).length;
      }
      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const ext  = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
function callOpenAI(apiKey, messages, model, temperature, systemPrompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: model || 'gpt-4o-mini',
      temperature: parseFloat(temperature) || 0.7,
      max_tokens: 1000,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    });
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'Content-Length': Buffer.byteLength(payload) }
    }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => {
        try { const d = JSON.parse(body); if (d.error) return reject(new Error(d.error.message)); resolve(d.choices[0].message.content); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Email via smtp2go (free tier: 1000 emails/month) ─────────────────────────
function sendEmail(to, subject, bodyText, bot) {
  return new Promise((resolve) => {
    if (!bot.smtp_api_key || !to) {
      console.log('📧 [Email not sent – not configured]\nTo:', to, '\nSubject:', subject);
      return resolve(false);
    }
    const payload = JSON.stringify({
      api_key:   bot.smtp_api_key,
      to:        [to],
      sender:    bot.smtp_from || 'chatbot@yourdomain.com',
      subject,
      text_body: bodyText,
    });
    const req = https.request({
      hostname: 'api.smtp2go.com', path: '/v3/email/send', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(false); } });
    });
    req.on('error', e => { console.error('Email error:', e.message); resolve(false); });
    req.write(payload);
    req.end();
  });
}

function buildTranscript(chat, botName, sessionId) {
  const lines = [`Chat Transcript – ${botName}`, '='.repeat(40), ''];
  // Lead info
  const lead = chat.lead || {};
  if (lead.first_name || lead.email) {
    lines.push('CONTACT INFO:');
    if (lead.first_name || lead.last_name) lines.push(`  Name:  ${lead.first_name || ''} ${lead.last_name || ''}`.trim());
    if (lead.email)  lines.push(`  Email: ${lead.email}`);
    if (lead.phone)  lines.push(`  Phone: ${lead.phone}`);
    lines.push('');
  }
  lines.push('CONVERSATION:');
  (chat.messages || []).forEach(m => {
    lines.push(`[${m.role === 'user' ? (lead.first_name || 'Visitor') : botName}]: ${m.content}\n`);
  });
  lines.push('='.repeat(40));
  lines.push(`Session: ${sessionId}`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  return lines.join('\n');
}

// ── Data helpers ─────────────────────────────────────────────────────────────
const getBots   = () => loadJSON(DATA_FILE, {});
const saveBots  = b  => saveJSON(DATA_FILE, b);
const getChats  = () => loadJSON(CHATS_FILE, {});
const saveChats = c  => saveJSON(CHATS_FILE, c);
const getDocs   = () => loadJSON(DOCS_FILE, {});
const saveDocs  = d  => saveJSON(DOCS_FILE, d);
const getBot    = key => Object.values(getBots()).find(b => b.key === key) || null;
const getBotById= id  => getBots()[id] || null;

function safe(bot) {
  if (!bot) return null;
  return { ...bot, api_key: bot.api_key ? '••••' + bot.api_key.slice(-4) : '', smtp_api_key: bot.smtp_api_key ? '••••' : '' };
}

// ── Router ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = urlMod.parse(req.url, true);
  const p      = parsed.pathname;
  const m      = req.method;

  if (m === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type' });
    return res.end();
  }

  // Static
  if (p === '/' || p === '/index.html') return serveStatic(res, path.join(__dirname, 'public', 'index.html'));
  if (p.startsWith('/js/'))      return serveStatic(res, path.join(__dirname, 'public', p));
  if (p.startsWith('/css/'))     return serveStatic(res, path.join(__dirname, 'public', p));
  if (p.startsWith('/uploads/')) return serveStatic(res, path.join(__dirname, p));

  // ── GET /api/bots ────────────────────────────────────────────────────────
  if (p === '/api/bots' && m === 'GET') return json(res, Object.values(getBots()).map(safe));

  // ── POST /api/bots ───────────────────────────────────────────────────────
  if (p === '/api/bots' && m === 'POST') {
    const b = await readBody(req);
    const id = uid(), key = uid();
    const bot = {
      id, key,
      name: b.name || 'My Chatbot', instructions: b.instructions || 'You are a helpful assistant.',
      welcome_msg: b.welcome_msg || 'Hello! How can I help you?', model: b.model || 'gpt-4o-mini',
      temperature: parseFloat(b.temperature) || 0.7, api_key: b.api_key || '',
      avatar_url: '', widget_color: b.widget_color || '#6366f1', widget_pos: b.widget_pos || 'bottom-right',
      allowed_origins: b.allowed_origins || '', bubble_msg: b.bubble_msg || '', quick_replies: b.quick_replies || [], calendar_link: b.calendar_link || '',
      notify_email: b.notify_email || '', smtp_api_key: b.smtp_api_key || '',
      smtp_from: b.smtp_from || '', created_at: new Date().toISOString(),
    };
    const bots = getBots(); bots[id] = bot; saveBots(bots);
    return json(res, safe(bot), 201);
  }

  // ── /api/bots/:id ────────────────────────────────────────────────────────
  const botM = p.match(/^\/api\/bots\/([a-f0-9]{32})$/);
  if (botM && m === 'GET') {
    const bot = getBotById(botM[1]);
    return bot ? json(res, safe(bot)) : json(res, { error: 'Not found' }, 404);
  }
  if (botM && m === 'PUT') {
    const b = await readBody(req);
    const bots = getBots(); const bot = bots[botM[1]];
    if (!bot) return json(res, { error: 'Not found' }, 404);
    const u = {
      ...bot,
      name: b.name ?? bot.name, instructions: b.instructions ?? bot.instructions,
      welcome_msg: b.welcome_msg ?? bot.welcome_msg, model: b.model ?? bot.model,
      temperature: b.temperature !== undefined ? parseFloat(b.temperature) : bot.temperature,
      widget_color: b.widget_color ?? bot.widget_color, widget_pos: b.widget_pos ?? bot.widget_pos,
      allowed_origins: b.allowed_origins ?? bot.allowed_origins, bubble_msg: b.bubble_msg ?? bot.bubble_msg, quick_replies: b.quick_replies !== undefined ? b.quick_replies : (bot.quick_replies || []), calendar_link: b.calendar_link ?? bot.calendar_link,
      notify_email: b.notify_email ?? bot.notify_email, smtp_from: b.smtp_from ?? bot.smtp_from,
      api_key:      (b.api_key      && !b.api_key.startsWith('••••'))  ? b.api_key      : bot.api_key,
      smtp_api_key: (b.smtp_api_key && b.smtp_api_key !== '••••')      ? b.smtp_api_key : bot.smtp_api_key,
    };
    bots[botM[1]] = u; saveBots(bots);
    return json(res, safe(u));
  }
  if (botM && m === 'DELETE') {
    const bots = getBots();
    if (!bots[botM[1]]) return json(res, { error: 'Not found' }, 404);
    delete bots[botM[1]]; saveBots(bots);
    return json(res, { success: true });
  }

  // ── POST /api/bots/:id/avatar ────────────────────────────────────────────
  const avM = p.match(/^\/api\/bots\/([a-f0-9]{32})\/avatar$/);
  if (avM && m === 'POST') {
    try {
      const { files } = await parseMultipart(req);
      const file = files.avatar;
      if (!file) return json(res, { error: 'No file received' }, 400);
      const ext = path.extname(file.filename).toLowerCase();
      if (!['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) return json(res, { error: 'Images only (jpg, png, gif, webp)' }, 400);
      if (file.data.length > 2 * 1024 * 1024) return json(res, { error: 'Max 2MB for avatars' }, 400);
      // Store as base64 data URL inside bots.json so it survives Railway redeploys
      const mimeMap = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp' };
      const dataUrl = 'data:' + mimeMap[ext] + ';base64,' + file.data.toString('base64');
      const bots = getBots();
      if (bots[avM[1]]) { bots[avM[1]].avatar_url = dataUrl; saveBots(bots); }
      return json(res, { url: dataUrl });
    } catch (e) { return json(res, { error: e.message }, 500); }
  }

  // ── POST /api/bots/:id/document ──────────────────────────────────────────
  const docUpM = p.match(/^\/api\/bots\/([a-f0-9]{32})\/document$/);
  if (docUpM && m === 'POST') {
    try {
      const { files } = await parseMultipart(req);
      const file = files.document;
      if (!file) return json(res, { error: 'No file received' }, 400);
      const ext = path.extname(file.filename).toLowerCase();
      if (!['.txt','.md','.csv','.json'].includes(ext)) return json(res, { error: 'Supported: .txt .md .csv .json  (For PDFs: copy/paste the text into a .txt file)' }, 400);
      if (file.data.length > 2 * 1024 * 1024) return json(res, { error: 'Max 2MB' }, 400);
      const text  = file.data.toString('utf8').slice(0, 50000);
      const docId = uid();
      const docs  = getDocs();
      if (!docs[docUpM[1]]) docs[docUpM[1]] = [];
      docs[docUpM[1]].push({ id: docId, name: file.filename, content: text, uploaded_at: new Date().toISOString() });
      saveDocs(docs);
      return json(res, { success: true, id: docId, name: file.filename, chars: text.length });
    } catch (e) { return json(res, { error: e.message }, 500); }
  }

  // ── GET /api/bots/:id/documents ──────────────────────────────────────────
  const docsM = p.match(/^\/api\/bots\/([a-f0-9]{32})\/documents$/);
  if (docsM && m === 'GET') {
    const docs = getDocs();
    return json(res, (docs[docsM[1]] || []).map(d => ({ id: d.id, name: d.name, chars: d.content?.length || 0, uploaded_at: d.uploaded_at })));
  }

  // ── DELETE /api/bots/:botId/documents/:docId ─────────────────────────────
  const docDelM = p.match(/^\/api\/bots\/([a-f0-9]{32})\/documents\/([a-f0-9]{32})$/);
  if (docDelM && m === 'DELETE') {
    const docs = getDocs();
    docs[docDelM[1]] = (docs[docDelM[1]] || []).filter(d => d.id !== docDelM[2]);
    saveDocs(docs);
    return json(res, { success: true });
  }

  // ── GET /api/chats ───────────────────────────────────────────────────────
  if (p === '/api/chats' && m === 'GET') {
    const chats = getChats();
    const list  = Object.entries(chats).map(([id, c]) => ({ session_id: id, ...c }));
    list.sort((a, b) => new Date(b.last_activity || 0) - new Date(a.last_activity || 0));
    return json(res, list.slice(0, 100));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EMBED API — called by the widget on external websites
  // ════════════════════════════════════════════════════════════════════════════

  // ── GET /embed/:key/info ─────────────────────────────────────────────────
  const infoM = p.match(/^\/embed\/([a-f0-9]{32})\/info$/);
  if (infoM && m === 'GET') {
    const bot = getBot(infoM[1]);
    if (!bot) return json(res, { error: 'Bot not found' }, 404);
    return json(res, { name: bot.name, welcome_msg: bot.welcome_msg, avatar_url: bot.avatar_url || '', widget_color: bot.widget_color, widget_pos: bot.widget_pos, calendar_link: bot.calendar_link || '', bubble_msg: bot.bubble_msg || '', quick_replies: bot.quick_replies || [] });
  }

  // ── POST /embed/:key/message ─────────────────────────────────────────────
  const msgM = p.match(/^\/embed\/([a-f0-9]{32})\/message$/);
  if (msgM && m === 'POST') {
    const bot = getBot(msgM[1]);
    if (!bot)         return json(res, { error: 'Bot not found' }, 404);
    if (!bot.api_key) return json(res, { error: 'No API key configured for this chatbot.' }, 500);

    const body      = await readBody(req);
    const userMsg   = (body.message || '').slice(0, 2000);
    const sessionId = body.session_id || uid();
    if (!userMsg)   return json(res, { error: 'No message' }, 400);

    const chats = getChats();
    if (!chats[sessionId]) chats[sessionId] = { bot_key: bot.key, bot_id: bot.id, messages: [], created_at: new Date().toISOString() };

    const history = chats[sessionId].messages;
    history.push({ role: 'user', content: userMsg });
    if (history.length > 20) history.splice(0, history.length - 20);

    // Build system prompt with knowledge docs injected
    let sysPrompt = bot.instructions || 'You are a helpful assistant.';
    const docs    = getDocs();
    const botDocs = docs[bot.id] || [];
    if (botDocs.length) {
      sysPrompt += '\n\n--- KNOWLEDGE BASE ---\n';
      botDocs.forEach(d => { sysPrompt += `\n[${d.name}]:\n${d.content.slice(0, 8000)}\n`; });
      sysPrompt += '\n--- END KNOWLEDGE BASE ---\nUse the knowledge base above to answer accurately.';
    }
    if (bot.calendar_link) {
      sysPrompt += `\n\nIf the user wants to book, schedule, or set up a call or meeting, share this link: ${bot.calendar_link}`;
    }

    try {
      const reply = await callOpenAI(bot.api_key, history, bot.model, bot.temperature, sysPrompt);
      history.push({ role: 'assistant', content: reply });
      chats[sessionId].messages      = history;
      chats[sessionId].last_activity = new Date().toISOString();
      saveChats(chats);

      // Email every 5th message exchange as a mid-conversation update
      if (bot.notify_email && history.length >= 4 && history.length % 10 === 0) {
        const transcript = buildTranscript(chats[sessionId], bot.name, sessionId);
        sendEmail(bot.notify_email, `💬 Ongoing conversation – ${bot.name}`, transcript, bot).catch(console.error);
      }

      return json(res, { message: reply, session_id: sessionId, calendar_link: bot.calendar_link || '' });
    } catch (err) {
      console.error('OpenAI error:', err.message);
      return json(res, { error: 'AI error: ' + err.message }, 500);
    }
  }

  // ── POST /embed/:key/end — fires when user closes the widget ─────────────
  const endM = p.match(/^\/embed\/([a-f0-9]{32})\/end$/);
  if (endM && m === 'POST') {
    const bot = getBot(endM[1]);
    if (!bot) return json(res, { ok: false });
    const body      = await readBody(req);
    const sessionId = body.session_id;
    const chats     = getChats();
    const chat      = chats[sessionId];
    if (chat && bot.notify_email && chat.messages && chat.messages.length >= 2) {
      const transcript = buildTranscript(chat, bot.name, sessionId);
      sendEmail(bot.notify_email, `📋 Chat ended – ${bot.name}`, transcript, bot).catch(console.error);
    }
    return json(res, { ok: true });
  }

  // ── POST /embed/:key/lead — saves lead info to session ─────────────────
  const leadM = p.match(/^\/embed\/([a-f0-9]{32})\/lead$/);
  if (leadM && m === 'POST') {
    const body      = await readBody(req);
    const sessionId = body.session_id;
    const lead      = body.lead || {};
    if (sessionId) {
      const chats = getChats();
      if (!chats[sessionId]) chats[sessionId] = { bot_key: leadM[1], messages: [], created_at: new Date().toISOString() };
      chats[sessionId].lead = lead;
      saveChats(chats);
    }
    return json(res, { ok: true });
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`\n🤖 Chatbot Builder → http://localhost:${PORT}\n`));
