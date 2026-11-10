/* NIMEX Fleet Hub — system cards, 3×3 slots per group.
   Admin (#admin): style A/B, show/hide systems, add/edit/delete extra system links, hide empty slots.
   Shared settings live in the Hub's Google Sheet (Apps Script). */
(function () {
  var ICONS = {
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
    coin: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    gauge: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 13l4-4"/><circle cx="12" cy="13" r="1.3"/>',
    fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"/><path d="M4 20h11"/><path d="M7 8h5"/><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    map: '<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    wrench: '<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L11 18.8a2 2 0 1 1-2.8-2.8l8.4-8.4"/><path d="M14.5 5.5l2.5 2.5"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeoff: '<path d="M4 4l16 16"/><path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.7 3.4M6.3 7.6A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  };
  var PICK_ICONS = ['truck', 'route', 'user', 'coin', 'chart', 'gauge', 'fuel', 'clock', 'grid', 'map', 'box', 'wrench', 'doc'];
  function ic(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || ICONS.grid) + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var G = window.HUB_GROUPS, BUILTIN = window.HUB_SYSTEMS, BASE = window.HUB_BASE, API = window.HUB_API || '';
  var SLOTS = window.HUB_SLOTS || 9;
  var STYLES = { a: 'Navy Classic', b: 'Command Night' };
  var admin = /(^|#)admin\b/.test(location.hash);
  /* shared settings: style, hidden (system ids), extra (systems added by admin), slotHide ({group: n empty slots hidden}) */
  var state = { group: 'all', q: '', style: 'a', hidden: {}, extra: [], slotHide: {} };

  function all() { return BUILTIN.concat(state.extra); }
  function isHidden(s) { return !!state.hidden[s.id]; }
  function visible(s) { return admin || !isHidden(s); }
  function hiddenList() { return Object.keys(state.hidden); }
  function setHidden(list) { state.hidden = {}; (list || []).forEach(function (id) { state.hidden[id] = 1; }); }
  function defaultHidden() { return BUILTIN.filter(function (s) { return s.hidden; }).map(function (s) { return s.id; }); }
  function href(s) {
    if (s.url) return s.url + (admin && s.url.indexOf(BASE) === 0 && s.url.indexOf('#') < 0 ? '#admin' : '');
    return BASE + s.repo + '/' + (admin ? '#admin' : '');
  }
  function shortUrl(s) { var u = s.url || (BASE + s.repo + '/'); return u.replace(/^https:\/\//, '').replace(BASE.replace(/^https:\/\//, ''), '/'); }
  function snapshot() { return { hidden: hiddenList(), extra: clone(state.extra), slotHide: clone(state.slotHide) }; }
  function restore(o) { setHidden(o.hidden); state.extra = o.extra; state.slotHide = o.slotHide; cacheLocal(); renderAll(); }
  function cacheLocal() { ls('nimex-hub-shared', JSON.stringify({ hidden: hiddenList(), extra: state.extra, slotHide: state.slotHide })); }

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

  /* ---------- style A/B ---------- */
  function applyStyle(st) {
    if (!STYLES[st]) st = 'a';
    state.style = st;
    document.body.classList.remove('sa', 'sb'); document.body.classList.add('s' + st);
    $('themeBtn').hidden = st === 'b';
    [].forEach.call(document.querySelectorAll('#styleSw button'), function (b) { b.classList.toggle('on', b.dataset.s === st); b.setAttribute('aria-pressed', b.dataset.s === st); });
    applyTheme(ls('nimex-hub-theme'));
  }

  /* ---------- shared settings from the Hub sheet ---------- */
  function applyShared(st) {
    if (!st) return;
    if (Array.isArray(st.hidden)) setHidden(st.hidden);
    if (Array.isArray(st.extra)) state.extra = st.extra;
    if (st.slotHide && typeof st.slotHide === 'object') state.slotHide = st.slotHide;
  }
  function loadShared() {
    if (!API) return;
    fetch(API + '?v=' + window.HUB_V + '&t=' + Math.floor(Date.now() / 60000)).then(function (r) { return r.json(); }).then(function (d) {
      var st = d && d.settings; if (!st) return;
      if (st.style && !/[?&]style=/.test(location.search)) { ls('nimex-hub-style', st.style); applyStyle(st.style); }
      applyShared(st); cacheLocal(); renderAll();
    }).catch(function () {});
  }
  function post(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  /* ---------- admin login (key kept only in this tab) ---------- */
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
  /* save to the Hub sheet; onFail puts the screen back */
  function save(settings, okMsg, onFail) {
    if (!API) { toast(okMsg.replace('ผู้ชมทุกคน', 'เครื่องนี้') + ' (Hub ยังไม่ได้เชื่อม Google Sheet)'); return Promise.resolve(true); }
    return getKey().then(function (key) {
      return post({ a: 'settings', key: key, settings: settings }).then(function (d) {
        if (d && d.ok) { toast(okMsg); return true; }
        if (d && d.error === 'denied') ss('nimex-admin-key', null);
        onFail();
        toast(d && d.error === 'denied' ? 'บันทึกไม่สำเร็จ รหัสไม่ถูกต้อง' : d && d.error === 'bad_value' ? 'บันทึกไม่สำเร็จ: Apps Script ของ Hub ยังเป็นรุ่นเก่า (อัปเดต Code.gs แล้ว Deploy ใหม่)' : 'บันทึกไม่สำเร็จ', true);
        return false;
      });
    }).catch(function (e) { onFail(); if (e !== 'cancel') toast('เชื่อมต่อระบบข้อมูลไม่ได้', true); return false; });
  }
  function change(fn, keys, okMsg) {
    var before = snapshot();
    fn(); cacheLocal(); renderAll();
    var payload = {}; keys.forEach(function (k) { payload[k] = k === 'hidden' ? hiddenList() : state[k]; });
    return save(payload, okMsg, function () { restore(before); });
  }
  function chooseStyle(st) {
    if (st === state.style) return;
    var prev = state.style;
    applyStyle(st); ls('nimex-hub-style', st);
    save({ style: st }, 'บันทึกแล้ว ผู้ชมทุกคนจะเห็นแบบ ' + STYLES[st], function () { ls('nimex-hub-style', prev); applyStyle(prev); });
  }
  function toggleHidden(id) {
    var s = all().filter(function (x) { return x.id === id; })[0]; if (!s) return;
    var willHide = !state.hidden[id];
    change(function () { if (willHide) state.hidden[id] = 1; else delete state.hidden[id]; }, ['hidden'],
      (willHide ? 'ซ่อน ' : 'แสดง ') + s.name + ' แล้ว ผู้ชมทุกคนเห็นตามนี้');
  }
  function emptyCount(g) { return Math.max(0, SLOTS - all().filter(function (s) { return s.group === g; }).length); }
  function slotHidden(g) { return Math.min(state.slotHide[g] || 0, emptyCount(g)); }
  function setSlotHide(g, n, msg) {
    change(function () { state.slotHide[g] = Math.max(0, Math.min(n, SLOTS)); if (!state.slotHide[g]) delete state.slotHide[g]; }, ['slotHide'], msg);
  }

  /* ---------- add / edit system link ---------- */
  function openEditor(groupId, sys) {
    var m = $('sysEd'), f = $('sysForm'), editing = !!sys;
    $('sysT').textContent = editing ? 'แก้ไขระบบ' : 'เพิ่มระบบใหม่';
    f.name.value = sys ? sys.name : ''; f.th.value = sys ? sys.th : ''; f.desc.value = sys ? sys.desc : '';
    f.url.value = sys ? sys.url : 'https://'; f.group.value = sys ? sys.group : (groupId || G[0].id);
    var icon = sys ? sys.icon : 'grid';
    $('icPick').innerHTML = PICK_ICONS.map(function (n) { return '<button type="button" data-ic="' + n + '" aria-label="ไอคอน ' + n + '" aria-pressed="' + (n === icon) + '"' + (n === icon ? ' class="on"' : '') + '>' + ic(n) + '</button>'; }).join('');
    [].forEach.call($('icPick').querySelectorAll('button'), function (b) {
      b.onclick = function () { icon = b.dataset.ic; [].forEach.call($('icPick').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); };
    });
    $('sysDel').hidden = !editing; $('sysMsg').textContent = '';
    m.hidden = false; setTimeout(function () { f.name.focus(); }, 30);
    function close() { m.hidden = true; f.onsubmit = null; }
    $('sysCancel').onclick = close;
    $('sysDel').onclick = function () {
      if (!confirm('ลบลิงก์ "' + sys.name + '" ออกจาก Hub?')) return;
      close();
      change(function () { state.extra = state.extra.filter(function (x) { return x.id !== sys.id; }); delete state.hidden[sys.id]; }, ['extra', 'hidden'], 'ลบ ' + sys.name + ' แล้ว');
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var v = { name: f.name.value.trim(), th: f.th.value.trim(), desc: f.desc.value.trim(), url: f.url.value.trim(), group: f.group.value, icon: icon };
      if (!v.name) { $('sysMsg').textContent = 'กรุณาใส่ชื่อระบบ'; return; }
      if (!/^https:\/\/[^\s"'<>]{4,290}$/.test(v.url)) { $('sysMsg').textContent = 'ลิงก์ต้องขึ้นต้นด้วย https://'; return; }
      var inGroup = all().filter(function (s) { return s.group === v.group && (!sys || s.id !== sys.id); }).length;
      if (inGroup >= SLOTS) { $('sysMsg').textContent = 'หมวดนี้เต็ม ' + SLOTS + ' ช่องแล้ว'; return; }
      close();
      change(function () {
        if (editing) { var t = state.extra.filter(function (x) { return x.id === sys.id; })[0]; Object.assign(t, v); }
        else { v.id = 'x-' + Date.now().toString(36); state.extra.push(v); if (state.slotHide[v.group]) state.slotHide[v.group] = Math.min(state.slotHide[v.group], emptyCount(v.group)); }
      }, ['extra', 'slotHide'], (editing ? 'แก้ไข ' : 'เพิ่ม ') + v.name + ' แล้ว ผู้ชมทุกคนเห็นตามนี้');
    };
  }

  /* ---------- rail + tabs + segment ---------- */
  function renderNav() {
    var r = '<div class="plate"><img src="logo.png" alt="NIMEX"></div>';
    r += '<a href="#" data-g="all" class="on">' + ic('home') + 'หน้าหลัก</a>';
    G.forEach(function (g) {
      r += '<div class="sec">' + esc(g.name) + '</div>';
      all().filter(function (s) { return s.group === g.id && visible(s); }).forEach(function (s) {
        r += '<a href="' + esc(href(s)) + '" target="_blank" rel="noopener"' + (isHidden(s) ? ' class="off" title="ซ่อนจากผู้ชม"' : '') + '>' + ic(s.icon) + esc(s.name) + '</a>';
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
    var on = all().filter(function (s) { return !isHidden(s); });
    var k = '<div class="kpi"><b>' + on.length + '</b><span>ระบบที่เปิดใช้' + (admin && on.length < all().length ? ' · ซ่อน ' + (all().length - on.length) : '') + '</span></div>';
    G.forEach(function (g) { k += '<div class="kpi"><b>' + on.filter(function (s) { return s.group === g.id; }).length + '<small>/' + SLOTS + '</small></b><span>' + esc(g.short) + '</span></div>'; });
    $('hero').innerHTML = '<div><h2>ศูนย์รวม Dashboard ระบบรถ</h2><p>เลือกระบบที่ต้องการดู ระบบจะเปิดในแท็บใหม่' + (admin ? ' · ลิงก์ทุกใบเปิดในโหมดผู้ดูแล' : '') + '</p></div><div class="kpis k3">' + k + '</div>';
  }

  /* ---------- cards ---------- */
  function cardHtml(s) {
    var hid = isHidden(s), out = '';
    if (admin) {
      out += '<div class="cw' + (hid ? ' is-hidden' : '') + '"><div class="acts">';
      if (s.url) out += '<button type="button" class="act ed" data-id="' + s.id + '" title="แก้ไขลิงก์นี้">' + ic('edit') + '<span>แก้ไข</span></button>';
      out += '<button type="button" class="act vis" data-id="' + s.id + '" aria-pressed="' + !hid + '" title="' + (hid ? 'ซ่อนจากผู้ชมอยู่ — กดเพื่อแสดง' : 'แสดงอยู่ — กดเพื่อซ่อน') + '">' + ic(hid ? 'eyeoff' : 'eye') + '<span>' + (hid ? 'ซ่อนอยู่' : 'แสดง') + '</span></button></div>';
    }
    out += '<a class="card" href="' + esc(href(s)) + '" target="_blank" rel="noopener"><div class="h"><div class="ic">' + ic(s.icon) + '</div><div><h4>' + esc(s.name) + '</h4><div class="th">' + esc(s.th) + '</div></div></div>' +
      '<p>' + esc(s.desc) + '</p><div class="f"><span class="url">' + esc(shortUrl(s)) + '</span><span class="go">เปิดแดชบอร์ด ' + ic('ext') + '</span></div></a>';
    if (admin) out += '</div>';
    return out;
  }
  function renderCards() {
    var q = state.q.trim().toLowerCase(), out = '', shown = 0;
    G.forEach(function (g) {
      if (state.group !== 'all' && state.group !== g.id) return;
      var mine = all().filter(function (s) { return s.group === g.id && visible(s); });
      var list = mine.filter(function (s) { return !q || (s.name + ' ' + s.th + ' ' + s.desc).toLowerCase().indexOf(q) >= 0; });
      if (q && !list.length) return;
      shown += list.length;
      var nOn = mine.filter(function (s) { return !isHidden(s); }).length;
      var empty = emptyCount(g.id), hidSlots = slotHidden(g.id);
      var tools = admin && !q ? '<div class="gtools">' +
        (empty ? '<button type="button" class="gt" data-slots="' + g.id + '" data-n="' + (hidSlots < empty ? empty : 0) + '">' + ic(hidSlots < empty ? 'eyeoff' : 'eye') + (hidSlots < empty ? 'ซ่อนช่องว่างทั้งหมด' : 'แสดงช่องว่างทั้งหมด') + '</button>' : '') +
        (empty ? '<button type="button" class="gt pri" data-add="' + g.id + '">' + ic('plus') + 'เพิ่มระบบ</button>' : '') + '</div>' : '';
      out += '<section class="group" id="g-' + g.id + '"><div class="gh"><div class="ic">' + ic(g.icon) + '</div><div><h3>' + esc(g.name) + '</h3><small>' + nOn + ' / ' + SLOTS + ' ระบบ' +
        (admin && nOn < mine.length ? ' · ซ่อน ' + (mine.length - nOn) : '') + (admin && hidSlots ? ' · ซ่อนช่องว่าง ' + hidSlots : '') + '</small></div>' + tools + '</div><div class="grid g3">';
      list.forEach(function (s) { out += cardHtml(s); });
      if (!q) for (var i = 0; i < empty; i++) {
        var off = i >= empty - hidSlots, no = mine.length + i + 1;
        if (!admin) { if (!off) out += '<div class="card slot" aria-label="ช่องว่าง"><div class="ic">' + ic('plus') + '</div><b>ช่องที่ ' + no + '</b><span>รอเพิ่มระบบ</span></div>'; continue; }
        out += '<div class="card slot adm' + (off ? ' is-off' : '') + '"><div class="ic">' + ic('plus') + '</div><b>ช่องที่ ' + no + (off ? ' · ซ่อนจากผู้ชม' : '') + '</b>' +
          '<div class="sa"><button type="button" class="act pri" data-add="' + g.id + '">' + ic('plus') + 'เพิ่มระบบ</button>' +
          '<button type="button" class="act" data-slot="' + g.id + '" data-n="' + (off ? hidSlots - 1 : hidSlots + 1) + '">' + ic(off ? 'eye' : 'eyeoff') + (off ? 'แสดงช่องนี้' : 'ซ่อนช่องนี้') + '</button></div></div>';
      }
      out += '</div></section>';
    });
    $('groups').innerHTML = (shown || !q) ? out : '<div class="empty">ไม่พบระบบที่ตรงกับ “' + esc(state.q) + '”</div>';
    var each = function (sel, fn) { [].forEach.call(document.querySelectorAll('#groups ' + sel), function (b) { b.onclick = function () { fn(b); }; }); };
    each('.vis', function (b) { toggleHidden(b.dataset.id); });
    each('.ed', function (b) { openEditor(null, state.extra.filter(function (x) { return x.id === b.dataset.id; })[0]); });
    each('[data-add]', function (b) { openEditor(b.dataset.add); });
    each('[data-slot]', function (b) { var n = +b.dataset.n; setSlotHide(b.dataset.slot, n, n > slotHidden(b.dataset.slot) ? 'ซ่อนช่องว่างแล้ว ผู้ชมจะไม่เห็นช่องนี้' : 'แสดงช่องว่างแล้ว'); });
    each('[data-slots]', function (b) { var n = +b.dataset.n; setSlotHide(b.dataset.slots, n, n ? 'ซ่อนช่องว่างทั้งหมวดแล้ว' : 'แสดงช่องว่างทั้งหมวดแล้ว'); });
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
    var cached = null; try { cached = JSON.parse(ls('nimex-hub-shared')); } catch (e) {}
    if (cached) applyShared(cached); else setHidden(defaultHidden());
    var qs = (location.search.match(/[?&]style=([ab])/i) || [])[1];
    applyStyle((qs || ls('nimex-hub-style') || window.HUB_STYLE || 'a').toLowerCase());
    $('themeBtn').onclick = toggleTheme;
    $('adminPill').hidden = !admin;
    $('styleSw').hidden = !admin;
    if (admin) document.body.classList.add('is-admin');
    $('sysForm').group.innerHTML = G.map(function (g) { return '<option value="' + g.id + '">' + esc(g.name) + '</option>'; }).join('');
    [].forEach.call(document.querySelectorAll('#styleSw button'), function (b) { b.onclick = function () { chooseStyle(b.dataset.s); }; });
    $('q').oninput = function () { state.q = this.value; renderCards(); };
    renderAll(); cover(); loadShared();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
