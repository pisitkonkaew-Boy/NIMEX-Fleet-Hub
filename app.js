/* NIMEX Fleet Hub — system cards, 3×3 slots per group, admin style switch (A/B) */
(function () {
  var ICONS = {
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
    coin: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    gauge: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13l4-4"/><circle cx="12" cy="13" r="1.3"/>',
    fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"/><path d="M4 20h11"/><path d="M7 8h5"/><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeoff: '<path d="M4 4l16 16"/><path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.7 3.4M6.3 7.6A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  };
  function ic(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }

  var G = window.HUB_GROUPS, S = window.HUB_SYSTEMS, BASE = window.HUB_BASE, API = window.HUB_API || '';
  var SLOTS = window.HUB_SLOTS || 9;
  var STYLES = { a: 'Navy Classic', b: 'Command Night' };
  var admin = /(^|#)admin\b/.test(location.hash);
  var state = { group: 'all', q: '', style: 'a', hidden: null };

  /* ---------- hidden systems (shared, set by admin) ---------- */
  function defaultHidden() { return S.filter(function (s) { return s.hidden; }).map(function (s) { return s.id; }); }
  function setHidden(list) { state.hidden = {}; (list || []).forEach(function (id) { state.hidden[id] = 1; }); }
  function hiddenList() { return Object.keys(state.hidden); }
  function isHidden(s) { return !!state.hidden[s.id]; }
  function visible(s) { return admin || !isHidden(s); }

  function href(s) { return BASE + s.repo + '/' + (admin ? '#admin' : ''); }

  /* ---------- toast ---------- */
  var tt;
  function toast(msg, bad) {
    var t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(tt); tt = setTimeout(function () { t.className = 'toast'; }, 3800);
  }

  /* ---------- theme (light/dark, per viewer) ---------- */
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    var dark = state.style === 'b' || (t ? t === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches);
    $('themeBtn').innerHTML = ic(dark ? 'sun' : 'moon');
    $('themeBtn').setAttribute('aria-label', dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด');
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    var nx = cur === 'dark' ? 'light' : 'dark';
    ls('nimex-hub-theme', nx); applyTheme(nx);
  }

  /* ---------- style A/B (shared, set by admin) ---------- */
  function applyStyle(st) {
    if (!STYLES[st]) st = 'a';
    state.style = st;
    document.body.classList.remove('sa', 'sb'); document.body.classList.add('s' + st);
    $('themeBtn').hidden = st === 'b';          /* B เป็นโทนมืดในตัว ไม่ต้องสลับ */
    [].forEach.call(document.querySelectorAll('#styleSw button'), function (b) { b.classList.toggle('on', b.dataset.s === st); b.setAttribute('aria-pressed', b.dataset.s === st); });
    applyTheme(ls('nimex-hub-theme'));
  }
  function loadShared() {
    if (!API) return;
    fetch(API + '?v=' + window.HUB_V + '&t=' + Math.floor(Date.now() / 60000)).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.settings && d.settings.style && !/[?&]style=/.test(location.search)) { ls('nimex-hub-style', d.settings.style); applyStyle(d.settings.style); }
      if (d && d.settings && Array.isArray(d.settings.hidden)) { ls('nimex-hub-hidden', JSON.stringify(d.settings.hidden)); setHidden(d.settings.hidden); renderAll(); }
    }).catch(function () {});
  }
  function post(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  /* ---------- admin login (key kept only in this tab's sessionStorage) ---------- */
  function getKey() {
    var k = ss('nimex-admin-key');
    if (k) return Promise.resolve(k);
    return new Promise(function (res, rej) {
      var m = $('login'), inp = $('pw'), msg = $('pwMsg');
      m.hidden = false; inp.value = ''; msg.textContent = ''; setTimeout(function () { inp.focus(); }, 30);
      function done(ok, val) { m.hidden = true; $('pwForm').onsubmit = null; $('pwCancel').onclick = null; ok ? res(val) : rej('cancel'); }
      $('pwCancel').onclick = function () { done(false); };
      $('pwForm').onsubmit = function (e) {
        e.preventDefault(); var v = inp.value; if (!v) return;
        msg.textContent = 'กำลังตรวจรหัส…';
        post({ a: 'auth', key: v }).then(function (d) {
          if (d && d.ok) { ss('nimex-admin-key', v); done(true, v); }
          else msg.textContent = d && d.error === 'admin_key_not_set' ? 'ยังไม่ได้ตั้ง ADMIN_KEY ใน Apps Script' : 'รหัสไม่ถูกต้อง';
        }).catch(function () { msg.textContent = 'เชื่อมต่อระบบข้อมูลไม่ได้ ลองใหม่อีกครั้ง'; });
      };
    });
  }
  /* save to the Hub sheet; onFail undoes the change on screen */
  function save(settings, okMsg, onFail) {
    if (!API) { toast(okMsg.replace('ผู้ชมทุกคน', 'เครื่องนี้') + ' (Hub ยังไม่ได้เชื่อม Google Sheet)'); return Promise.resolve(true); }
    return getKey().then(function (key) {
      return post({ a: 'settings', key: key, settings: settings }).then(function (d) {
        if (d && d.ok) { toast(okMsg); return true; }
        if (d && d.error === 'denied') ss('nimex-admin-key', null);
        onFail(); toast('บันทึกไม่สำเร็จ' + (d && d.error === 'denied' ? ' รหัสไม่ถูกต้อง' : ''), true); return false;
      });
    }).catch(function (e) { onFail(); if (e !== 'cancel') toast('เชื่อมต่อระบบข้อมูลไม่ได้', true); return false; });
  }
  function toggleHidden(id) {
    var before = hiddenList();
    if (state.hidden[id]) delete state.hidden[id]; else state.hidden[id] = 1;
    var now = hiddenList(), sys = S.filter(function (s) { return s.id === id; })[0];
    ls('nimex-hub-hidden', JSON.stringify(now)); renderAll();
    save({ hidden: now }, (state.hidden[id] ? 'ซ่อน ' : 'แสดง ') + sys.name + ' แล้ว ผู้ชมทุกคนเห็นตามนี้',
      function () { setHidden(before); ls('nimex-hub-hidden', JSON.stringify(before)); renderAll(); });
  }
  function chooseStyle(st) {
    if (st === state.style) return;
    var prev = state.style;
    applyStyle(st);
    ls('nimex-hub-style', st);
    save({ style: st }, 'บันทึกแล้ว ผู้ชมทุกคนจะเห็นแบบ ' + STYLES[st], function () { ls('nimex-hub-style', prev); applyStyle(prev); });
  }

  /* ---------- rail + tabs + segment ---------- */
  function renderNav() {
    var r = '<div class="plate"><img src="logo.png" alt="NIMEX"></div>';
    r += '<a href="#" data-g="all" class="on">' + ic('home') + 'หน้าหลัก</a>';
    G.forEach(function (g) {
      r += '<div class="sec">' + esc(g.name) + '</div>';
      S.filter(function (s) { return s.group === g.id && visible(s); }).forEach(function (s) {
        r += '<a href="' + href(s) + '"' + (isHidden(s) ? ' class="off" title="ซ่อนจากผู้ชม"' : '') + '>' + ic(s.icon) + esc(s.name) + '</a>';
      });
    });
    r += '<div class="sp"></div><div class="ver">NIMEX Fleet Hub · v' + window.HUB_V + '</div>';
    $('rail').innerHTML = r;
    $('rail').querySelector('[data-g="all"]').onclick = function (e) { e.preventDefault(); setGroup('all'); scrollTo({ top: 0, behavior: 'smooth' }); };
    $('seg').innerHTML = '<button data-g="all">ทั้งหมด</button>' + G.map(function (g) { return '<button data-g="' + g.id + '">' + esc(g.short) + '</button>'; }).join('');
    $('tabs').innerHTML = '<button data-g="all">' + ic('grid') + 'ทั้งหมด</button>' + G.map(function (g) { return '<button data-g="' + g.id + '">' + ic(g.icon) + esc(g.short) + '</button>'; }).join('');
    [].forEach.call(document.querySelectorAll('#seg button,#tabs button'), function (b) { b.onclick = function () { setGroup(b.dataset.g); }; });
  }
  function setGroup(g) {
    state.group = g;
    [].forEach.call(document.querySelectorAll('#seg button,#tabs button'), function (b) { b.classList.toggle('on', b.dataset.g === g); });
    renderCards();
  }

  /* ---------- hero ---------- */
  function renderHero() {
    var on = S.filter(function (s) { return !isHidden(s); });
    var k = '<div class="kpi"><b>' + on.length + '</b><span>ระบบที่เปิดใช้' + (admin && on.length < S.length ? ' · ซ่อน ' + (S.length - on.length) : '') + '</span></div>';
    G.forEach(function (g) { k += '<div class="kpi"><b>' + on.filter(function (s) { return s.group === g.id; }).length + '<small>/' + SLOTS + '</small></b><span>' + esc(g.short) + '</span></div>'; });
    $('hero').innerHTML = '<div><h2>ศูนย์รวม Dashboard ระบบรถ</h2><p>เลือกระบบที่ต้องการดู ทุกระบบอ่านข้อมูลล่าสุดจาก Google Sheet ของระบบนั้นโดยตรง' + (admin ? ' · ลิงก์ทุกใบเปิดในโหมดผู้ดูแล' : '') + '</p></div><div class="kpis k3">' + k + '</div>';
  }

  /* ---------- cards: 3×3 per group, empty slots wait for new systems ---------- */
  function renderCards() {
    var q = state.q.trim().toLowerCase(), out = '', shown = 0;
    G.forEach(function (g, gi) {
      if (state.group !== 'all' && state.group !== g.id) return;
      var all = S.filter(function (s) { return s.group === g.id && visible(s); });
      var list = all.filter(function (s) { return !q || (s.name + ' ' + s.th + ' ' + s.desc).toLowerCase().indexOf(q) >= 0; });
      if (q && !list.length) return;
      shown += list.length;
      var nOn = all.filter(function (s) { return !isHidden(s); }).length;
      out += '<section class="group" id="g-' + g.id + '"><div class="gh"><div class="ic">' + ic(g.icon) + '</div><div><h3>' + esc(g.name) + '</h3><small>' + nOn + ' / ' + SLOTS + ' ระบบ' + (admin && nOn < all.length ? ' · ซ่อน ' + (all.length - nOn) : '') + '</small></div></div><div class="grid g3">';
      list.forEach(function (s) {
        var hid = isHidden(s);
        if (admin) out += '<div class="cw' + (hid ? ' is-hidden' : '') + '"><button type="button" class="vis" data-id="' + s.id + '" aria-pressed="' + !hid + '" title="' + (hid ? 'ซ่อนจากผู้ชมอยู่ — กดเพื่อแสดง' : 'แสดงอยู่ — กดเพื่อซ่อน') + '">' + ic(hid ? 'eyeoff' : 'eye') + '<span>' + (hid ? 'ซ่อนอยู่' : 'แสดง') + '</span></button>';
        out += '<a class="card" href="' + href(s) + '"><div class="h"><div class="ic">' + ic(s.icon) + '</div><div><h4>' + esc(s.name) + '</h4><div class="th">' + esc(s.th) + '</div></div></div>' +
          '<p>' + esc(s.desc) + '</p><div class="f"><span class="url">/' + esc(s.repo) + '/</span><span class="go">เปิดแดชบอร์ด ›</span></div></a>';
        if (admin) out += '</div>';
      });
      if (!q) for (var i = all.length; i < SLOTS; i++) {
        out += '<div class="card slot" aria-label="ช่องว่าง"><div class="ic">' + ic('plus') + '</div><b>ช่องที่ ' + (i + 1) + '</b><span>' + (admin ? 'เพิ่มระบบได้ที่ config.js' : 'รอเพิ่มระบบ') + '</span></div>';
      }
      out += '</div></section>';
    });
    $('groups').innerHTML = (shown || !q) ? out : '<div class="empty">ไม่พบระบบที่ตรงกับ “' + esc(state.q) + '”</div>';
    [].forEach.call(document.querySelectorAll('#groups .vis'), function (b) { b.onclick = function () { toggleHidden(b.dataset.id); }; });
  }

  /* ---------- cover: shown every time, including #admin links ---------- */
  function cover() {
    var c = $('cover');
    function close() { c.hidden = true; document.body.style.overflow = ''; }
    document.body.style.overflow = 'hidden';
    c.querySelector('button').onclick = close;
    c.querySelector('.fg').onclick = close;
    document.addEventListener('keydown', function k(e) { if (e.key === 'Enter' || e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
    c.querySelector('button').focus();
  }

  function renderAll() { renderNav(); renderHero(); setGroup(state.group); }
  function init() {
    var cached = null; try { cached = JSON.parse(ls('nimex-hub-hidden')); } catch (e) {}
    setHidden(Array.isArray(cached) ? cached : defaultHidden());
    var qs = (location.search.match(/[?&]style=([ab])/i) || [])[1];
    applyStyle((qs || ls('nimex-hub-style') || window.HUB_STYLE || 'a').toLowerCase());
    $('themeBtn').onclick = toggleTheme;
    $('adminPill').hidden = !admin;
    $('styleSw').hidden = !admin;
    [].forEach.call(document.querySelectorAll('#styleSw button'), function (b) { b.onclick = function () { chooseStyle(b.dataset.s); }; });
    $('q').oninput = function () { state.q = this.value; renderCards(); };
    renderAll(); cover(); loadShared();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
