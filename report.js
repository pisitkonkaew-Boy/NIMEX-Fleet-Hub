/* NIMEX Fleet Hub — ศูนย์รายงาน (เฉพาะผู้ดูแล)
   โหมด Daily / Weekly (จ.–ส.) / Monthly · ดึงตัวเลขจากหน้าเว็บของแต่ละระบบผ่าน adapters.js
   ผลลัพธ์: สรุปหน้าเดียว · รูปแยกตามด้าน · รูปแยกตาม KPI (16:9) · รูปแนวตั้ง 1080×1920 · PowerPoint · ข้อความ LINE · ฉายเต็มจอ
   ภาพเป็น SVG ล้วน ฝังฟอนต์ Prompt + โลโก้ แล้วแปลงเป็น PNG ในเบราว์เซอร์ (ไม่ใช้ html2canvas) */
(function () {
  'use strict';
  if (!/(^|#)admin\b/.test(location.hash)) return;
  var AD = window.HUB_ADAPTERS, DT = window.HUB_DATE, APP = function () { return window.HUB_APP; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var LSK = 'nimex-hub-report';
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_ML = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'], TH_DS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var MODES = { D: { en: 'DAILY', th: 'รายงานประจำวัน', t: 'Daily Report', file: 'Daily' }, W: { en: 'WEEKLY', th: 'รายงานประจำสัปดาห์', t: 'Weekly Report', file: 'Weekly' }, M: { en: 'MONTHLY', th: 'รายงานประจำเดือน', t: 'Monthly Report', file: 'Monthly' } };
  var CDN = { zip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', pptx: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js' };

  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadLib(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('โหลดไลบรารีไม่สำเร็จ')); }; document.head.appendChild(s); }); }

  /* ---------- KPI catalogue (shared from Hub sheet, else config.js) ---------- */
  function kpis() { var k = window.HUB_SHARED_KPIS; return Array.isArray(k) && k.length ? k : window.HUB_KPIS; }
  function dimEmo(name) { var d = (window.HUB_DIMS || []).filter(function (x) { return x.name === name; })[0]; return d ? d.emo : '📌'; }
  function dims(list) { var o = [], seen = {}; list.forEach(function (k) { if (!seen[k.dim]) { seen[k.dim] = 1; o.push(k.dim); } }); return o; }
  function sysName(id) { var s = (window.HUB_SYSTEMS || []).filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }

  /* ---------- periods ---------- */
  var iso = DT.iso, pd = DT.pd, addD = DT.addD;
  function dow(s) { return pd(s).getDay(); }
  function prevWork(s) { var d = addD(s, -1); while (dow(d) === 0) d = addD(d, -1); return d; }
  function monday(s) { var d = pd(s), w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1)); return iso(d); }
  function monthEnd(s) { var d = pd(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  function prevMonth(s) { var d = pd(s); return iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function dTh(s, y) { var d = pd(s); return d.getDate() + ' ' + TH_M[d.getMonth()] + (y ? ' ' + (d.getFullYear() + 543) : ''); }
  function period(mode, ref) {
    if (mode === 'D') { var d = dow(ref) === 0 ? prevWork(ref) : ref; return { mode: mode, a: d, b: d }; }
    if (mode === 'W') { var m = monday(ref); return { mode: mode, a: m, b: addD(m, 5) }; }
    var f = ref.slice(0, 8) + '01'; return { mode: mode, a: f, b: monthEnd(f) };
  }
  function prevOf(p) {
    if (p.mode === 'D') { var d = prevWork(p.a); return { mode: 'D', a: d, b: d }; }
    if (p.mode === 'W') return { mode: 'W', a: addD(p.a, -7), b: addD(p.b, -7) };
    var f = prevMonth(p.a); return { mode: 'M', a: f, b: monthEnd(f) };
  }
  function back(p, n) { var o = [p]; for (var i = 1; i < n; i++) o.unshift(prevOf(o[0])); return o; }
  function label(p) {
    var A = pd(p.a), B = pd(p.b);
    if (p.mode === 'D') return TH_D[A.getDay()] + ' ' + dTh(p.a, 1);
    if (p.mode === 'W') return (A.getMonth() === B.getMonth() ? A.getDate() : dTh(p.a)) + '–' + dTh(p.b, 1) + '  (จ.–ส.)';
    return TH_ML[A.getMonth()] + ' ' + (A.getFullYear() + 543) + '  (1–' + B.getDate() + ' ' + TH_M[A.getMonth()] + ')';
  }
  function shortLabel(p) {
    var A = pd(p.a); if (p.mode === 'D') return TH_DS[A.getDay()] + ' ' + A.getDate();
    if (p.mode === 'W') return A.getDate() + ' ' + TH_M[A.getMonth()]; return TH_M[A.getMonth()] + ' ' + String(A.getFullYear() + 543).slice(2);
  }
  function fileTag(p) { return MODES[p.mode].file + '_' + (p.mode === 'D' ? p.a : p.mode === 'W' ? p.a + '_to_' + p.b.slice(5) : p.a.slice(0, 7)); }

  /* ---------- loading systems in hidden frames ---------- */
  var FR = {}, ST = {};   /* ST[sys] = {state:'loading'|'ready'|'error', latest, msg} */
  function frameFor(sys) {
    if (FR[sys]) return FR[sys];
    var ad = AD[sys]; if (!ad) return null;
    var host = $('repFrames'); if (!host) { host = document.createElement('div'); host.id = 'repFrames'; host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:fixed;left:-4000px;top:0;width:1400px;height:900px;overflow:hidden;visibility:hidden'; document.body.appendChild(host); }
    var f = document.createElement('iframe'); f.title = ad.repo; f.style.cssText = 'width:1400px;height:900px;border:0'; f.src = '/' + ad.repo + '/';
    host.appendChild(f); ST[sys] = { state: 'loading' };
    FR[sys] = new Promise(function (res) {
      var t0 = Date.now();
      (function poll() {
        var w = f.contentWindow, ok = false;
        try { ok = w && ad.ready(w); } catch (e) {}
        if (ok) { var lt = null; try { lt = ad.latest(w); } catch (e) {} ST[sys] = { state: 'ready', latest: lt, w: w }; renderStatus(); return res(w); }
        if (Date.now() - t0 > 90000) { ST[sys] = { state: 'error', msg: 'โหลดไม่สำเร็จ (เกิน 90 วินาที)' }; renderStatus(); return res(null); }
        setTimeout(poll, 400);
      })();
    });
    renderStatus();
    return FR[sys];
  }
  function ensure(syss) { return Promise.all(syss.map(function (s) { return frameFor(s); })); }

  /* ---------- compute ---------- */
  var CACHE = {};
  function calc(k, p) {
    var id = k.sys + '|' + k.key + '|' + p.a + '|' + p.b;
    if (CACHE[id] !== undefined) return Promise.resolve(CACHE[id]);
    var st = ST[k.sys], ad = AD[k.sys];
    if (!st || st.state !== 'ready' || !ad) return Promise.resolve(null);
    return Promise.resolve(ad.prepare ? ad.prepare(st.w, p.a, p.b) : null).then(function () {
      var r = null; try { r = ad.calc(st.w, k.key, p.a, p.b); } catch (e) { console.warn('[report]', k.id, e); }
      if (r && (r.v == null || !isFinite(r.v))) r = null;
      return (CACHE[id] = r);
    });
  }
  function status(k, v, pv) {
    if (v == null) return 0;
    var t = k.target === '' || k.target == null ? null : +k.target;
    if (t != null && isFinite(t)) return (k.dir < 0 ? v <= t : v >= t) ? 1 : -1;
    if (pv == null) return 0;
    var d = v - pv; if (Math.abs(d) < 1e-9) return 0; return (k.dir < 0 ? d < 0 : d > 0) ? 1 : -1;
  }
  function better(k, d) { if (d == null || Math.abs(d) < 1e-9) return 0; return (k.dir < 0 ? d < 0 : d > 0) ? 1 : -1; }
  function hasT(k) { return k.target !== '' && k.target != null && isFinite(+k.target); }
  function compute(list, p, opt) {
    var pp = prevOf(p), out = [];
    return list.reduce(function (ch, k) {
      return ch.then(function () {
        return Promise.all([calc(k, p), calc(k, pp)]).then(function (r) {
          var c = r[0], q = r[1], o = { k: k, cur: c, prev: q, v: c ? c.v : null, pv: q ? q.v : null };
          o.d = o.v != null && o.pv != null ? o.v - o.pv : null;
          o.st = status(k, o.v, o.pv); o.better = better(k, o.d);
          out.push(o);
          if (!opt || !opt.trend) return;
          var ps = back(p, p.mode === 'D' ? 14 : 6);
          return Promise.all(ps.map(function (x) { return calc(k, x); })).then(function (tr) { o.trend = ps.map(function (x, i) { return { l: shortLabel(x), v: tr[i] ? tr[i].v : null }; }); });
        });
      });
    }, Promise.resolve()).then(function () { return out; });
  }
  /* DCs below target in this and the 2 previous periods (needs a target and DC rows) */
  function streaks(res, p) {
    var ps = [prevOf(prevOf(p)), prevOf(p), p];
    return res.filter(function (o) { return hasT(o.k) && o.cur && o.cur.dc && o.cur.dc.length; }).reduce(function (ch, o) {
      return ch.then(function () {
        return Promise.all(ps.map(function (x) { return calc(o.k, x); })).then(function (rs) {
          var t = +o.k.target, bad = function (v) { return v != null && (o.k.dir < 0 ? v > t : v < t); };
          var sets = rs.map(function (r) { var m = {}; (r && r.dc || []).forEach(function (x) { if (bad(x[1]) && (x[2] == null || x[2] >= 5)) m[x[0]] = 1; }); return m; });
          o.streak = Object.keys(sets[2]).filter(function (n) { return sets[0][n] && sets[1][n]; });
        });
      });
    }, Promise.resolve()).then(function () { return res; });
  }

  /* ---------- formatting ---------- */
  function dec(k) { return k.unit === '%' ? (k.dir < 0 ? 2 : 1) : k.unit === 'min' ? 1 : 0; }
  function money(v, sign) { var a = Math.abs(v), s = v < 0 ? '−' : sign ? '+' : ''; return a >= 1e6 ? s + (a / 1e6).toFixed(2) + ' ลบ.' : s + Math.round(a).toLocaleString('en-US') + ' บ.'; }
  function fmt(k, v) {
    if (v == null) return '–';
    if (k.unit === '%') return v.toFixed(dec(k)) + '%';
    if (k.unit === 'baht') return money(v, true);
    if (k.unit === 'min') return v.toFixed(1) + ' นาที';
    return (+v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function fmtD(k, d) {
    if (d == null) return '';
    var ar = d > 0 ? '▲ ' : d < 0 ? '▼ ' : '';
    if (k.unit === '%') return ar + Math.abs(d).toFixed(dec(k)) + ' pt';
    if (k.unit === 'baht') return ar + money(Math.abs(d)).replace('−', '');
    if (k.unit === 'min') return ar + Math.abs(d).toFixed(1) + ' นาที';
    return ar + Math.abs(d).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function fmtT(k) { return hasT(k) ? (k.dir < 0 ? '≤ ' : '≥ ') + fmt(k, +k.target).replace(/^\+/, '') : ''; }

  /* ================= SVG ================= */
  var CY = '#38c8ff', NAVY = '#040b22', PANEL = 'rgba(8,24,64,.80)', GREEN = '#22e08a', RED = '#ff4d5e', YEL = '#ffc20e', MUT = '#8fb3dd', SOFT = '#d6e6ff', GREY = '#7d8fae';
  var ASSET = null;
  function dataUrl(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.blob(); }).then(function (b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); }); }); }
  function assets() {
    if (ASSET) return ASSET;
    var F = ['thai-400', 'latin-400', 'thai-600', 'latin-600', 'thai-700', 'latin-700', 'thai-800', 'latin-800'];
    var B = window.HUB_ASSET_BASE || '';
    ASSET = Promise.all([dataUrl(B + 'logo.png'), dataUrl(B + 'report-bg.jpg')].concat(F.map(function (f) { return dataUrl(B + 'fonts/prompt-' + f + '.woff2'); }))).then(function (r) {
      var css = F.map(function (f, i) { return '@font-face{font-family:Prompt;font-weight:' + f.split('-')[1] + ';src:url(' + r[i + 2] + ')}'; }).join('');
      return { logo: r[0], bg: r[1], css: css };
    });
    return ASSET;
  }
  function T(x, y, s, size, w, fill, anchor, extra) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="' + (w || 400) + '" fill="' + (fill || '#fff') + '" text-anchor="' + (anchor || 'start') + '" ' + (extra || '') + '>' + esc(s) + '</text>'; }
  /* shrink a label to fit width (approx. glyph width 0.56em for Thai/Latin mix) */
  function fit(s, size, w) { s = String(s); var max = Math.floor(w / (size * 0.56)); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s; }
  function panel(x, y, w, h, r, glow) { r = r || 18; return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + PANEL + '" stroke="' + CY + '" stroke-opacity=".55" stroke-width="1.5"' + (glow === false ? '' : ' filter="url(#glow)"') + '/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (w - 2) + '" height="' + (h - 2) + '" rx="' + r + '" fill="none" stroke="#fff" stroke-opacity=".05"/>'; }
  function defs(A, W, H, bgop) {
    return '<defs><style>' + A.css + ' text{font-family:Prompt,sans-serif}</style>' +
      '<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" result="b"/><feFlood flood-color="' + CY + '" flood-opacity=".35"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffd24a"/><stop offset="1" stop-color="#c98a06"/></linearGradient>' +
      '<filter id="gglow"><feGaussianBlur stdDeviation="5" result="b"/><feFlood flood-color="#ffb800" flood-opacity=".55"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="tglow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="#1b6dff"/><stop offset="1" stop-color="' + CY + '"/></linearGradient>' +
      '<linearGradient id="barv" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1b6dff"/><stop offset="1" stop-color="' + CY + '"/></linearGradient>' +
      '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + NAVY + '" stop-opacity=".55"/><stop offset=".35" stop-color="' + NAVY + '" stop-opacity=".88"/><stop offset="1" stop-color="' + NAVY + '" stop-opacity=".97"/></linearGradient>' +
      '<linearGradient id="hline" x1="0" x2="1"><stop offset="0" stop-color="' + CY + '" stop-opacity="0"/><stop offset=".5" stop-color="' + YEL + '"/><stop offset="1" stop-color="' + CY + '" stop-opacity="0"/></linearGradient>' +
      '</defs><rect width="' + W + '" height="' + H + '" fill="' + NAVY + '"/><image href="' + A.bg + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice" opacity="' + (bgop || 0.32) + '"/><rect width="' + W + '" height="' + H + '" fill="url(#fade)"/>';
  }
  function logo(A, x, y, s) { var w = 112 * s, h = 72 * s; return '<rect x="' + (x - 8 * s) + '" y="' + (y - 6 * s) + '" width="' + (w + 16 * s) + '" height="' + (h + 12 * s) + '" rx="' + 12 * s + '" fill="#fff" fill-opacity=".94" stroke="' + CY + '" stroke-opacity=".6"/><image href="' + A.logo + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet"/>'; }
  function hud(x, y, w, h, c) {
    c = c || 18; var L = 34;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + c + '" fill="#0a1a44" fill-opacity=".65" stroke="' + YEL + '" stroke-opacity=".45" stroke-width="1.5"/>' +
      '<path d="M' + x + ' ' + (y + L) + ' V' + (y + c) + ' Q' + x + ' ' + y + ' ' + (x + c) + ' ' + y + ' H' + (x + L + 20) + ' M' + (x + w - L - 20) + ' ' + y + ' H' + (x + w - c) + ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + c) + ' V' + (y + L) + ' M' + (x + w) + ' ' + (y + h - L) + ' V' + (y + h - c) + ' Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - c) + ' ' + (y + h) + ' H' + (x + w - L - 20) + ' M' + (x + L + 20) + ' ' + (y + h) + ' H' + (x + c) + ' Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - c) + ' V' + (y + h - L) + '" fill="none" stroke="url(#gold)" stroke-width="4" filter="url(#gglow)"/>' +
      '<rect x="' + (x + w / 2 - 90) + '" y="' + (y + h - 2) + '" width="180" height="4" rx="2" fill="url(#hline)"/>';
  }
  function perBox(x, y, w, p, s) {
    s = s || 1; var m = MODES[p.mode], h = 88 * s;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + 14 * s + '" fill="' + NAVY + '" fill-opacity=".75" stroke="' + YEL + '" stroke-opacity=".8"/>' +
      '<rect x="' + (x + 14 * s) + '" y="' + (y + 12 * s) + '" width="' + 118 * s + '" height="' + 30 * s + '" rx="' + 15 * s + '" fill="' + YEL + '"/>' + T(x + 73 * s, y + 33 * s, m.en, 16 * s, 800, NAVY, 'middle') +
      T(x + 146 * s, y + 35 * s, m.th, 20 * s, 600, YEL) + T(x + w - 14 * s, y + 36 * s, label(p), 25 * s, 800, '#fff', 'end') +
      '<line x1="' + (x + 14 * s) + '" y1="' + (y + 50 * s) + '" x2="' + (x + w - 14 * s) + '" y2="' + (y + 50 * s) + '" stroke="#fff" stroke-opacity=".12"/>' +
      T(x + 16 * s, y + 78 * s, '⇄  เทียบกับ', 18 * s, 600, CY) + T(x + w - 14 * s, y + 78 * s, label(prevOf(p)), 20 * s, 600, SOFT, 'end');
  }
  function header(A, W, title, p) {
    var tw = Math.min(Math.max(title.length * 29 + 80, 420), W - 246 - 48 - 676);
    return logo(A, 56, 26, 1) + hud(246, 20, tw, 86, 16) + T(246 + tw / 2, 80, fit(title, 44, tw - 40), 44, 800, 'url(#gold)', 'middle', 'filter="url(#gglow)" font-style="italic"') +
      perBox(W - 48 - 640, 18, 640, p) + '<rect x="0" y="122" width="' + W + '" height="2" fill="url(#hline)"/>';
  }
  function brand(W, H, s) { s = s || 1; return T(W - 48 * s, H - 26 * s, 'Fleet Planning', 30 * s, 800, 'url(#gold)', 'end', 'font-style="italic" filter="url(#gglow)" letter-spacing="0.5"') + '<rect x="' + (W - 284 * s) + '" y="' + (H - 18 * s) + '" width="' + 236 * s + '" height="' + 3 * s + '" rx="2" fill="url(#hline)"/>'; }
  function footer(W, H, txt) { return T(48, H - 24, fit(txt, 16, W - 420), 16, 400, MUT) + brand(W, H); }
  function dot(x, y, st, r) { var c = st > 0 ? GREEN : st < 0 ? RED : GREY; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/><circle cx="' + x + '" cy="' + y + '" r="' + (r + 5) + '" fill="' + c + '" fill-opacity=".2"/>'; }
  function deltaT(x, y, o, size, anchor) { if (o.d == null) return ''; return T(x, y, fmtD(o.k, o.d), size, 700, o.better > 0 ? GREEN : o.better < 0 ? RED : MUT, anchor); }
  function svgOpen(W, H) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'; }
  function sources(res) { var s = {}; res.forEach(function (o) { s[sysName(o.k.sys)] = 1; }); return 'ที่มา: ' + Object.keys(s).join(' · '); }

  /* ---- charts ---- */
  function hbars(x, y, w, h, items, k, lo, hi) {
    if (!items.length) return T(x + w / 2, y + h / 2, 'ไม่มีข้อมูลแยก', 18, 400, MUT, 'middle');
    var n = items.length, lw = 150, bh = Math.min(26, h / n * 0.66), s = '', t = hasT(k) ? +k.target : null, span = w - lw - 110;
    items.forEach(function (it, i) {
      var by = y + i * h / n + (h / n - bh) / 2, v = it[1], bw = v == null ? 0 : Math.max(2, span * (v - lo) / (hi - lo || 1));
      var ok = t == null ? true : (k.dir < 0 ? v <= t : v >= t);
      s += T(x + lw - 12, by + bh * 0.76, fit(it[0], 17, lw - 12), 17, 600, SOFT, 'end') + '<rect x="' + (x + lw) + '" y="' + by + '" width="' + span + '" height="' + bh + '" rx="' + bh / 2 + '" fill="#fff" fill-opacity=".06"/>' +
        '<rect x="' + (x + lw) + '" y="' + by + '" width="' + Math.min(span, bw).toFixed(0) + '" height="' + bh + '" rx="' + bh / 2 + '" fill="' + (ok ? 'url(#bar)' : RED) + '"/>' + T(x + lw + Math.min(span, bw) + 10, by + bh * 0.78, fmt(k, v) + (it[2] != null && it[2] < 30 ? ' (' + it[2] + ')' : ''), 16, 700, '#fff');
    });
    if (t != null && t >= lo && t <= hi) { var tx = x + lw + span * (t - lo) / (hi - lo || 1); s += '<line x1="' + tx + '" y1="' + (y - 4) + '" x2="' + tx + '" y2="' + (y + h) + '" stroke="' + YEL + '" stroke-dasharray="6 5" stroke-width="2"/>' + T(tx, y - 10, 'เป้า ' + fmt(k, t).replace(/^\+/, ''), 15, 700, YEL, 'middle'); }
    return s;
  }
  function range(vals, k, pad) {
    var v = vals.filter(function (x) { return x != null; }); if (hasT(k)) v.push(+k.target); if (!v.length) return [0, 1, false];
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    if (k.unit === '%' && lo >= 0) { var sp = Math.max(hi - lo, 2); lo = Math.max(0, lo - sp * (pad || 0.6)); hi = Math.min(Math.max(hi, 100) === 100 && hi > 95 ? 100 : hi + sp * 0.25, hi + sp * 0.25); if (hi <= lo) hi = lo + 1; return [Math.floor(lo), Math.ceil(hi), lo > 0]; }
    if (lo > 0 && k.unit !== 'baht') lo = 0; var span = hi - lo || Math.abs(hi) || 1; return [lo - (lo < 0 ? span * 0.1 : 0), hi + span * 0.15, false];
  }
  function lineChart(x, y, w, h, series, k, labels) {
    var all = []; series.forEach(function (s) { all = all.concat(s.vals); }); var r = range(all, k, 0.3), lo = r[0], hi = r[1], out = '';
    var Y = function (v) { return y + h - h * (v - lo) / (hi - lo || 1); };
    for (var g = 0; g <= 4; g++) { var gv = lo + (hi - lo) * g / 4, gy = Y(gv); out += '<line x1="' + x + '" y1="' + gy + '" x2="' + (x + w) + '" y2="' + gy + '" stroke="#fff" stroke-opacity=".07"/>' + T(x - 10, gy + 5, k.unit === 'baht' ? money(gv) : gv.toFixed(hi - lo < 5 ? 1 : 0), 14, 400, MUT, 'end'); }
    if (hasT(k)) { var ty = Y(+k.target); out += '<line x1="' + x + '" y1="' + ty + '" x2="' + (x + w) + '" y2="' + ty + '" stroke="' + YEL + '" stroke-dasharray="6 5" stroke-width="2"/>'; }
    var cols = [CY, '#b48cff', YEL, GREEN], n = labels.length;
    series.forEach(function (s, si) {
      var pts = s.vals.map(function (v, i) { return v == null ? null : [x + (n > 1 ? w * i / (n - 1) : w / 2), Y(v)]; });
      var d = '', started = false; pts.forEach(function (p) { if (!p) { started = false; return; } d += (started ? ' L' : ' M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0); started = true; });
      if (si === 0) { var vp = pts.filter(Boolean); if (vp.length > 1) out += '<path d="M' + vp[0][0].toFixed(0) + ' ' + (y + h) + ' L' + vp.map(function (p) { return p[0].toFixed(0) + ' ' + p[1].toFixed(0); }).join(' L') + ' L' + vp[vp.length - 1][0].toFixed(0) + ' ' + (y + h) + 'Z" fill="' + CY + '" fill-opacity=".10"/>'; }
      out += '<path d="' + d + '" fill="none" stroke="' + cols[si] + '" stroke-width="3.5" stroke-linejoin="round"/>';
      pts.forEach(function (p) { if (p) out += '<circle cx="' + p[0].toFixed(0) + '" cy="' + p[1].toFixed(0) + '" r="5" fill="' + NAVY + '" stroke="' + cols[si] + '" stroke-width="3"/>'; });
    });
    labels.forEach(function (l, i) { out += T(x + (n > 1 ? w * i / (n - 1) : w / 2), y + h + 26, l, 14, 400, MUT, 'middle'); });
    return out;
  }
  function chartTitle(x, y, t, note) { return T(x, y, t, 21, 700, '#fff') + (note ? T(x, y + 23, note, 14, 400, MUT) : ''); }
  function axisNote(k, lo) { return k.unit === '%' && lo > 0 ? 'แกนเริ่มที่ ' + lo + '%' : ''; }
  function sortBy(items, k, worstFirst) { return items.filter(function (x) { return x[1] != null; }).sort(function (a, b) { var d = (a[1] - b[1]) * (k.dir < 0 ? -1 : 1); return worstFirst ? d : -d; }); }
  function bigEnough(items) { var big = items.filter(function (x) { return x[2] == null || x[2] >= 5; }); return big.length >= 3 ? big : items; }

  /* ---- 1) one-page summary ---- */
  function svgSummary(A, res, p) {
    var W = 1920, H = 1080, D = dims(res.map(function (o) { return o.k; })), s = svgOpen(W, H) + defs(A, W, H);
    s += header(A, W, 'Fleet Report · สรุปภาพรวม', p);
    var tot = res.filter(function (o) { return o.v != null; }).length, ok = res.filter(function (o) { return o.st > 0; }).length, up = res.filter(function (o) { return o.better > 0; }).length, dn = res.filter(function (o) { return o.better < 0; }).length;
    var y0 = 146; s += panel(48, y0, W - 96, 74, 14, false);
    s += T(76, y0 + 47, 'ผ่านเกณฑ์ ' + ok + '/' + tot + ' ตัวชี้วัด', 28, 800, '#fff');
    s += '<rect x="440" y="' + (y0 + 28) + '" width="520" height="18" rx="9" fill="#fff" fill-opacity=".1"/><rect x="440" y="' + (y0 + 28) + '" width="' + (tot ? 520 * ok / tot : 0).toFixed(0) + '" height="18" rx="9" fill="' + GREEN + '"/>';
    s += T(1000, y0 + 47, '▲▼ เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + ' :  ดีขึ้น ' + up + '  ·  แย่ลง ' + dn, 22, 600, MUT);
    s += dot(1580, y0 + 38, 1, 6) + T(1596, y0 + 45, 'ผ่าน', 18, 400, MUT) + dot(1680, y0 + 38, -1, 6) + T(1696, y0 + 45, 'ไม่ผ่าน', 18, 400, MUT);
    var n = D.length, cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), gy = 244, gap = 22;
    var pw = (W - 96 - (cols - 1) * 24) / cols, ph = (H - gy - 56 - (rows - 1) * gap) / rows;
    var maxK = Math.max.apply(null, D.map(function (d) { return res.filter(function (o) { return o.k.dim === d; }).length; }));
    D.forEach(function (dn2, i) {
      var cx = 48 + (i % cols) * (pw + 24), cy = gy + Math.floor(i / cols) * (ph + gap), ks = res.filter(function (o) { return o.k.dim === dn2; });
      var srcs = {}; ks.forEach(function (o) { srcs[sysName(o.k.sys)] = 1; });
      s += panel(cx, cy, pw, ph) + '<rect x="' + (cx + 22) + '" y="' + (cy + 24) + '" width="6" height="30" rx="3" fill="' + YEL + '"/>';
      s += T(cx + 40, cy + 48, fit(dn2, 25, pw * 0.6), 25, 800, '#fff') + T(cx + pw - 22, cy + 48, fit(Object.keys(srcs).join(' / '), 15, pw * 0.36), 15, 400, MUT, 'end');
      var rh = (ph - 76) / Math.max(maxK, 3), big = Math.min(34, rh * 0.36), sm = Math.min(19, rh * 0.21);
      ks.forEach(function (o, j) {
        var ry = cy + 70 + j * rh;
        if (j) s += '<line x1="' + (cx + 22) + '" y1="' + ry + '" x2="' + (cx + pw - 22) + '" y2="' + ry + '" stroke="#fff" stroke-opacity=".08"/>';
        s += dot(cx + 34, ry + rh / 2, o.st, 6) + T(cx + 56, ry + rh / 2 - big * 0.3, fit(o.k.name, sm, pw - 90), sm, 400, SOFT);
        s += T(cx + 56, ry + rh / 2 + big * 0.85, fmt(o.k, o.v), big, 800, '#fff');
        s += deltaT(cx + pw - 24, ry + rh / 2 + big * 0.7, o, Math.min(20, big * 0.6), 'end');
        if (hasT(o.k)) s += T(cx + pw - 24, ry + rh / 2 - big * 0.3, 'เกณฑ์ ' + fmtT(o.k), Math.min(15, sm * 0.8), 400, YEL, 'end');
      });
    });
    s += footer(W, H, sources(res));
    return s + '</svg>';
  }

  /* ---- 2A) one image per dimension ---- */
  function svgDim(A, res, p, dn) {
    var W = 1920, H = 1080, ks = res.filter(function (o) { return o.k.dim === dn; }), s = svgOpen(W, H) + defs(A, W, H);
    s += header(A, W, dn, p);
    var n = ks.length, cw = (W - 96 - (n - 1) * 20) / n, big = n > 4 ? 40 : 54;
    ks.forEach(function (o, i) {
      var cx = 48 + i * (cw + 20), cy = 146; s += panel(cx, cy, cw, 190);
      s += T(cx + 22, cy + 42, fit(o.k.name, 18, cw - 40), 18, 600, SOFT);
      s += T(cx + 22, cy + 108, fmt(o.k, o.v), big, 800, '#fff', 'start', 'filter="url(#tglow)"');
      s += deltaT(cx + 22, cy + 158, o, 19);
      if (o.d != null) s += T(cx + 22, cy + 180, 'vs ' + label(prevOf(p)).replace(/\s+\(.*/, ''), 13, 400, MUT);
      if (hasT(o.k) && o.v != null) { var c = o.st > 0 ? GREEN : RED, bw = 112; s += '<rect x="' + (cx + cw - bw - 20) + '" y="' + (cy + 138) + '" width="' + bw + '" height="30" rx="15" fill="' + c + '" fill-opacity=".18" stroke="' + c + '"/>' + T(cx + cw - bw / 2 - 20, cy + 159, o.st > 0 ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์', 15, 700, c, 'middle'); }
    });
    var gw = (W - 96 - 24) / 2, gh = 330, P = [[48, 360], [48 + gw + 24, 360], [48, 360 + gh + 20], [48 + gw + 24, 360 + gh + 20]];
    P.forEach(function (q) { s += panel(q[0], q[1], gw, gh, 18, false); });
    var k0 = ks[0], c0 = k0 && k0.cur;
    /* (1) KPI แรก รายภาค (ถ้าไม่มีภาค ใช้ราย DC ดีสุด 6) */
    if (c0) {
      var reg = c0.region && c0.region.length ? c0.region : sortBy(c0.dc || [], k0.k, false).slice(0, 6), rr = range(reg.map(function (x) { return x[1]; }), k0.k, 0.4);
      s += chartTitle(P[0][0] + 24, P[0][1] + 38, fit(k0.k.name, 21, gw - 60) + (c0.region && c0.region.length ? ' · รายภาค' : ' · ราย DC'), axisNote(k0.k, rr[0]));
      s += hbars(P[0][0] + 24, P[0][1] + 92, gw - 48, gh - 112, reg.slice(0, 12), k0.k, rr[0], rr[1]);
    }
    /* (2) แนวโน้ม */
    var trK = ks.filter(function (o) { return o.trend; }).slice(0, 3), sameU = trK.filter(function (o) { return o.k.unit === trK[0].k.unit; });
    if (trK.length) {
      var cols = [CY, '#b48cff', YEL];
      s += chartTitle(P[1][0] + 24, P[1][1] + 38, 'แนวโน้ม ' + trK[0].trend.length + (p.mode === 'D' ? ' วันทำการ' : p.mode === 'W' ? ' สัปดาห์' : ' เดือน'), hasT(trK[0].k) ? 'เส้นประ = เป้าหมาย' : '');
      sameU.forEach(function (o, i) { var lx = P[1][0] + gw - 24 - (sameU.length - i) * 230; s += '<circle cx="' + (lx + 6) + '" cy="' + (P[1][1] + 32) + '" r="6" fill="' + cols[i] + '"/>' + T(lx + 18, P[1][1] + 38, fit(o.k.name, 14, 200), 14, 400, MUT); });
      s += lineChart(P[1][0] + 90, P[1][1] + 76, gw - 130, gh - 136, sameU.map(function (o) { return { vals: o.trend.map(function (t) { return t.v; }) }; }), trK[0].k, trK[0].trend.map(function (t) { return t.l; }));
    }
    /* (3) DC ต่ำสุด 5 อันดับ ของ KPI แรก */
    if (c0) {
      var w5 = sortBy(bigEnough(c0.dc || []), k0.k, true).slice(0, 5), r5 = range(w5.map(function (x) { return x[1]; }), k0.k, 0.4);
      s += chartTitle(P[2][0] + 24, P[2][1] + 38, 'DC ผลแย่สุด 5 อันดับ · ' + fit(k0.k.name, 21, gw - 300), axisNote(k0.k, r5[0]));
      s += hbars(P[2][0] + 24, P[2][1] + 92, gw - 48, gh - 112, w5, k0.k, r5[0], r5[1]);
    }
    /* (4) เทียบช่วงก่อนหน้า ทุก KPI ในด้าน */
    s += chartTitle(P[3][0] + 24, P[3][1] + 38, 'เทียบช่วงก่อนหน้า', label(prevOf(p)).replace(/\s+\(.*/, '') + ' → ' + label(p).replace(/\s+\(.*/, ''));
    var rowH = (gh - 90) / Math.max(n, 1);
    ks.forEach(function (o, i) {
      var ry = P[3][1] + 80 + i * rowH; s += T(P[3][0] + 24, ry + rowH * 0.42, fit(o.k.name, 16, gw * 0.5), 16, 600, SOFT);
      s += T(P[3][0] + 24, ry + rowH * 0.42 + 26, fmt(o.k, o.pv) + '  →  ' + fmt(o.k, o.v), 20, 800, '#fff');
      s += deltaT(P[3][0] + gw - 24, ry + rowH * 0.42 + 26, o, 20, 'end');
    });
    s += footer(W, H, sources(ks) + (p.mode === 'W' ? ' · สัปดาห์ = จันทร์–เสาร์ (วันอาทิตย์นับในรายเดือนเท่านั้น)' : ''));
    return s + '</svg>';
  }

  /* ---- 2B) one image per KPI ---- */
  function svgKpi(A, o, p) {
    var W = 1920, H = 1080, k = o.k, c = o.cur || {}, s = svgOpen(W, H) + defs(A, W, H);
    s += header(A, W, k.name, p);
    s += panel(48, 146, 560, 560);
    s += T(80, 198, k.dim, 22, 600, SOFT) + T(80, 226, sysName(k.sys), 16, 400, MUT);
    var cx = 328, cy = 430, r = 165;
    if (k.unit === '%') {
      var lo = hasT(k) ? Math.max(0, Math.min(+k.target, o.v || 100) - 10) : 0, hi = 100, a0 = Math.PI * 0.75, span = Math.PI * 1.5;
      if (o.v != null && o.v > 100) hi = Math.ceil(o.v / 10) * 10;
      var arc = function (fr, col, wd) { fr = Math.max(0.001, Math.min(1, fr)); var a1 = a0 + span * fr, x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); return '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (span * fr > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="' + wd + '" stroke-linecap="round"/>'; };
      s += arc(1, 'rgba(255,255,255,.1)', 26);
      if (o.v != null) s += arc((o.v - lo) / (hi - lo), o.st < 0 ? RED : GREEN, 26);
      if (hasT(k)) { var ta = a0 + span * (+k.target - lo) / (hi - lo); s += '<line x1="' + (cx + (r - 24) * Math.cos(ta)).toFixed(0) + '" y1="' + (cy + (r - 24) * Math.sin(ta)).toFixed(0) + '" x2="' + (cx + (r + 24) * Math.cos(ta)).toFixed(0) + '" y2="' + (cy + (r + 24) * Math.sin(ta)).toFixed(0) + '" stroke="' + YEL + '" stroke-width="4"/>'; }
      if (lo > 0) s += T(cx, cy + r + 40, 'หน้าปัดเริ่มที่ ' + lo + '%', 14, 400, MUT, 'middle');
    }
    s += T(cx, cy + 18, fmt(k, o.v), k.unit === '%' ? 70 : 56, 800, '#fff', 'middle', 'filter="url(#tglow)"');
    if (hasT(k)) s += T(cx, cy + 62, 'เกณฑ์ ' + fmtT(k), 20, 600, YEL, 'middle');
    if (o.d != null) s += T(cx, cy + 150, fmtD(k, o.d) + '  เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, ''), 22, 700, o.better > 0 ? GREEN : o.better < 0 ? RED : MUT, 'middle');
    if (c.n && c.n[1] != null) s += T(cx, cy + 186, 'ตัวตั้ง ' + Math.round(c.n[0]).toLocaleString('en-US') + ' / ตัวหาร ' + Math.round(c.n[1]).toLocaleString('en-US'), 17, 400, MUT, 'middle');
    else if (c.note) s += T(cx, cy + 186, c.note, 17, 400, MUT, 'middle');
    var gx = 48 + 560 + 24, gw = W - 96 - 560 - 24;
    s += panel(gx, 146, gw, 270, 18, false);
    if (o.trend) { s += chartTitle(gx + 24, 184, 'แนวโน้ม ' + o.trend.length + (p.mode === 'D' ? ' วันทำการล่าสุด (ไม่นับวันอาทิตย์)' : p.mode === 'W' ? ' สัปดาห์ล่าสุด' : ' เดือนล่าสุด'), ''); s += lineChart(gx + 90, 220, gw - 130, 150, [{ vals: o.trend.map(function (t) { return t.v; }) }], k, o.trend.map(function (t) { return t.l; })); }
    s += panel(gx, 436, gw, 270, 18, false);
    var reg = c.region || [], dcs = bigEnough(c.dc || []), hw = (gw - 72) / 2;
    if (reg.length) { var rr = range(reg.map(function (x) { return x[1]; }), k, 0.4); s += chartTitle(gx + 24, 474, 'รายภาค', axisNote(k, rr[0])); s += hbars(gx + 24, 516, hw, 172, reg.slice(0, 12), k, rr[0], rr[1]); }
    var best = sortBy(dcs, k, false), nb = Math.min(3, Math.floor(best.length / 2)), bw2 = best.slice(0, nb).concat(best.slice(best.length - nb));
    var bx = reg.length ? gx + 24 + hw + 24 : gx + 24, bwid = reg.length ? hw : gw - 48;
    if (bw2.length) { var r2 = range(bw2.map(function (x) { return x[1]; }), k, 0.4); s += chartTitle(bx, 474, 'DC ดีสุด ' + nb + ' / แย่สุด ' + nb, axisNote(k, r2[0])); s += hbars(bx, 516, bwid, 172, bw2, k, r2[0], r2[1]); }
    s += panel(48, 726, W - 96, 290, 18, false);
    var all = sortBy(dcs, k, false), m = Math.min(all.length, 40);
    if (m) {
      var r3 = range(all.map(function (x) { return x[1]; }), k, 0.4), lo3 = r3[0], hi3 = r3[1], bw3 = (W - 96 - 80) / m, base = 960, hh = 170, t3 = hasT(k) ? +k.target : null;
      s += chartTitle(72, 764, 'ทุก DC เรียงจากดีไปแย่ (' + all.length + ' DC' + (all.length > m ? ' แสดง ' + m : '') + ')', axisNote(k, lo3));
      all.slice(0, m).forEach(function (x, i) { var hgt = Math.max(2, hh * (x[1] - lo3) / (hi3 - lo3 || 1)), ok = t3 == null ? (i < m / 2) : (k.dir < 0 ? x[1] <= t3 : x[1] >= t3); s += '<rect x="' + (88 + i * bw3).toFixed(1) + '" y="' + (base - hgt).toFixed(1) + '" width="' + Math.max(2, bw3 - 4).toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="3" fill="' + (ok ? 'url(#barv)' : RED) + '" fill-opacity=".9"/>'; });
      if (t3 != null) { var ty = base - hh * (t3 - lo3) / (hi3 - lo3 || 1); s += '<line x1="80" y1="' + ty + '" x2="' + (W - 72) + '" y2="' + ty + '" stroke="' + YEL + '" stroke-dasharray="6 5" stroke-width="2"/>'; }
      var worst = sortBy(dcs, k, true).slice(0, 3).map(function (x) { return x[0] + ' ' + fmt(k, x[1]); }).join('  ·  ');
      s += T(72, 996, fit('แย่สุด: ' + worst, 18, W - 420), 18, 600, YEL);
    } else s += T(W / 2, 880, 'ระบบนี้ไม่มีข้อมูลแยกราย DC', 20, 400, MUT, 'middle');
    s += footer(W, H, 'ที่มา: ' + sysName(k.sys) + (c.note ? ' · ' + c.note : ''));
    return s + '</svg>';
  }

  /* ---- 3) story 1080×1920 ---- */
  function svgStory(A, res, p) {
    var W = 1080, H = 1920, D = dims(res.map(function (o) { return o.k; })), s = svgOpen(W, H) + defs(A, W, H, 0.45);
    s += logo(A, 68, 28, 1.1) + hud(52, 152, W - 104, 108) + T(W / 2, 236, MODES[p.mode].t, 78, 800, 'url(#gold)', 'middle', 'filter="url(#gglow)" font-style="italic"');
    s += '<rect x="60" y="276" width="' + (W - 120) + '" height="120" rx="18" fill="' + NAVY + '" fill-opacity=".75" stroke="' + YEL + '" stroke-opacity=".8"/>';
    s += '<rect x="84" y="296" width="140" height="36" rx="18" fill="' + YEL + '"/>' + T(154, 322, MODES[p.mode].en, 20, 800, NAVY, 'middle') + T(240, 324, MODES[p.mode].th, 23, 600, YEL);
    s += T(W - 84, 326, fit(label(p).replace(/\s+\(.*/, ''), 32, 460), 32, 800, '#fff', 'end') + T(84, 376, '⇄  เทียบกับ', 22, 600, CY) + T(W - 84, 376, label(prevOf(p)).replace(/\s+\(.*/, ''), 26, 600, SOFT, 'end');
    var tot = res.filter(function (o) { return o.v != null; }).length, ok = res.filter(function (o) { return o.st > 0; }).length;
    s += panel(60, 414, W - 120, 104, 20) + T(100, 482, 'ผ่านเกณฑ์ ' + ok + '/' + tot, 44, 800, '#fff');
    s += '<rect x="560" y="458" width="420" height="22" rx="11" fill="#fff" fill-opacity=".1"/><rect x="560" y="458" width="' + (tot ? 420 * ok / tot : 0).toFixed(0) + '" height="22" rx="11" fill="' + GREEN + '"/>';
    var y = 540, avail = H - y - 110, rowsN = res.length, rh = Math.min(68, (avail - D.length * (66 + 18)) / Math.max(rowsN, 1)), fs = Math.max(16, Math.min(25, rh * 0.37));
    D.forEach(function (dn) {
      var ks = res.filter(function (o) { return o.k.dim === dn; }), h = 62 + ks.length * rh;
      s += panel(60, y, W - 120, h, 20, false) + '<rect x="88" y="' + (y + 24) + '" width="7" height="32" rx="3" fill="' + YEL + '"/>' + T(108, y + 50, dn, 30, 800, '#fff');
      ks.forEach(function (o, j) {
        var ry = y + 58 + j * rh;
        s += dot(104, ry + rh / 2, o.st, 7) + T(130, ry + rh / 2 + fs * 0.38, fit(o.k.name, fs, 540), fs, 400, SOFT);
        s += T(W - 250, ry + rh / 2 + fs * 0.45, fmt(o.k, o.v), fs * 1.28, 800, '#fff', 'end') + deltaT(W - 96, ry + rh / 2 + fs * 0.4, o, fs * 0.95, 'end');
      });
      y += h + 18;
    });
    s += brand(W, H, 1.4);
    return s + '</svg>';
  }

  /* ---------- LINE text ---------- */
  function lineText(res, p, watch) {
    var D = dims(res.map(function (o) { return o.k; })), tot = res.filter(function (o) { return o.v != null; }).length, ok = res.filter(function (o) { return o.st > 0; }).length;
    var t = '📊 NIMEX ' + MODES[p.mode].t + '\n🗓 ' + label(p) + '\n⇄ เทียบกับ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + '\n✅ ผ่านเกณฑ์ ' + ok + '/' + tot + ' ตัวชี้วัด\n';
    D.forEach(function (dn) {
      t += '\n' + dimEmo(dn) + ' ' + dn + '\n';
      res.filter(function (o) { return o.k.dim === dn; }).forEach(function (o) {
        var d = o.d == null ? '' : ' (' + fmtD(o.k, o.d).replace(' pt', '').replace(' ', '') + ')';
        t += (o.st > 0 ? '🟢' : o.st < 0 ? '🔴' : '⚪') + ' ' + o.k.name + ' ' + fmt(o.k, o.v) + d + '\n';
      });
    });
    if (watch && watch.length) t += '\n⚠️ จุดที่ต้องดู\n' + watch.map(function (w) { return '• ' + w; }).join('\n') + '\n';
    t += '\n🔗 ' + location.origin + location.pathname.replace(/#.*/, '') + '\n— Fleet Planning';
    return t;
  }
  function watchList(res) {
    var out = [];
    res.forEach(function (o) {
      if (o.v == null) return;
      var miss = hasT(o.k) && o.st < 0, worse = !hasT(o.k) && o.better < 0;
      if (!miss && !worse && !(o.streak && o.streak.length)) return;
      var line = o.k.name + ' ' + fmt(o.k, o.v) + (miss ? ' (เกณฑ์ ' + fmtT(o.k) + ')' : worse ? ' แย่ลง ' + fmtD(o.k, o.d).replace(/^[▲▼] /, '') : '');
      if (o.streak && o.streak.length) line += ' · ' + o.streak.slice(0, 4).join(', ') + ' ไม่ผ่านเกณฑ์ 3 ' + (o.k && pMode === 'D' ? 'วัน' : pMode === 'W' ? 'สัปดาห์' : 'เดือน') + 'ติด';
      else if (o.cur && o.cur.dc && o.cur.dc.length) { var w = sortBy(bigEnough(o.cur.dc), o.k, true).slice(0, 3).map(function (x) { return x[0]; }); if (w.length) line += ' · แย่สุด: ' + w.join(', '); }
      out.push(line);
    });
    return out.slice(0, 8);
  }
  var pMode = 'D';

  /* ---------- PNG / ZIP / PPTX ---------- */
  function svgToPng(svg, scale) {
    return new Promise(function (res, rej) {
      var m = svg.match(/width="(\d+)" height="(\d+)"/), W = +m[1], H = +m[2], img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = function () { var c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; var x = c.getContext('2d'); x.scale(scale, scale); x.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png'); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('สร้างภาพไม่สำเร็จ')); };
      img.src = url;
    });
  }
  function saveBlob(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function b64(blob) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(blob); }); }

  /* ================= UI ================= */
  var UI = ls(LSK) || {};
  UI.mode = UI.mode || 'D'; UI.out = UI.out || { sum: 1, dim: 0, kpi: 0 }; UI.off = UI.off || {};
  var SLIDES = [], LAST = null;
  function saveUI() { ls(LSK, { mode: UI.mode, out: UI.out, off: UI.off }); }
  function modeKpis(mode) { return kpis().filter(function (k) { return k.on !== false && String(k.modes || '').indexOf(mode) >= 0; }); }
  function picked() { return modeKpis(UI.mode).filter(function (k) { return !UI.off[k.id]; }); }
  function latestAll(mode) {
    var ls2 = Object.keys(ST).filter(function (s) { return ST[s].state === 'ready' && ST[s].latest; }).filter(function (s) { return modeKpis(mode).some(function (k) { return k.sys === s; }); }).map(function (s) { return ST[s].latest; }).sort();
    return ls2.length ? ls2[ls2.length - 1] : iso(new Date());
  }
  function defaultRef(mode) {
    var L = latestAll(mode);
    if (mode === 'D') return dow(L) === 0 ? prevWork(L) : L;
    if (mode === 'W') return dow(L) === 6 ? L : addD(monday(L), -7);
    return L === monthEnd(L) ? L : prevMonth(L);
  }
  function curPeriod() { return period(UI.mode, UI.ref || defaultRef(UI.mode)); }

  function build() {
    if ($('rep')) return;
    var d = document.createElement('div'); d.id = 'rep'; d.className = 'rep'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'ศูนย์รายงาน');
    d.innerHTML = '<div class="rep-in"><header class="rep-h"><h2>ศูนย์รายงาน <small>สรุปผลสำหรับประชุมและนำเสนอ</small></h2><div class="rep-tabs"><button type="button" data-tab="make" class="on">สร้างรายงาน</button><button type="button" data-tab="set">ตั้งค่า KPI</button></div><button type="button" class="rep-x" aria-label="ปิด">✕</button></header>' +
      '<div class="rep-b" id="repMake"></div><div class="rep-b" id="repSet" hidden></div></div>' +
      '<div class="rep-show" id="repShow" hidden><img alt=""><div class="rep-nav"><button type="button" data-go="-1" aria-label="ก่อนหน้า">‹</button><span></span><button type="button" data-go="1" aria-label="ถัดไป">›</button><button type="button" data-go="x" aria-label="ปิด">✕</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('.rep-x').onclick = close;
    [].forEach.call(d.querySelectorAll('[data-tab]'), function (b) { b.onclick = function () { [].forEach.call(d.querySelectorAll('[data-tab]'), function (x) { x.classList.toggle('on', x === b); }); $('repMake').hidden = b.dataset.tab !== 'make'; $('repSet').hidden = b.dataset.tab !== 'set'; if (b.dataset.tab === 'set') renderSet(); }; });
    document.addEventListener('keydown', function (e) { if (!$('rep') || $('rep').hidden) return; if (!$('repShow').hidden) { if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') show(SHOW.i + 1); else if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(SHOW.i - 1); else if (e.key === 'Escape') hideShow(); return; } if (e.key === 'Escape') close(); });
  }
  function open() { build(); $('rep').hidden = false; document.body.style.overflow = 'hidden'; ensure(Object.keys(sysNeeded())); renderMake(); }
  function close() { $('rep').hidden = true; document.body.style.overflow = ''; }
  function sysNeeded() { var o = {}; kpis().forEach(function (k) { if (k.on !== false && AD[k.sys]) o[k.sys] = 1; }); return o; }

  function renderStatus() {
    var el = $('repStatus'); if (!el) return;
    el.innerHTML = Object.keys(sysNeeded()).map(function (s) {
      var x = ST[s] || { state: 'loading' }, cls = x.state === 'ready' ? 'ok' : x.state === 'error' ? 'bad' : 'wait';
      return '<span class="rs ' + cls + '" title="' + esc(x.msg || '') + '">' + (x.state === 'ready' ? '✓' : x.state === 'error' ? '!' : '…') + ' ' + esc(sysName(s)) + (x.latest ? ' <small>ถึง ' + dTh(x.latest, 0) + '</small>' : x.state === 'loading' ? ' <small>กำลังโหลด</small>' : '') + '</span>';
    }).join('');
    if (!UI.refTouched) { var b = $('repRef'); if (b) setRefInput(); }
    renderPer();
  }
  function setRefInput() {
    var ref = UI.ref || defaultRef(UI.mode), inp = $('repRef');
    if (UI.mode === 'M') { inp.type = 'month'; inp.value = ref.slice(0, 7); } else { inp.type = 'date'; inp.value = ref; }
  }
  function renderPer() { var el = $('repPer'); if (!el) return; var p = curPeriod(); el.innerHTML = '<span class="pm">' + MODES[p.mode].en + '</span><b>' + esc(MODES[p.mode].th) + '</b><span class="pv">' + esc(label(p)) + '</span><span class="pc">⇄ เทียบกับ <b>' + esc(label(prevOf(p))) + '</b></span>'; }

  function renderMake() {
    var el = $('repMake'), list = modeKpis(UI.mode), D = dims(list);
    el.innerHTML = '<div class="rep-row"><div class="seg rep-mode">' + ['D', 'W', 'M'].map(function (m) { return '<button type="button" data-m="' + m + '"' + (UI.mode === m ? ' class="on"' : '') + '>' + MODES[m].t + '</button>'; }).join('') + '</div>' +
      '<label class="rep-date">' + (UI.mode === 'M' ? 'เดือน' : UI.mode === 'W' ? 'วันใดก็ได้ในสัปดาห์' : 'วันที่') + ' <input id="repRef"></label><button type="button" class="btn sec" id="repLatest">ล่าสุด</button></div>' +
      '<div class="rep-per" id="repPer"></div><div class="rep-status" id="repStatus"></div>' +
      '<div class="rep-cols"><section class="rep-pick"><h3>เลือกตัวชี้วัด <small>' + list.length + ' ตัวที่มีรายงาน' + MODES[UI.mode].th.replace('รายงานประจำ', '') + '</small></h3>' +
      D.map(function (dn) {
        var ks = list.filter(function (k) { return k.dim === dn; }), on = ks.filter(function (k) { return !UI.off[k.id]; }).length;
        return '<fieldset><legend><label><input type="checkbox" data-dim="' + esc(dn) + '"' + (on === ks.length ? ' checked' : '') + '> ' + dimEmo(dn) + ' ' + esc(dn) + '</label></legend>' +
          ks.map(function (k) { return '<label class="rk"><input type="checkbox" data-k="' + k.id + '"' + (UI.off[k.id] ? '' : ' checked') + '> ' + esc(k.name) + ' <small>' + esc(sysName(k.sys)) + (hasT(k) ? ' · เกณฑ์ ' + esc(fmtT(k)) : '') + '</small></label>'; }).join('') + '</fieldset>';
      }).join('') +
      (kpis().filter(function (k) { return k.on !== false && String(k.modes || '').indexOf(UI.mode) < 0; }).length ? '<p class="rep-note">ตัวชี้วัดที่ไม่มีรายงาน' + MODES[UI.mode].th.replace('รายงานประจำ', '') + ' (ตามตาราง KPI) ไม่แสดงในรายการนี้ · แก้ได้ที่แท็บ "ตั้งค่า KPI"</p>' : '') +
      '</section><section class="rep-outp"><h3>รูปแบบ</h3>' +
      [['sum', 'สรุปหน้าเดียว ครบทุกด้าน'], ['dim', 'รูปแยกตามด้าน (1 รูป / 1 ด้าน)'], ['kpi', 'รูปแยกตาม KPI (1 รูป / 1 ตัวชี้วัด)']].map(function (o) { return '<label class="rk"><input type="checkbox" data-out="' + o[0] + '"' + (UI.out[o[0]] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') +
      '<button type="button" class="btn pri wide" id="repGo">สร้างตัวอย่าง</button><div class="rep-msg" id="repMsg" role="status"></div>' +
      '<div class="rep-exp" id="repExp" hidden><h3>แชร์ / ส่งออก</h3><button type="button" class="btn" data-x="png">PNG 16:9</button><button type="button" class="btn" data-x="story">PNG แนวตั้ง 1080×1920</button><button type="button" class="btn" data-x="pptx">PowerPoint</button><button type="button" class="btn" data-x="line">ข้อความ LINE</button><button type="button" class="btn pri" data-x="show">ฉายเต็มจอ</button></div>' +
      '</section></div><div class="rep-prev" id="repPrev"></div><div class="rep-line" id="repLine" hidden><textarea id="repTxt" rows="14" aria-label="ข้อความสรุปสำหรับ LINE"></textarea><button type="button" class="btn pri" id="repCopy">คัดลอกข้อความ</button></div>';
    [].forEach.call(el.querySelectorAll('[data-m]'), function (b) { b.onclick = function () { UI.mode = b.dataset.m; UI.ref = null; UI.refTouched = false; saveUI(); renderMake(); }; });
    setRefInput(); renderStatus();
    $('repRef').onchange = function () { var v = this.value; if (!v) return; UI.ref = UI.mode === 'M' ? v + '-01' : v; UI.refTouched = true; renderPer(); };
    $('repLatest').onclick = function () { UI.ref = null; UI.refTouched = false; setRefInput(); renderPer(); };
    [].forEach.call(el.querySelectorAll('[data-k]'), function (c) { c.onchange = function () { if (c.checked) delete UI.off[c.dataset.k]; else UI.off[c.dataset.k] = 1; saveUI(); renderMake(); }; });
    [].forEach.call(el.querySelectorAll('[data-dim]'), function (c) { c.onchange = function () { list.filter(function (k) { return k.dim === c.dataset.dim; }).forEach(function (k) { if (c.checked) delete UI.off[k.id]; else UI.off[k.id] = 1; }); saveUI(); renderMake(); }; });
    [].forEach.call(el.querySelectorAll('[data-out]'), function (c) { c.onchange = function () { UI.out[c.dataset.out] = c.checked ? 1 : 0; saveUI(); }; });
    $('repGo').onclick = generate;
    [].forEach.call(el.querySelectorAll('[data-x]'), function (b) { b.onclick = function () { doExport(b.dataset.x, b); }; });
    $('repCopy').onclick = function () { var t = $('repTxt'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(function () { APP().toast('คัดลอกข้อความแล้ว'); }).catch(function () { document.execCommand('copy'); APP().toast('คัดลอกข้อความแล้ว'); }); };
    if (LAST && LAST.mode === UI.mode) showPreview();
  }
  function msg(t, bad) { var m = $('repMsg'); if (m) { m.textContent = t; m.classList.toggle('bad', !!bad); } }

  function generate() {
    var list = picked(); if (!list.length) return msg('ยังไม่ได้เลือกตัวชี้วัด', true);
    if (!UI.out.sum && !UI.out.dim && !UI.out.kpi) return msg('เลือกรูปแบบอย่างน้อย 1 แบบ', true);
    var p = curPeriod(); pMode = p.mode; $('repGo').disabled = true; msg('กำลังรอข้อมูลจากระบบ…');
    var syss = {}; list.forEach(function (k) { syss[k.sys] = 1; });
    ensure(Object.keys(syss)).then(function () {
      msg('กำลังคำนวณ ' + list.length + ' ตัวชี้วัด…');
      return compute(list, p, { trend: !!(UI.out.dim || UI.out.kpi) });
    }).then(function (res) { return streaks(res, p); }).then(function (res) {
      return assets().then(function (A) {
        var D = dims(list); SLIDES = [];
        if (UI.out.sum) SLIDES.push({ name: fileTag(p) + '_summary', t: 'สรุปภาพรวม', svg: svgSummary(A, res, p) });
        if (UI.out.dim) D.forEach(function (dn, i) { SLIDES.push({ name: fileTag(p) + '_dim' + (i + 1), t: dn, svg: svgDim(A, res, p, dn) }); });
        if (UI.out.kpi) res.forEach(function (o, i) { SLIDES.push({ name: fileTag(p) + '_kpi' + (i + 1), t: o.k.name, svg: svgKpi(A, o, p) }); });
        var watch = watchList(res);
        LAST = { mode: p.mode, p: p, res: res, story: { name: fileTag(p) + '_story', svg: svgStory(A, res, p) }, line: lineText(res, p, watch) };
        var miss = res.filter(function (o) { return o.v == null; });
        msg('สร้างแล้ว ' + SLIDES.length + ' ภาพ' + (miss.length ? ' · ไม่มีข้อมูลในช่วงนี้ ' + miss.length + ' ตัว: ' + miss.map(function (o) { return o.k.name; }).slice(0, 3).join(', ') + (miss.length > 3 ? '…' : '') : ''));
        showPreview();
      });
    }).catch(function (e) { console.error(e); msg('สร้างรายงานไม่สำเร็จ: ' + (e && e.message || e), true); }).then(function () { $('repGo').disabled = false; });
  }
  function svgUrl(svg) { return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); }
  function showPreview() {
    var el = $('repPrev'); if (!el || !LAST) return; $('repExp').hidden = false;
    el.innerHTML = SLIDES.concat([{ t: 'แนวตั้ง (สตอรี่)', svg: LAST.story.svg, story: 1 }]).map(function (s, i) { return '<figure class="' + (s.story ? 'st' : '') + '"><button type="button" data-show="' + (s.story ? -1 : i) + '"><img src="' + svgUrl(s.svg) + '" alt="' + esc(s.t) + '" loading="lazy"></button><figcaption>' + esc(s.t) + '</figcaption></figure>'; }).join('');
    [].forEach.call(el.querySelectorAll('[data-show]'), function (b) { b.onclick = function () { var i = +b.dataset.show; if (i < 0) showStory(); else startShow(i); }; });
  }

  /* fullscreen show */
  var SHOW = { i: 0, list: [] };
  function startShow(i) {
    if (!SLIDES.length) return; SHOW.list = SLIDES; var el = $('repShow'); el.hidden = false; el.classList.remove('story');
    if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    show(i || 0);
    [].forEach.call(el.querySelectorAll('[data-go]'), function (b) { b.onclick = function (e) { e.stopPropagation(); if (b.dataset.go === 'x') hideShow(); else show(SHOW.i + +b.dataset.go); }; });
    var x0 = null; el.ontouchstart = function (e) { x0 = e.touches[0].clientX; }; el.ontouchend = function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(SHOW.i + (dx < 0 ? 1 : -1)); x0 = null; };
    el.querySelector('img').onclick = function () { show(SHOW.i + 1); };
  }
  function showStory() { SHOW.list = [{ svg: LAST.story.svg, t: 'แนวตั้ง' }]; var el = $('repShow'); el.hidden = false; el.classList.add('story'); show(0); [].forEach.call(el.querySelectorAll('[data-go]'), function (b) { b.onclick = function (e) { e.stopPropagation(); if (b.dataset.go === 'x') hideShow(); }; }); }
  function show(i) { var L = SHOW.list; if (!L.length) return; SHOW.i = Math.max(0, Math.min(L.length - 1, i)); var el = $('repShow'), img = el.querySelector('img'); if (img.dataset.u) URL.revokeObjectURL(img.dataset.u); img.dataset.u = img.src = svgUrl(L[SHOW.i].svg); el.querySelector('.rep-nav span').textContent = (SHOW.i + 1) + ' / ' + L.length + ' · ' + L[SHOW.i].t; }
  function hideShow() { $('repShow').hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); }

  function doExport(x, btn) {
    if (!LAST) return;
    if (x === 'show') return startShow(0);
    if (x === 'line') { $('repLine').hidden = false; $('repTxt').value = LAST.line; $('repTxt').focus(); return; }
    btn.disabled = true; var old = btn.textContent; btn.textContent = 'กำลังสร้าง…';
    var job;
    if (x === 'story') job = svgToPng(LAST.story.svg, 1).then(function (b) { saveBlob(b, 'NIMEX_' + LAST.story.name + '.png'); });
    else if (x === 'png') job = SLIDES.length === 1 ? svgToPng(SLIDES[0].svg, 2).then(function (b) { saveBlob(b, 'NIMEX_' + SLIDES[0].name + '.png'); }) :
      (window.JSZip ? Promise.resolve() : loadLib(CDN.zip)).then(function () { var z = new window.JSZip(); return SLIDES.reduce(function (ch, s) { return ch.then(function () { return svgToPng(s.svg, 2).then(function (b) { z.file('NIMEX_' + s.name + '.png', b); }); }); }, Promise.resolve()).then(function () { return z.generateAsync({ type: 'blob' }); }).then(function (b) { saveBlob(b, 'NIMEX_' + fileTag(LAST.p) + '_images.zip'); }); });
    else if (x === 'pptx') job = (window.PptxGenJS ? Promise.resolve() : loadLib(CDN.pptx)).then(function () {
      var P = new window.PptxGenJS(); P.layout = 'LAYOUT_WIDE'; P.title = 'NIMEX ' + MODES[LAST.p.mode].t + ' · ' + label(LAST.p); P.company = 'Fleet Planning';
      return SLIDES.reduce(function (ch, s) { return ch.then(function () { return svgToPng(s.svg, 1).then(b64).then(function (d) { var sl = P.addSlide(); sl.background = { color: '040B22' }; sl.addImage({ data: d, x: 0, y: 0, w: 13.333, h: 7.5 }); sl.addNotes(s.t + ' · ' + label(LAST.p) + ' เทียบกับ ' + label(prevOf(LAST.p))); }); }); }, Promise.resolve()).then(function () { return P.writeFile({ fileName: 'NIMEX_' + fileTag(LAST.p) + '.pptx' }); });
    });
    job.then(function () { APP().toast('บันทึกไฟล์แล้ว'); }).catch(function (e) { console.error(e); APP().toast('ส่งออกไม่สำเร็จ: ' + (e && e.message || e), true); }).then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ---------- KPI settings ---------- */
  var EDIT = null;
  function renderSet() {
    var el = $('repSet'); if (!EDIT) EDIT = clone(kpis());
    var mopt = function (k) { var a = AD[k.sys]; return a ? Object.keys(a.metrics).map(function (m) { return '<option value="' + m + '"' + (m === k.key ? ' selected' : '') + '>' + esc(a.metrics[m].name) + '</option>'; }).join('') : ''; };
    var sopt = function (k) { return Object.keys(AD).map(function (s) { return '<option value="' + s + '"' + (s === k.sys ? ' selected' : '') + '>' + esc(sysName(s)) + '</option>'; }).join(''); };
    el.innerHTML = '<p class="rep-note">แก้ชื่อ ด้าน เป้า (เกณฑ์ผ่าน) ทิศทาง และช่วงเวลาที่มีรายงานได้ · ช่องเป้าว่าง = แสดงเฉพาะผลเทียบช่วงก่อนหน้า (ดีขึ้นเขียว แย่ลงแดง) · เพิ่ม KPI ได้จากตัวชี้วัดที่ระบบเชื่อมไว้ (ระบบใหม่ต้องเพิ่มตัวเชื่อมใน adapters.js)</p>' +
      '<datalist id="repDims">' + dims(EDIT).map(function (d) { return '<option value="' + esc(d) + '">'; }).join('') + '</datalist>' +
      '<div class="rep-tw"><table class="rep-t"><thead><tr><th>ใช้</th><th>ด้าน</th><th>ชื่อ KPI</th><th>ระบบ / ตัวชี้วัด</th><th>ช่วงเวลา</th><th>หน่วย</th><th>ทิศทาง</th><th>เกณฑ์ผ่าน</th><th></th></tr></thead><tbody>' +
      EDIT.map(function (k, i) {
        return '<tr data-i="' + i + '"><td><input type="checkbox" data-f="on"' + (k.on === false ? '' : ' checked') + ' aria-label="ใช้"></td>' +
          '<td><input data-f="dim" list="repDims" value="' + esc(k.dim) + '" maxlength="40"></td><td><input data-f="name" value="' + esc(k.name) + '" maxlength="80"></td>' +
          '<td><select data-f="sys">' + sopt(k) + '</select><select data-f="key">' + mopt(k) + '</select></td>' +
          '<td class="nw">' + ['D', 'W', 'M'].map(function (m) { return '<label><input type="checkbox" data-mode="' + m + '"' + (String(k.modes || '').indexOf(m) >= 0 ? ' checked' : '') + '>' + m + '</label>'; }).join(' ') + '</td>' +
          '<td><select data-f="unit">' + [['%', '%'], ['baht', 'บาท'], ['min', 'นาที'], ['num', 'จำนวน']].map(function (u) { return '<option value="' + u[0] + '"' + (k.unit === u[0] ? ' selected' : '') + '>' + u[1] + '</option>'; }).join('') + '</select></td>' +
          '<td><select data-f="dir"><option value="1"' + (k.dir >= 0 ? ' selected' : '') + '>สูง = ดี</option><option value="-1"' + (k.dir < 0 ? ' selected' : '') + '>ต่ำ = ดี</option></select></td>' +
          '<td><input data-f="target" type="number" step="any" value="' + (hasT(k) ? +k.target : '') + '" placeholder="ไม่มี" style="width:90px"></td>' +
          '<td class="nw"><button type="button" class="act" data-up="' + i + '" title="ขึ้น">↑</button><button type="button" class="act" data-del="' + i + '" title="ลบ">✕</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="rep-row"><button type="button" class="btn sec" id="repAdd">+ เพิ่ม KPI</button><button type="button" class="btn sec" id="repReset">คืนค่าเริ่มต้น</button><span style="flex:1"></span><button type="button" class="btn pri" id="repSave">บันทึก (ผู้ดูแลทุกเครื่องเห็นเหมือนกัน)</button></div>';
    [].forEach.call(el.querySelectorAll('tr[data-i]'), function (tr) {
      var k = EDIT[+tr.dataset.i];
      [].forEach.call(tr.querySelectorAll('[data-f]'), function (inp) { inp.onchange = function () { var f = inp.dataset.f, v = inp.type === 'checkbox' ? inp.checked : inp.value; if (f === 'dir') v = +v; if (f === 'target') v = v === '' ? null : +v; if (f === 'on') v = !!v; k[f] = v; if (f === 'sys') { var a = AD[v]; k.key = a ? Object.keys(a.metrics)[0] : ''; renderSet(); } if (f === 'key') { var m = AD[k.sys].metrics[v]; if (m) { k.unit = m.unit; k.dir = m.dir; } renderSet(); } }; });
      [].forEach.call(tr.querySelectorAll('[data-mode]'), function (c) { c.onchange = function () { k.modes = ['D', 'W', 'M'].filter(function (m) { return tr.querySelector('[data-mode="' + m + '"]').checked; }).join(''); }; });
    });
    [].forEach.call(el.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { EDIT.splice(+b.dataset.del, 1); renderSet(); }; });
    [].forEach.call(el.querySelectorAll('[data-up]'), function (b) { b.onclick = function () { var i = +b.dataset.up; if (i > 0) { var t = EDIT[i]; EDIT[i] = EDIT[i - 1]; EDIT[i - 1] = t; renderSet(); } }; });
    $('repAdd').onclick = function () { var s = Object.keys(AD)[0], m = Object.keys(AD[s].metrics)[0], md = AD[s].metrics[m]; EDIT.push({ id: 'k' + Date.now().toString(36), dim: EDIT.length ? EDIT[EDIT.length - 1].dim : 'ด้านใหม่', sys: s, key: m, name: md.name, modes: 'DWM', unit: md.unit, dir: md.dir, target: null, on: true }); renderSet(); };
    $('repReset').onclick = function () { if (confirm('คืนค่ารายการ KPI เป็นค่าเริ่มต้นจากไฟล์ config.js?')) { EDIT = clone(window.HUB_KPIS); renderSet(); } };
    $('repSave').onclick = function () {
      var bad = EDIT.filter(function (k) { return !k.name || !k.dim || !k.modes; });
      if (bad.length) return APP().toast('กรอกชื่อ ด้าน และช่วงเวลาให้ครบทุกแถว', true);
      var val = EDIT.map(function (k) { return { id: String(k.id).slice(0, 30), dim: String(k.dim).slice(0, 40), sys: k.sys, key: k.key, name: String(k.name).slice(0, 80), modes: k.modes, unit: k.unit, dir: k.dir < 0 ? -1 : 1, target: hasT(k) ? +k.target : null, on: k.on !== false }; });
      APP().save({ kpis: val }, 'บันทึกตาราง KPI แล้ว').then(function (ok) { if (ok !== false) { window.HUB_SHARED_KPIS = val; CACHE = {}; EDIT = null; renderSet(); } });
    };
  }

  window.HUB_REPORT = { open: open, onShared: function () { EDIT = null; }, _calc: calc, _period: period };
})();
