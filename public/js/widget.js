/**
 * Chatbot Builder – Universal Embed Widget v3.1
 * Branding: Mainager.io
 * Features: lead capture form, avatar, calendar, email triggers
 */
(function () {
  'use strict';

  var me = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var BOT_KEY  = me.getAttribute('data-bot-key') || '';
  var API_BASE = (me.getAttribute('data-api-base') || '').replace(/\/$/, '');
  if (!BOT_KEY || !API_BASE) { console.error('[Mainager] Missing data-bot-key or data-api-base'); return; }
  if (window._cbbLoaded && window._cbbLoaded[BOT_KEY]) return;
  window._cbbLoaded = window._cbbLoaded || {};
  window._cbbLoaded[BOT_KEY] = true;

  // ── Session ───────────────────────────────────────────────────────────────
  function getSession() {
    var k = 'cbb_s_' + BOT_KEY;
    try {
      var s = sessionStorage.getItem(k);
      if (s) return s;
      var n = 'cbb_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(k, n);
      return n;
    } catch (e) { return 'cbb_' + Math.random().toString(36).slice(2); }
  }
  var sessionId = getSession();

  // ── State ─────────────────────────────────────────────────────────────────
  var isOpen = false, isLoading = false, formDone = false;
  var COLOR = '#6366f1', POS = 'bottom-right', BOT_NAME = 'Assistant', CALENDAR_LINK = '', BUBBLE_MSG = '';
  var QUICK_REPLIES = []; // [{question:'', options:['']}]
  var currentQRIndex = 0;
  var leadData = {};

  // Check if lead form already completed this session
  try { if (sessionStorage.getItem('cbb_lead_' + BOT_KEY)) { formDone = true; leadData = JSON.parse(sessionStorage.getItem('cbb_lead_' + BOT_KEY)); } } catch(e) {}

  // ── CSS ───────────────────────────────────────────────────────────────────
  function buildCSS() {
    var parts = POS.split('-'), v = parts[0], h = parts[1];
    return [
      '#cbb-w{position:fixed;' + v + ':20px;' + h + ':20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;}',
      '#cbb-btn{width:54px;height:54px;border-radius:50%;background:' + COLOR + ';border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;transition:transform .2s,box-shadow .2s;outline:none;overflow:hidden;padding:0;}',
      '#cbb-btn:hover{transform:scale(1.08);box-shadow:0 6px 26px rgba(0,0,0,.3);}',
      '#cbb-btn img{width:100%;height:100%;object-fit:cover;}',
      '#cbb-box{display:none;flex-direction:column;width:340px;background:#fff;border-radius:18px;box-shadow:0 12px 50px rgba(0,0,0,.18);overflow:hidden;margin-' + (h === 'right' ? 'right' : 'left') + ':0;margin-' + v + ':10px;}',
      '#cbb-box.on{display:flex;}',
      '#cbb-head{background:' + COLOR + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}',
      '#cbb-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px;overflow:hidden;flex-shrink:0;}',
      '#cbb-av img{width:100%;height:100%;object-fit:cover;}',
      '#cbb-hname{font-weight:600;font-size:15px;flex:1;}',
      '#cbb-hclose{background:none;border:none;color:#fff;cursor:pointer;font-size:22px;opacity:.8;padding:0;line-height:1;display:flex;align-items:center;}',
      '#cbb-hclose:hover{opacity:1;}',

      /* Lead form */
      '#cbb-lead{padding:20px;flex-shrink:0;}',
      '#cbb-lead-title{font-weight:600;font-size:14px;margin-bottom:4px;color:#111;}',
      '#cbb-lead-sub{font-size:12px;color:#6b7280;margin-bottom:14px;}',
      '.cbb-field{margin-bottom:10px;}',
      '.cbb-field label{display:block;font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;}',
      '.cbb-field input{width:100%;padding:8px 11px;border:1px solid #d1d5db;border-radius:9px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;color:#111;background:#fff;}',
      '.cbb-field input:focus{border-color:' + COLOR + ';box-shadow:0 0 0 3px ' + COLOR + '22;}',
      '.cbb-field input::placeholder{color:#9ca3af;}',
      '#cbb-lead-submit{width:100%;padding:10px;background:' + COLOR + ';color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;font-family:inherit;transition:opacity .15s;}',
      '#cbb-lead-submit:hover{opacity:.9;}',
      '#cbb-lead-err{font-size:12px;color:#ef4444;margin-top:6px;display:none;}',

      /* Chat area */
      '#cbb-chat{display:flex;flex-direction:column;height:440px;}',
      '#cbb-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;}',
      '.cbb-m{max-width:82%;padding:9px 13px;border-radius:14px;line-height:1.5;word-break:break-word;font-size:13.5px;}',
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
      '#cbb-pow a{color:#9ca3af;text-decoration:none;}',
      '#cbb-pow a:hover{color:#6b7280;text-decoration:underline;}',
      /* Quick reply buttons */
      '#cbb-qr{padding:8px 14px 10px;border-top:1px solid #f3f4f6;flex-shrink:0;}',
      '#cbb-qr-q{font-size:12px;color:#6b7280;margin-bottom:7px;}',
      '#cbb-qr-opts{display:flex;flex-wrap:wrap;gap:6px;}',
      '.cbb-qr-btn{background:#fff;border:1.5px solid ' + COLOR + ';color:' + COLOR + ';border-radius:20px;padding:6px 14px;font-size:12.5px;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}',
      '.cbb-qr-btn:hover{background:' + COLOR + ';color:#fff;}',
      /* Bubble message above button */
      '#cbb-bubble{position:absolute;bottom:64px;right:0;background:#fff;color:#111;border-radius:14px 14px 4px 14px;padding:10px 14px;font-size:13px;line-height:1.4;box-shadow:0 4px 18px rgba(0,0,0,.15);white-space:nowrap;max-width:240px;white-space:normal;cursor:pointer;border:1px solid #e5e7eb;}',
      '#cbb-bubble::after{content:"";position:absolute;bottom:-7px;right:18px;width:12px;height:12px;background:#fff;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;transform:rotate(45deg);}',
      '#cbb-bubble-close{position:absolute;top:5px;right:8px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:14px;line-height:1;padding:0;}',
      '#cbb-bubble-close:hover{color:#374151;}',
      '#cbb-bubble.hidden{display:none;}',
    ].join('');
  }

  function injectCSS() {
    var s = document.getElementById('cbb-css');
    if (s) s.remove();
    var el = document.createElement('style');
    el.id = 'cbb-css';
    el.textContent = buildCSS();
    document.head.appendChild(el);
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  function buildHTML() {
    var d = document.createElement('div');
    d.id = 'cbb-w';
    d.innerHTML = [
      '<div id="cbb-box">',
        '<div id="cbb-head">',
          '<div id="cbb-av">💬</div>',
          '<span id="cbb-hname">' + BOT_NAME + '</span>',
          '<button id="cbb-hclose">×</button>',
        '</div>',

        // Lead capture form (shown before chat)
        '<div id="cbb-lead" style="' + (formDone ? 'display:none' : '') + '">',
          '<div id="cbb-lead-title">Before we chat…</div>',
          '<div id="cbb-lead-sub">Just a few details so we can follow up with you.</div>',
          '<div class="cbb-field"><label>First Name *</label><input type="text" id="cbb-fn" placeholder="Jane" autocomplete="given-name"></div>',
          '<div class="cbb-field"><label>Last Name *</label><input type="text" id="cbb-ln" placeholder="Smith" autocomplete="family-name"></div>',
          '<div class="cbb-field"><label>Email *</label><input type="email" id="cbb-em" placeholder="jane@example.com" autocomplete="email"></div>',
          '<div class="cbb-field"><label>Phone <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input type="tel" id="cbb-ph" placeholder="+1 555 000 0000" autocomplete="tel"></div>',
          '<button id="cbb-lead-submit">Start Chat →</button>',
          '<div id="cbb-lead-err"></div>',
        '</div>',

        // Chat area (hidden until form done)
        '<div id="cbb-chat" style="' + (formDone ? '' : 'display:none') + '">',
          '<div id="cbb-msgs"></div>',
          '<div id="cbb-qr" style="display:none"><div id="cbb-qr-q"></div><div id="cbb-qr-opts"></div></div>',
        '<div id="cbb-foot">',
            '<textarea id="cbb-inp" rows="1" placeholder="Type a message…"></textarea>',
            '<button id="cbb-send"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
          '</div>',
          '<div id="cbb-pow">Powered by <a href="https://mainager.io" target="_blank" rel="noopener">Mainager.io</a></div>',
        '</div>',

      '</div>',
      '<div id="cbb-bubble" class="hidden" onclick="document.getElementById(\'cbb-btn\').click();this.classList.add(\'hidden\')"><button id="cbb-bubble-close" onclick="event.stopPropagation();this.parentElement.classList.add(\'hidden\')">✕</button><span id="cbb-bubble-text"></span></div>',
      '<button id="cbb-btn" title="Chat with us">💬</button>',
    ].join('');
    document.body.appendChild(d);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function addMsg(text, role) {
    var msgs = $('cbb-msgs');
    var el = document.createElement('div');
    el.className = 'cbb-m ' + (role === 'user' ? 'cbb-u' : 'cbb-a');
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addCalendarCard(link) {
    var msgs = $('cbb-msgs');
    var el = document.createElement('div');
    el.className = 'cbb-cal';
    el.innerHTML = '📅 Ready to book a time?<a href="' + link + '" target="_blank" rel="noopener">Open Booking Calendar →</a>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    var msgs = $('cbb-msgs');
    var el = document.createElement('div');
    el.id = 'cbb-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() { var t = $('cbb-typing'); if (t) t.remove(); }

  // ── Lead form submission ──────────────────────────────────────────────────
  function submitLeadForm() {
    var fn = ($('cbb-fn').value || '').trim();
    var ln = ($('cbb-ln').value || '').trim();
    var em = ($('cbb-em').value || '').trim();
    var ph = ($('cbb-ph').value || '').trim();
    var err = $('cbb-lead-err');

    if (!fn) { showErr('Please enter your first name.'); return; }
    if (!ln) { showErr('Please enter your last name.'); return; }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showErr('Please enter a valid email address.'); return; }

    err.style.display = 'none';
    leadData = { first_name: fn, last_name: ln, email: em, phone: ph };

    // Save to session so form doesn't reappear if they close & reopen
    try { sessionStorage.setItem('cbb_lead_' + BOT_KEY, JSON.stringify(leadData)); } catch(e) {}

    formDone = true;

    // Send lead data to server so it's attached to the session
    fetch(API_BASE + '/embed/' + BOT_KEY + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, lead: leadData })
    }).catch(function() {});

    // Show chat, hide form
    $('cbb-lead').style.display = 'none';
    $('cbb-chat').style.display = 'flex';

    // Personalise welcome message
    if (leadData.first_name) {
      addMsg('Hi ' + leadData.first_name + '! ' + (window._cbbWelcome || 'How can I help you today?'), 'ai');
    }
    if (QUICK_REPLIES.length) showQuickReply(0);

    setTimeout(function() { $('cbb-inp').focus(); }, 80);
  }

  function showErr(msg) {
    var err = $('cbb-lead-err');
    err.textContent = msg;
    err.style.display = 'block';
  }

  // ── Bot info ──────────────────────────────────────────────────────────────
  function fetchInfo() {
    fetch(API_BASE + '/embed/' + BOT_KEY + '/info')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.name) { BOT_NAME = data.name; $('cbb-hname').textContent = data.name; }
        if (data.avatar_url) {
          $('cbb-av').innerHTML = '<img src="' + data.avatar_url + '" alt="avatar">';
          $('cbb-btn').innerHTML = '<img src="' + data.avatar_url + '" alt="avatar">';
        }
        if (data.widget_color) {
          COLOR = data.widget_color; injectCSS();
          $('cbb-head').style.background = COLOR;
          $('cbb-btn').style.background  = COLOR;
          if ($('cbb-send')) $('cbb-send').style.background = COLOR;
        }
        if (data.widget_pos) { POS = data.widget_pos; injectCSS(); }
        if (data.calendar_link) CALENDAR_LINK = data.calendar_link;
        if (data.quick_replies && data.quick_replies.length) {
          QUICK_REPLIES = data.quick_replies;
        }
        if (data.bubble_msg) {
          BUBBLE_MSG = data.bubble_msg;
          var bub = $('cbb-bubble');
          if (bub && !isOpen) {
            $('cbb-bubble-text').textContent = BUBBLE_MSG;
            setTimeout(function() { if (!isOpen) bub.classList.remove('hidden'); }, 3000);
          }
        }

        // Store welcome message for personalisation after lead form
        window._cbbWelcome = data.welcome_msg || 'How can I help you today?';

        // If form already done, show welcome directly
        if (formDone && data.welcome_msg) {
          addMsg('Hi ' + leadData.first_name + '! ' + data.welcome_msg, 'ai');
          if (QUICK_REPLIES.length) showQuickReply(0);
        }
      })
      .catch(function(e) { console.error('[Mainager]', e); });
  }

  // ── Quick Replies ────────────────────────────────────────────────────────
  function showQuickReply(idx) {
    if (!QUICK_REPLIES[idx]) { hideQuickReply(); return; }
    currentQRIndex = idx;
    var qr = QUICK_REPLIES[idx];
    var qrEl = $('cbb-qr');
    var qEl  = $('cbb-qr-q');
    var opts = $('cbb-qr-opts');
    if (!qrEl || !qEl || !opts) return;
    qEl.textContent = qr.question;
    opts.innerHTML = '';
    qr.options.filter(function(o) { return o.trim(); }).forEach(function(o) {
      var btn = document.createElement('button');
      btn.className = 'cbb-qr-btn';
      btn.textContent = o;
      btn.setAttribute('data-val', o);
      opts.appendChild(btn);
    });
    opts.querySelectorAll('.cbb-qr-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { pickOption(this.getAttribute('data-val')); });
    });
        qrEl.style.display = 'block';
  }

  function hideQuickReply() {
    var qrEl = $('cbb-qr');
    if (qrEl) qrEl.style.display = 'none';
  }

  function pickOption(text) {
    hideQuickReply();
    addMsg(text, 'user');
    sendMsg(text);
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Send message ──────────────────────────────────────────────────────────
  function sendMsg(text) {
    isLoading = true;
    $('cbb-send').disabled = true;
    showTyping();
    fetch(API_BASE + '/embed/' + BOT_KEY + '/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId, lead: leadData })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        hideTyping(); isLoading = false; $('cbb-send').disabled = false;
        if (data.error) { addMsg('⚠️ ' + data.error, 'ai'); return; }
        addMsg(data.message || '…', 'ai');
        if (data.calendar_link && /book|schedul|call|meet|appointment/i.test(data.message || '')) {
          addCalendarCard(data.calendar_link);
        }
      })
      .catch(function() {
        hideTyping(); isLoading = false; $('cbb-send').disabled = false;
        addMsg('⚠️ Connection error. Please try again.', 'ai');
      });
  }

  // ── End signal (triggers email) ───────────────────────────────────────────
  function sendEndSignal() {
    var msgs = $('cbb-msgs');
    if (!msgs || msgs.children.length < 2) return;
    fetch(API_BASE + '/embed/' + BOT_KEY + '/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, lead: leadData })
    }).catch(function() {});
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function bindEvents() {
    $('cbb-btn').addEventListener('click', function() {
      isOpen = !isOpen;
      $('cbb-box').classList.toggle('on', isOpen);
      if (isOpen) { var bub = $('cbb-bubble'); if (bub) bub.classList.add('hidden'); }
      if (!isOpen) sendEndSignal();
      if (isOpen && formDone) setTimeout(function() { $('cbb-inp').focus(); }, 80);
      if (isOpen && !formDone) setTimeout(function() { $('cbb-fn').focus(); }, 80);
    });

    $('cbb-hclose').addEventListener('click', function() {
      isOpen = false; $('cbb-box').classList.remove('on'); sendEndSignal();
    });

    $('cbb-lead-submit').addEventListener('click', submitLeadForm);

    // Allow Enter on last required field to submit
    [$('cbb-fn'), $('cbb-ln'), $('cbb-em'), $('cbb-ph')].forEach(function(inp) {
      if (!inp) return;
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); submitLeadForm(); } });
    });

    $('cbb-send').addEventListener('click', doSend);
    $('cbb-inp').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    $('cbb-inp').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });

    window.addEventListener('beforeunload', sendEndSignal);
  }

  function doSend() {
    if (isLoading) return;
    var inp = $('cbb-inp'), text = inp.value.trim();
    if (!text) return;
    inp.value = ''; inp.style.height = 'auto';
    hideQuickReply();
    addMsg(text, 'user'); sendMsg(text);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function init() { injectCSS(); buildHTML(); bindEvents(); fetchInfo(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
