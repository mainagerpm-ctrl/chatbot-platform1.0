/**
 * Chatbot Builder – Universal Embed Widget v3.0
 *
 * <script
 *   src="https://your-server.com/js/widget.js"
 *   data-bot-key="YOUR_BOT_KEY"
 *   data-api-base="https://your-server.com">
 * </script>
 */
(function () {
  'use strict';

  var me = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var BOT_KEY  = me.getAttribute('data-bot-key') || '';
  var API_BASE = (me.getAttribute('data-api-base') || '').replace(/\/$/, '');
  if (!BOT_KEY || !API_BASE) { console.error('[ChatbotBuilder] Missing data-bot-key or data-api-base'); return; }
  if (window._cbbLoaded && window._cbbLoaded[BOT_KEY]) return;
  window._cbbLoaded = window._cbbLoaded || {};
  window._cbbLoaded[BOT_KEY] = true;

  // ── Session ───────────────────────────────────────────────────────────────
  function getSession() {
    var k = 'cbb_s_' + BOT_KEY;
    try { var s = sessionStorage.getItem(k); if (s) return s; var n = 'cbb_' + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(k, n); return n; }
    catch (e) { return 'cbb_' + Math.random().toString(36).slice(2); }
  }
  var sessionId = getSession();

  // ── State ─────────────────────────────────────────────────────────────────
  var isOpen = false, isLoading = false;
  var COLOR = '#6366f1', POS = 'bottom-right', BOT_NAME = 'Assistant', CALENDAR_LINK = '';

  // ── CSS ───────────────────────────────────────────────────────────────────
  function buildCSS() {
    var p = POS.split('-'), v = p[0], h = p[1];
    return [
      '#cbb-w{position:fixed;' + v + ':20px;' + h + ':20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;}',
      '#cbb-btn{width:54px;height:54px;border-radius:50%;background:' + COLOR + ';border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;transition:transform .2s,box-shadow .2s;outline:none;overflow:hidden;padding:0;}',
      '#cbb-btn:hover{transform:scale(1.08);box-shadow:0 6px 26px rgba(0,0,0,.3);}',
      '#cbb-btn img{width:100%;height:100%;object-fit:cover;}',
      '#cbb-box{display:none;flex-direction:column;width:340px;height:490px;background:#fff;border-radius:18px;box-shadow:0 12px 50px rgba(0,0,0,.18);overflow:hidden;margin-' + (h === 'right' ? 'right' : 'left') + ':0;margin-' + v + ':10px;}',
      '#cbb-box.on{display:flex;}',
      '#cbb-head{background:' + COLOR + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}',
      '#cbb-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px;overflow:hidden;flex-shrink:0;}',
      '#cbb-av img{width:100%;height:100%;object-fit:cover;}',
      '#cbb-hname{font-weight:600;font-size:15px;flex:1;}',
      '#cbb-hclose{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;opacity:.8;padding:0;line-height:1;}',
      '#cbb-hclose:hover{opacity:1;}',
      '#cbb-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;}',
      '.cbb-m{max-width:80%;padding:9px 13px;border-radius:14px;line-height:1.5;word-break:break-word;font-size:13.5px;}',
      '.cbb-u{background:' + COLOR + ';color:#fff;align-self:flex-end;border-bottom-right-radius:3px;}',
      '.cbb-a{background:#f3f4f6;color:#1f2937;align-self:flex-start;border-bottom-left-radius:3px;}',
      '.cbb-cal{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:12px;padding:10px 14px;font-size:13px;align-self:flex-start;max-width:90%;}',
      '.cbb-cal a{color:#1d4ed8;font-weight:600;display:block;margin-top:6px;}',
      '#cbb-typing{display:flex;gap:4px;padding:9px 13px;background:#f3f4f6;border-radius:14px;border-bottom-left-radius:3px;align-self:flex-start;}',
      '#cbb-typing span{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:cbbp 1.2s infinite;}',
      '#cbb-typing span:nth-child(2){animation-delay:.2s}#cbb-typing span:nth-child(3){animation-delay:.4s}',
      '@keyframes cbbp{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}',
      '#cbb-foot{padding:10px;border-top:1px solid #e5e7eb;display:flex;gap:8px;flex-shrink:0;}',
      '#cbb-inp{flex:1;border:1px solid #d1d5db;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;font-family:inherit;resize:none;line-height:1.4;max-height:80px;overflow-y:auto;}',
      '#cbb-inp:focus{border-color:' + COLOR + ';}',
      '#cbb-send{width:36px;height:36px;border-radius:50%;background:' + COLOR + ';border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s;}',
      '#cbb-send:disabled{opacity:.4;cursor:default;}',
      '#cbb-pow{text-align:center;font-size:10px;color:#9ca3af;padding:3px 0 6px;flex-shrink:0;}',
    ].join('');
  }

  function injectCSS() {
    var s = document.getElementById('cbb-css');
    if (s) s.remove();
    var el = document.createElement('style'); el.id = 'cbb-css'; el.textContent = buildCSS();
    document.head.appendChild(el);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function buildHTML() {
    var d = document.createElement('div'); d.id = 'cbb-w';
    d.innerHTML = [
      '<div id="cbb-box">',
        '<div id="cbb-head">',
          '<div id="cbb-av">💬</div>',
          '<span id="cbb-hname">' + BOT_NAME + '</span>',
          '<button id="cbb-hclose">×</button>',
        '</div>',
        '<div id="cbb-msgs"></div>',
        '<div id="cbb-foot">',
          '<textarea id="cbb-inp" rows="1" placeholder="Type a message…"></textarea>',
          '<button id="cbb-send"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
        '</div>',
        '<div id="cbb-pow">Powered by Chatbot Builder</div>',
      '</div>',
      '<button id="cbb-btn" title="Chat with us">💬</button>',
    ].join('');
    document.body.appendChild(d);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function addMsg(text, role) {
    var msgs = $('cbb-msgs');
    var el   = document.createElement('div');
    el.className = 'cbb-m ' + (role === 'user' ? 'cbb-u' : 'cbb-a');
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addCalendarCard(link) {
    var msgs = $('cbb-msgs');
    var el   = document.createElement('div');
    el.className = 'cbb-cal';
    el.innerHTML = '📅 Ready to book a time?<a href="' + link + '" target="_blank" rel="noopener">Open Booking Calendar →</a>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    var msgs = $('cbb-msgs');
    var el   = document.createElement('div');
    el.id = 'cbb-typing'; el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() { var t = $('cbb-typing'); if (t) t.remove(); }

  // ── API ───────────────────────────────────────────────────────────────────
  function fetchInfo() {
    fetch(API_BASE + '/embed/' + BOT_KEY + '/info')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.name) { BOT_NAME = data.name; $('cbb-hname').textContent = data.name; }
        if (data.avatar_url) {
          $('cbb-av').innerHTML = '<img src="' + data.avatar_url + '" alt="avatar">';
          $('cbb-btn').innerHTML = '<img src="' + data.avatar_url + '" alt="avatar">';
        }
        if (data.widget_color) {
          COLOR = data.widget_color; injectCSS();
          $('cbb-head').style.background = COLOR;
          $('cbb-btn').style.background  = COLOR;
          $('cbb-send').style.background = COLOR;
        }
        if (data.widget_pos) { POS = data.widget_pos; injectCSS(); }
        if (data.calendar_link) CALENDAR_LINK = data.calendar_link;
        if (data.welcome_msg) addMsg(data.welcome_msg, 'ai');
      })
      .catch(function (e) { console.error('[ChatbotBuilder]', e); });
  }

  function sendMsg(text) {
    isLoading = true; $('cbb-send').disabled = true; showTyping();
    fetch(API_BASE + '/embed/' + BOT_KEY + '/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping(); isLoading = false; $('cbb-send').disabled = false;
        if (data.error) { addMsg('⚠️ ' + data.error, 'ai'); return; }
        addMsg(data.message || '…', 'ai');
        // Show calendar card if link returned and message mentions booking
        if (data.calendar_link && /book|schedul|call|meet|appointment/i.test(data.message || '')) {
          addCalendarCard(data.calendar_link);
        }
      })
      .catch(function () {
        hideTyping(); isLoading = false; $('cbb-send').disabled = false;
        addMsg('⚠️ Connection error. Please try again.', 'ai');
      });
  }

  // Send end signal when widget closes (triggers email)
  function sendEndSignal() {
    var msgs = $('cbb-msgs');
    if (!msgs || msgs.children.length < 2) return;
    fetch(API_BASE + '/embed/' + BOT_KEY + '/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    }).catch(function () {});
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function bindEvents() {
    $('cbb-btn').addEventListener('click', function () {
      isOpen = !isOpen;
      $('cbb-box').classList.toggle('on', isOpen);
      if (!isOpen) sendEndSignal();
      if (isOpen) setTimeout(function () { $('cbb-inp').focus(); }, 80);
    });
    $('cbb-hclose').addEventListener('click', function () {
      isOpen = false; $('cbb-box').classList.remove('on'); sendEndSignal();
    });
    $('cbb-send').addEventListener('click', doSend);
    $('cbb-inp').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
    $('cbb-inp').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; });
    window.addEventListener('beforeunload', sendEndSignal);
  }

  function doSend() {
    if (isLoading) return;
    var inp = $('cbb-inp'), text = inp.value.trim();
    if (!text) return;
    inp.value = ''; inp.style.height = 'auto';
    addMsg(text, 'user'); sendMsg(text);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function init() { injectCSS(); buildHTML(); bindEvents(); fetchInfo(); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

})();
