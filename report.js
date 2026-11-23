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
    return res.filter(function (o) { return (hasT(o.k) || o.st < 0) && o.cur && o.cur.dc && o.cur.dc.length; }).reduce(function (ch, o) {
      return ch.then(function () {
        return Promise.all(ps.map(function (x) { return calc(o.k, x); })).then(function (rs) {
          var sets = rs.map(function (r) { var m = {}, t = hasT(o.k) ? +o.k.target : r && r.v; if (t == null) return m; (r && r.dc || []).forEach(function (x) { if (x[1] != null && (o.k.dir < 0 ? x[1] > t : x[1] < t) && (x[2] == null || x[2] >= 5)) m[x[0]] = 1; }); return m; });
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
  /* ธีมภาพ: neon = แบบเดิม (ภาพพื้นหลัง+แสงเรือง) · light = Clean Light (พื้นขาว) · navy = Navy Flat (กรมท่าเรียบ) */
  var THEMES = {
    neon: { CY: '#38c8ff', PANEL: 'rgba(8,24,64,.80)', GREEN: '#22e08a', RED: '#ff4d5e', YEL: '#ffc20e', MUT: '#8fb3dd', SOFT: '#d6e6ff', GREY: '#7d8fae', INK: INK, TRK: INK, SOFT2: SOFT2, BGC: '#040b22', PSTROKE: '#38c8ff', PSOP: 0.55, PERBG: '#040b22', PERSTROKE: '#ffc20e', TITLEC: 'url(#gold)', BRAND: 'url(#gold)', BAR0: '#1b6dff', BAR1: '#38c8ff', TRK10: TRK10 },
    light: { CY: '#0b2a5b', PANEL: '#ffffff', GREEN: '#1a8f4c', RED: '#d33a3a', YEL: '#c9971c', MUT: '#6b7a90', SOFT: '#3a4558', GREY: '#9aa6b8', INK: '#0d1626', TRK: '#0b2a5b', SOFT2: '#2a3446', BGC: '#ffffff', PSTROKE: '#d9e0eb', PSOP: 1, PERBG: '#ffffff', PERSTROKE: '#0b2a5b', TITLEC: '#0b2a5b', BRAND: '#c9971c', BAR0: '#2c5aa8', BAR1: '#0b2a5b', TRK10: 'rgba(11,42,91,.10)' },
    navy: { CY: '#7fb2ff', PANEL: '#132a55', GREEN: '#3ddc84', RED: '#ff6b6b', YEL: '#f2c14e', MUT: '#9fb0cc', SOFT: '#c9d5ea', GREY: '#7d8fae', INK: '#ffffff', TRK: '#ffffff', SOFT2: '#dfe8f7', BGC: '#0a1a3a', PSTROKE: '#132a55', PSOP: 0, PERBG: '#132a55', PERSTROKE: '#132a55', TITLEC: '#f2c14e', BRAND: '#f2c14e', BAR0: '#4f8ef7', BAR1: '#7fb2ff', TRK10: 'rgba(255,255,255,.12)' }
  };
  var TH = 'neon', NAVY = '#040b22', CY, PANEL, GREEN, RED, YEL, MUT, SOFT, GREY, INK, TRK, SOFT2, BGC, PSTROKE, PSOP, PERBG, PERSTROKE, TITLEC, BRAND, BAR0, BAR1, TRK10;
  function setTheme(t) { TH = THEMES[t] ? t : 'neon'; var o = THEMES[TH]; CY = o.CY; PANEL = o.PANEL; GREEN = o.GREEN; RED = o.RED; YEL = o.YEL; MUT = o.MUT; SOFT = o.SOFT; GREY = o.GREY; INK = o.INK; TRK = o.TRK; SOFT2 = o.SOFT2; BGC = o.BGC; PSTROKE = o.PSTROKE; PSOP = o.PSOP; PERBG = o.PERBG; PERSTROKE = o.PERSTROKE; TITLEC = o.TITLEC; BRAND = o.BRAND; BAR0 = o.BAR0; BAR1 = o.BAR1; TRK10 = o.TRK10; }
  setTheme('neon');
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
  function T(x, y, s, size, w, fill, anchor, extra) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="' + (w || 400) + '" fill="' + (fill || INK) + '" text-anchor="' + (anchor || 'start') + '" ' + (extra || '') + '>' + esc(s) + '</text>'; }
  /* shrink a label to fit width (approx. glyph width 0.56em for Thai/Latin mix) */
  function fit(s, size, w) { s = String(s); var max = Math.floor(w / (size * 0.56)); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s; }
  /* wrap text into lines that fit width (breaks at spaces; Thai without spaces breaks hard) */
  function wrap(str, size, w, maxLines) {
    var max = Math.floor(w / (size * 0.56)), words = String(str).split(' '), out = [], cur = '';
    words.forEach(function (wd) { if ((cur + ' ' + wd).trim().length <= max) cur = (cur + ' ' + wd).trim(); else { if (cur) out.push(cur); while (wd.length > max) { out.push(wd.slice(0, max)); wd = wd.slice(max); } cur = wd; } });
    if (cur) out.push(cur);
    if (maxLines && out.length > maxLines) { out = out.slice(0, maxLines); out[maxLines - 1] = fit(out[maxLines - 1] + '…', size, w); }
    return out;
  }
  function panel(x, y, w, h, r, glow) { r = r || 18; if (TH !== 'neon') return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + PANEL + '" stroke="' + PSTROKE + '" stroke-opacity="' + PSOP + '" stroke-width="2"/>'; return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + PANEL + '" stroke="' + CY + '" stroke-opacity=".55" stroke-width="1.5"' + (glow === false ? '' : ' filter="url(#glow)"') + '/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (w - 2) + '" height="' + (h - 2) + '" rx="' + r + '" fill="none" stroke="' + TRK + '" stroke-opacity=".05"/>'; }
  function defs(A, W, H, bgop) {
    if (TH !== 'neon') return '<defs><style>' + A.css + ' text{font-family:Prompt,sans-serif}</style>' +
      '<filter id="glow"><feMerge><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="gglow"><feMerge><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="tglow"><feMerge><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<linearGradient id="gold"><stop offset="0" stop-color="' + TITLEC + '"/><stop offset="1" stop-color="' + TITLEC + '"/></linearGradient>' +
      '<linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="' + BAR0 + '"/><stop offset="1" stop-color="' + BAR1 + '"/></linearGradient>' +
      '<linearGradient id="barv" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + BAR0 + '"/><stop offset="1" stop-color="' + BAR1 + '"/></linearGradient>' +
      '<linearGradient id="hline"><stop offset="0" stop-color="' + YEL + '"/><stop offset="1" stop-color="' + YEL + '"/></linearGradient>' +
      '</defs><rect width="' + W + '" height="' + H + '" fill="' + BGC + '"/>';
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
  function logo(A, x, y, s) { var w = 112 * s, h = 72 * s; return '<rect x="' + (x - 8 * s) + '" y="' + (y - 6 * s) + '" width="' + (w + 16 * s) + '" height="' + (h + 12 * s) + '" rx="' + 12 * s + '" fill="#fff" fill-opacity=".96" stroke="' + (TH === 'light' ? '#d9e0eb' : CY) + '" stroke-opacity=".6"/><image href="' + A.logo + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet"/>'; }
  function hud(x, y, w, h, c) {
    c = c || 18; var L = 34;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + c + '" fill="#0a1a44" fill-opacity=".65" stroke="' + YEL + '" stroke-opacity=".45" stroke-width="1.5"/>' +
      '<path d="M' + x + ' ' + (y + L) + ' V' + (y + c) + ' Q' + x + ' ' + y + ' ' + (x + c) + ' ' + y + ' H' + (x + L + 20) + ' M' + (x + w - L - 20) + ' ' + y + ' H' + (x + w - c) + ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + c) + ' V' + (y + L) + ' M' + (x + w) + ' ' + (y + h - L) + ' V' + (y + h - c) + ' Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - c) + ' ' + (y + h) + ' H' + (x + w - L - 20) + ' M' + (x + L + 20) + ' ' + (y + h) + ' H' + (x + c) + ' Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - c) + ' V' + (y + h - L) + '" fill="none" stroke="url(#gold)" stroke-width="4" filter="url(#gglow)"/>' +
      '<rect x="' + (x + w / 2 - 90) + '" y="' + (y + h - 2) + '" width="180" height="4" rx="2" fill="url(#hline)"/>';
  }
  function perBox(x, y, w, p, s) {
    s = s || 1; var m = MODES[p.mode], h = 88 * s;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + 14 * s + '" fill="' + PERBG + '" fill-opacity="' + (TH === 'neon' ? 0.75 : 1) + '" stroke="' + PERSTROKE + '" stroke-width="' + (TH === 'light' ? 2 : 1) + '" stroke-opacity="' + (TH === 'navy' ? 0 : 0.8) + '"/>' +
      '<rect x="' + (x + 14 * s) + '" y="' + (y + 12 * s) + '" width="' + 118 * s + '" height="' + 30 * s + '" rx="' + 15 * s + '" fill="' + (TH === 'light' ? CY : YEL) + '"/>' + T(x + 73 * s, y + 33 * s, m.en, 16 * s, 800, TH === 'light' ? '#fff' : NAVY, 'middle') +
      T(x + 146 * s, y + 35 * s, m.th, 20 * s, 600, YEL) + T(x + w - 14 * s, y + 36 * s, label(p), 25 * s, 800, INK, 'end') +
      '<line x1="' + (x + 14 * s) + '" y1="' + (y + 50 * s) + '" x2="' + (x + w - 14 * s) + '" y2="' + (y + 50 * s) + '" stroke="' + TRK + '" stroke-opacity=".12"/>' +
      T(x + 16 * s, y + 78 * s, '⇄  เทียบกับ', 18 * s, 600, CY) + T(x + w - 14 * s, y + 78 * s, label(prevOf(p)), 20 * s, 600, SOFT, 'end');
  }
  function header(A, W, title, p) {
    if (TH !== 'neon') return (TH === 'light' ? '<rect x="0" y="0" width="' + W + '" height="124" fill="#f5f7fb"/>' : '') + logo(A, 56, 26, 1) +
      '<rect x="214" y="32" width="6" height="64" rx="3" fill="' + YEL + '"/>' + T(238, 82, fit(title, 42, W - 238 - 48 - 680), 42, 800, TITLEC) +
      perBox(W - 48 - 640, 18, 640, p) + '<rect x="0" y="124" width="' + W + '" height="4" fill="' + YEL + '"/>';
    var tw = Math.min(Math.max(title.length * 29 + 80, 420), W - 246 - 48 - 676);
    return logo(A, 56, 26, 1) + hud(246, 20, tw, 86, 16) + T(246 + tw / 2, 80, fit(title, 44, tw - 40), 44, 800, 'url(#gold)', 'middle', 'filter="url(#gglow)" font-style="italic"') +
      perBox(W - 48 - 640, 18, 640, p) + '<rect x="0" y="122" width="' + W + '" height="2" fill="url(#hline)"/>';
  }
  function brand(W, H, s) { s = s || 1; return T(W - 48 * s, H - 26 * s, 'Fleet Planning', 30 * s, 800, BRAND, 'end', 'font-style="italic" filter="url(#gglow)" letter-spacing="0.5"') + '<rect x="' + (W - 284 * s) + '" y="' + (H - 18 * s) + '" width="' + 236 * s + '" height="' + 3 * s + '" rx="2" fill="url(#hline)"/>'; }
  function footer(W, H, txt) { return T(48, H - 24, fit(txt, 16, W - 420), 16, 400, MUT) + brand(W, H); }
  function dot(x, y, st, r) { var c = st > 0 ? GREEN : st < 0 ? RED : GREY; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/><circle cx="' + x + '" cy="' + y + '" r="' + (r + 5) + '" fill="' + c + '" fill-opacity=".2"/>'; }
  function deltaT(x, y, o, size, anchor) { if (o.d == null) return ''; return T(x, y, fmtD(o.k, o.d), size, 700, o.better > 0 ? GREEN : o.better < 0 ? RED : MUT, anchor); }
  function svgOpen(W, H) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'; }
  /* headline: with targets → ผ่านเกณฑ์ x/y (of KPIs that have a target); without → ดีขึ้น x/y */
  function head(res) {
    var has = res.filter(function (o) { return o.v != null; }), tg = has.filter(function (o) { return hasT(o.k); });
    var up = has.filter(function (o) { return o.better > 0; }).length, dn = has.filter(function (o) { return o.better < 0; }).length;
    if (tg.length) { var ok = tg.filter(function (o) { return o.st > 0; }).length; return { t: 'ผ่านเกณฑ์ ' + ok + '/' + tg.length + ' ตัวชี้วัด', short: 'ผ่านเกณฑ์ ' + ok + '/' + tg.length, r: ok / tg.length, up: up, dn: dn, lg: ['ผ่าน / ดีขึ้น', 'ไม่ผ่าน / แย่ลง'] }; }
    return { t: 'ดีขึ้น ' + up + '/' + has.length + ' ตัวชี้วัด', short: 'ดีขึ้น ' + up + '/' + has.length, r: has.length ? up / has.length : 0, up: up, dn: dn, lg: ['ดีขึ้น', 'แย่ลง'] };
  }
  function sources(res) { var s = {}; res.forEach(function (o) { s[sysName(o.k.sys)] = 1; }); return 'ที่มา: ' + Object.keys(s).join(' · '); }

  /* ---- charts ---- */
  function hbars(x, y, w, h, items, k, lo, hi, lw) {
    if (!items.length) return T(x + w / 2, y + h / 2, 'ไม่มีข้อมูลแยก', 18, 400, MUT, 'middle');
    var n = items.length, bh = Math.min(26, h / n * 0.66), fs = Math.max(11, Math.min(17, h / n * 0.62)), s = '', t = hasT(k) ? +k.target : null;
    lw = lw || (items.some(function (it) { return String(it[0]).length > 10; }) ? 230 : 130); var span = w - lw - 120;
    items.forEach(function (it, i) {
      var by = y + i * h / n + (h / n - bh) / 2, v = it[1], bw = v == null ? 0 : Math.max(2, span * (v - lo) / (hi - lo || 1));
      var ok = t == null ? true : (k.dir < 0 ? v <= t : v >= t);
      s += T(x + lw - 12, by + bh / 2 + fs * 0.36, fit(it[0], fs, lw - 12), fs, 600, SOFT, 'end') + '<rect x="' + (x + lw) + '" y="' + by + '" width="' + span + '" height="' + bh + '" rx="' + bh / 2 + '" fill="' + TRK + '" fill-opacity=".06"/>' +
        '<rect x="' + (x + lw) + '" y="' + by + '" width="' + Math.min(span, bw).toFixed(0) + '" height="' + bh + '" rx="' + bh / 2 + '" fill="' + (ok ? 'url(#bar)' : RED) + '"/>' + T(x + lw + Math.min(span, bw) + 10, by + bh / 2 + fs * 0.34, fmt(k, v) + (it[2] != null && it[2] < 30 ? ' (' + it[2] + ')' : ''), Math.min(16, fs), 700, INK);
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
    for (var g = 0; g <= 4; g++) { var gv = lo + (hi - lo) * g / 4, gy = Y(gv); out += '<line x1="' + x + '" y1="' + gy + '" x2="' + (x + w) + '" y2="' + gy + '" stroke="' + TRK + '" stroke-opacity=".07"/>' + T(x - 10, gy + 5, k.unit === 'baht' ? money(gv) : gv.toFixed(hi - lo < 5 ? 1 : 0), 14, 400, MUT, 'end'); }
    if (hasT(k)) { var ty = Y(+k.target); out += '<line x1="' + x + '" y1="' + ty + '" x2="' + (x + w) + '" y2="' + ty + '" stroke="' + YEL + '" stroke-dasharray="6 5" stroke-width="2"/>'; }
    var cols = [CY, '#b48cff', YEL, GREEN], n = labels.length;
    series.forEach(function (s, si) {
      var pts = s.vals.map(function (v, i) { return v == null ? null : [x + (n > 1 ? w * i / (n - 1) : w / 2), Y(v)]; });
      var d = '', started = false; pts.forEach(function (p) { if (!p) { started = false; return; } d += (started ? ' L' : ' M') + p[0].toFixed(0) + ' ' + p[1].toFixed(0); started = true; });
      if (si === 0) { var vp = pts.filter(Boolean); if (vp.length > 1) out += '<path d="M' + vp[0][0].toFixed(0) + ' ' + (y + h) + ' L' + vp.map(function (p) { return p[0].toFixed(0) + ' ' + p[1].toFixed(0); }).join(' L') + ' L' + vp[vp.length - 1][0].toFixed(0) + ' ' + (y + h) + 'Z" fill="' + CY + '" fill-opacity=".10"/>'; }
      out += '<path d="' + d + '" fill="none" stroke="' + cols[si] + '" stroke-width="3.5" stroke-linejoin="round"/>';
      pts.forEach(function (p) { if (p) out += '<circle cx="' + p[0].toFixed(0) + '" cy="' + p[1].toFixed(0) + '" r="5" fill="' + BGC + '" stroke="' + cols[si] + '" stroke-width="3"/>'; });
    });
    labels.forEach(function (l, i) { out += T(x + (n > 1 ? w * i / (n - 1) : w / 2), y + h + 26, l, 14, 400, MUT, 'middle'); });
    return out;
  }
  function chartTitle(x, y, t, note) { return T(x, y, t, 21, 700, INK) + (note ? T(x, y + 23, note, 14, 400, MUT) : ''); }
  function axisNote(k, lo) { return k.unit === '%' && lo > 0 ? 'แกนเริ่มที่ ' + lo + '%' : ''; }
  function sortBy(items, k, worstFirst) { return items.filter(function (x) { return x[1] != null; }).sort(function (a, b) { var d = (a[1] - b[1]) * (k.dir < 0 ? -1 : 1); return worstFirst ? d : -d; }); }
  function worseThan(items, k, v) { return v == null ? items : items.filter(function (x) { return x[1] != null && (k.dir < 0 ? x[1] > v + 1e-9 : x[1] < v - 1e-9); }); }
  function bigEnough(items) { var big = items.filter(function (x) { return x[2] == null || x[2] >= 5; }); return big.length >= 3 ? big : items; }


  /* status badge: light = ทึบ · navy = เส้นขอบ */
  function sbadge(x, y, w, h, txt, c) { return TH === 'light' ? '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="' + c + '"/>' + T(x + w / 2, y + h * 0.7, txt, h * 0.52, 700, '#fff', 'middle') : '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" fill="none" stroke="' + c + '" stroke-width="2"/>' + T(x + w / 2, y + h * 0.7, txt, h * 0.52, 700, c, 'middle'); }
  function stTxt(o) { return o.v == null ? '' : hasT(o.k) ? (o.st > 0 ? 'ผ่าน' : 'ไม่ผ่าน') : o.better > 0 ? 'ดีขึ้น' : o.better < 0 ? 'แย่ลง' : 'คงที่'; }
  function stCol(o) { return hasT(o.k) ? (o.st > 0 ? GREEN : RED) : o.better > 0 ? GREEN : o.better < 0 ? RED : MUT; }
  /* flat summary = ตาราง */
  function svgSummaryFlat(A, res, p) {
    var W = 1920, H = 1080, s = svgOpen(W, H) + defs(A, W, H), hd = head(res);
    s += header(A, W, MODES[p.mode].t + ' · สรุปภาพรวม', p);
    [['ผล', hd.short + ' ตัวชี้วัด', GREEN], ['ดีขึ้น', String(hd.up), GREEN], ['แย่ลง', String(hd.dn), RED]].forEach(function (c, i) { var x = 48 + i * 380; s += panel(x, 148, 360, 80, 12) + '<rect x="' + x + '" y="148" width="8" height="80" rx="3" fill="' + c[2] + '"/>' + T(x + 26, 178, c[0], 17, 400, MUT) + T(x + 26, 214, fit(c[1], 28, 320), 28, 800, c[2]); });
    s += T(W - 48, 196, 'เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + '  ·  เขียว = ผ่าน/ดีขึ้น  ·  แดง = ไม่ผ่าน/แย่ลง', 17, 400, MUT, 'end');
    var ty = 248, cols = [48, 330, 1010, 1250, 1440, 1690, W - 48], n = res.length, rh = Math.min(48, (H - ty - 70) / (n + 1)), fs = Math.min(19, rh * 0.5);
    s += '<rect x="48" y="' + ty + '" width="' + (W - 96) + '" height="' + rh + '" rx="6" fill="' + (TH === 'light' ? '#0b2a5b' : '#1b3a72') + '"/>';
    ['ด้าน', 'ตัวชี้วัด', 'ผล', 'เกณฑ์', 'เทียบช่วงก่อน', 'สถานะ'].forEach(function (h, i) { s += T(i >= 2 ? cols[i + 1] - 16 : cols[i] + 16, ty + rh * 0.66, h, fs, 700, TH === 'light' ? '#fff' : SOFT, i >= 2 ? 'end' : 'start'); });
    var last = null;
    res.forEach(function (o, j) {
      var y = ty + rh * (j + 1), first = o.k.dim !== last; last = o.k.dim;
      if (j % 2) s += '<rect x="48" y="' + y + '" width="' + (W - 96) + '" height="' + rh + '" fill="' + (TH === 'light' ? '#f7f9fc' : '#10244a') + '"/>';
      if (first && j) s += '<line x1="48" y1="' + y + '" x2="' + (W - 48) + '" y2="' + y + '" stroke="' + YEL + '" stroke-opacity=".6" stroke-width="1.5"/>';
      var by = y + rh * 0.66;
      if (first) s += T(cols[0] + 16, by, fit(o.k.dim, fs, 260), fs, 700, TITLEC.indexOf('url') === 0 ? INK : TITLEC);
      s += T(cols[1] + 16, by, fit(o.k.name, fs, 660), fs, 400, INK);
      s += T(cols[3] - 16, by, fmt(o.k, o.v), fs, 800, INK, 'end');
      s += T(cols[4] - 16, by, hasT(o.k) ? fmtT(o.k) : '–', fs * 0.9, 400, SOFT, 'end');
      s += o.d != null ? T(cols[5] - 16, by, fmtD(o.k, o.d), fs, 700, o.better > 0 ? GREEN : o.better < 0 ? RED : MUT, 'end') : '';
      var st = stTxt(o); if (st) s += sbadge(cols[6] - 16 - 120, y + rh * 0.16, 120, rh * 0.68, st, stCol(o));
    });
    s += footer(W, H, sources(res));
    return s + '</svg>';
  }
  /* flat KPI = การ์ดค่า + แนวโน้ม + รายภาค + ตาราง DC แย่สุด 5 */
  function svgKpiFlat(A, o, p) {
    var W = 1920, H = 1080, k = o.k, c = o.cur || {}, s = svgOpen(W, H) + defs(A, W, H), VC = TITLEC.indexOf('url') === 0 ? INK : TITLEC;
    s += header(A, W, k.name, p);
    s += panel(48, 152, 560, 392, 14) + T(76, 190, fit(k.dim + ' · ' + sysName(k.sys), 17, 510), 17, 400, MUT);
    s += T(76, 300, fmt(k, o.v), k.unit === '%' ? 96 : 66, 800, VC);
    if (hasT(k)) s += sbadge(76, 334, 170, 38, o.st > 0 ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์', o.st > 0 ? GREEN : RED) + T(266, 361, 'เกณฑ์ ' + fmtT(k), 21, 400, SOFT);
    if (o.d != null) s += T(76, 420, fit(fmtD(k, o.d) + '  เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + '  (' + fmt(k, o.pv) + ')', 21, 510), 21, 700, o.better > 0 ? GREEN : o.better < 0 ? RED : MUT);
    if (c.n && c.n[1] != null) s += T(76, 462, 'ตัวตั้ง ' + Math.round(c.n[0]).toLocaleString('en-US') + ' / ตัวหาร ' + Math.round(c.n[1]).toLocaleString('en-US'), 16, 400, MUT);
    else if (c.note) s += T(76, 462, fit(c.note, 16, 510), 16, 400, MUT);
    s += panel(632, 152, 1240, 392, 14);
    if (o.trend) { s += chartTitle(660, 192, 'แนวโน้ม ' + o.trend.length + ' ' + unitWord(p.mode), hasT(k) ? 'เส้นประ = เกณฑ์' : ''); s += lineChart(740, 240, 1100, 240, [{ vals: o.trend.map(function (t) { return t.v; }) }], k, o.trend.map(function (t) { return t.l; })); }
    var reg = c.region || [], items = sortBy(reg.length ? reg : bigEnough(c.dc || []), k, true).slice(0, 10);
    s += panel(48, 568, 900, 440, 14);
    var rr = range(items.map(function (x) { return x[1]; }), k, 0.4);
    s += chartTitle(76, 606, reg.length ? 'รายภาค (แย่สุดก่อน)' : 'ราย DC (แย่สุดก่อน)', axisNote(k, rr[0]));
    s += hbars(76, 650, 846, 340, items, k, rr[0], rr[1]);
    s += panel(972, 568, 900, 440, 14) + chartTitle(1000, 606, 'DC แย่สุด 5 อันดับ', '');
    var w5 = sortBy(worseThan(bigEnough(c.dc || []), k, o.v), k, true).slice(0, 5);
    if (w5.length) {
      var tx0 = 996, tw = 852, ty = 630, rh = 58, cx = [tx0, tx0 + 60, tx0 + 560, tx0 + tw];
      s += '<rect x="' + tx0 + '" y="' + ty + '" width="' + tw + '" height="48" rx="6" fill="' + (TH === 'light' ? '#0b2a5b' : '#1b3a72') + '"/>' + T(cx[0] + 18, ty + 32, '#', 18, 700, TH === 'light' ? '#fff' : SOFT) + T(cx[1] + 12, ty + 32, 'DC', 18, 700, TH === 'light' ? '#fff' : SOFT) + T(cx[2] + 150, ty + 32, 'ผล', 18, 700, TH === 'light' ? '#fff' : SOFT, 'end') + T(cx[3] - 16, ty + 32, 'จำนวน', 18, 700, TH === 'light' ? '#fff' : SOFT, 'end');
      w5.forEach(function (d, i) { var y = ty + 48 + i * rh; if (i % 2) s += '<rect x="' + tx0 + '" y="' + y + '" width="' + tw + '" height="' + rh + '" fill="' + (TH === 'light' ? '#f7f9fc' : '#10244a') + '"/>'; s += T(cx[0] + 18, y + 38, String(i + 1), 20, 700, MUT) + T(cx[1] + 12, y + 38, fit(d[0], 20, 480), 20, 600, INK) + T(cx[2] + 150, y + 38, fmt(k, d[1]), 21, 800, RED, 'end') + T(cx[3] - 16, y + 38, d[2] == null ? '' : Math.round(d[2]).toLocaleString('en-US'), 19, 400, SOFT, 'end'); });
    } else s += T(1422, 800, (c.dc || []).length ? 'ไม่มี DC ที่ผลต่ำกว่าค่ารวม' : 'ระบบนี้ไม่มีข้อมูลแยกราย DC', 20, 400, MUT, 'middle');
    s += footer(W, H, 'ที่มา: ' + sysName(k.sys) + (c.note ? ' · ' + c.note : ''));
    return s + '</svg>';
  }
  /* ---- 1) one-page summary ---- */
  function svgSummary(A, res, p) {
    if (TH !== 'neon') return svgSummaryFlat(A, res, p);
    var W = 1920, H = 1080, D = dims(res.map(function (o) { return o.k; })), s = svgOpen(W, H) + defs(A, W, H);
    s += header(A, W, 'Fleet Report · สรุปภาพรวม', p);
    var hd = head(res), y0 = 146; s += panel(48, y0, W - 96, 74, 14, false);
    s += T(76, y0 + 47, hd.t, 28, 800, INK);
    s += '<rect x="440" y="' + (y0 + 28) + '" width="480" height="18" rx="9" fill="' + TRK + '" fill-opacity=".1"/><rect x="440" y="' + (y0 + 28) + '" width="' + (480 * hd.r).toFixed(0) + '" height="18" rx="9" fill="' + GREEN + '"/>';
    s += T(950, y0 + 47, '▲▼ เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + ' :  ดีขึ้น ' + hd.up + '  ·  แย่ลง ' + hd.dn, 22, 600, MUT);
    s += dot(1500, y0 + 38, 1, 6) + T(1516, y0 + 45, hd.lg[0], 17, 400, MUT) + dot(1660, y0 + 38, -1, 6) + T(1676, y0 + 45, hd.lg[1], 17, 400, MUT);
    var n = D.length, cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), gy = 244, gap = 22;
    var pw = (W - 96 - (cols - 1) * 24) / cols, ph = (H - gy - 56 - (rows - 1) * gap) / rows;
    var maxK = Math.max.apply(null, D.map(function (d) { return res.filter(function (o) { return o.k.dim === d; }).length; }));
    D.forEach(function (dn2, i) {
      var cx = 48 + (i % cols) * (pw + 24), cy = gy + Math.floor(i / cols) * (ph + gap), ks = res.filter(function (o) { return o.k.dim === dn2; });
      var srcs = {}; ks.forEach(function (o) { srcs[sysName(o.k.sys)] = 1; });
      s += panel(cx, cy, pw, ph) + '<rect x="' + (cx + 22) + '" y="' + (cy + 24) + '" width="6" height="30" rx="3" fill="' + YEL + '"/>';
      s += T(cx + 40, cy + 48, fit(dn2, 25, pw * 0.6), 25, 800, INK) + T(cx + pw - 22, cy + 48, fit(Object.keys(srcs).join(' / '), 15, pw * 0.36), 15, 400, MUT, 'end');
      var rh = (ph - 76) / Math.max(maxK, 3), big = Math.min(34, rh * 0.36), sm = Math.min(19, rh * 0.21);
      ks.forEach(function (o, j) {
        var ry = cy + 70 + j * rh;
        if (j) s += '<line x1="' + (cx + 22) + '" y1="' + ry + '" x2="' + (cx + pw - 22) + '" y2="' + ry + '" stroke="' + TRK + '" stroke-opacity=".08"/>';
        s += dot(cx + 34, ry + rh / 2, o.st, 6) + T(cx + 56, ry + rh / 2 - big * 0.3, fit(o.k.name, sm, pw - 90), sm, 400, SOFT);
        s += T(cx + 56, ry + rh / 2 + big * 0.85, fmt(o.k, o.v), big, 800, INK);
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
      s += T(cx + 22, cy + 108, fmt(o.k, o.v), big, 800, INK, 'start', 'filter="url(#tglow)"');
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
      var w5 = sortBy(worseThan(bigEnough(c0.dc || []), k0.k, k0.v), k0.k, true).slice(0, 5), r5 = range(w5.map(function (x) { return x[1]; }), k0.k, 0.4);
      s += chartTitle(P[2][0] + 24, P[2][1] + 38, 'DC ผลแย่สุด 5 อันดับ · ' + fit(k0.k.name, 21, gw - 300), w5.length ? axisNote(k0.k, r5[0]) : '');
      s += w5.length ? hbars(P[2][0] + 24, P[2][1] + 92, gw - 48, gh - 112, w5, k0.k, r5[0], r5[1]) : T(P[2][0] + gw / 2, P[2][1] + gh / 2 + 10, (c0.dc || []).length ? 'ไม่มี DC ที่ผลต่ำกว่าค่ารวม' : 'ระบบนี้ไม่มีข้อมูลแยกราย DC', 20, 400, MUT, 'middle');
    }
    /* (4) เทียบช่วงก่อนหน้า ทุก KPI ในด้าน */
    s += chartTitle(P[3][0] + 24, P[3][1] + 38, 'เทียบช่วงก่อนหน้า', label(prevOf(p)).replace(/\s+\(.*/, '') + ' → ' + label(p).replace(/\s+\(.*/, ''));
    var rowH = (gh - 90) / Math.max(n, 1);
    ks.forEach(function (o, i) {
      var ry = P[3][1] + 80 + i * rowH; s += T(P[3][0] + 24, ry + rowH * 0.42, fit(o.k.name, 16, gw * 0.5), 16, 600, SOFT);
      s += T(P[3][0] + 24, ry + rowH * 0.42 + 26, fmt(o.k, o.pv) + '  →  ' + fmt(o.k, o.v), 20, 800, INK);
      s += deltaT(P[3][0] + gw - 24, ry + rowH * 0.42 + 26, o, 20, 'end');
    });
    s += footer(W, H, sources(ks) + (p.mode === 'W' ? ' · สัปดาห์ = จันทร์–เสาร์ (วันอาทิตย์นับในรายเดือนเท่านั้น)' : ''));
    return s + '</svg>';
  }

  /* ---- 2B) one image per KPI ---- */
  function svgKpi(A, o, p) {
    if (TH !== 'neon') return svgKpiFlat(A, o, p);
    var W = 1920, H = 1080, k = o.k, c = o.cur || {}, s = svgOpen(W, H) + defs(A, W, H);
    s += header(A, W, k.name, p);
    s += panel(48, 146, 560, 560);
    s += T(80, 198, k.dim, 22, 600, SOFT) + T(80, 226, sysName(k.sys), 16, 400, MUT);
    var cx = 328, cy = 430, r = 165;
    if (k.unit === '%') {
      var lo = hasT(k) ? Math.max(0, Math.min(+k.target, o.v || 100) - 10) : 0, hi = 100, a0 = Math.PI * 0.75, span = Math.PI * 1.5;
      if (o.v != null && o.v > 100) hi = Math.ceil(o.v / 10) * 10;
      var arc = function (fr, col, wd) { fr = Math.max(0.001, Math.min(1, fr)); var a1 = a0 + span * fr, x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); return '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (span * fr > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="' + wd + '" stroke-linecap="round"/>'; };
      s += arc(1, TRK10, 26);
      if (o.v != null) s += arc((o.v - lo) / (hi - lo), o.st < 0 ? RED : GREEN, 26);
      if (hasT(k)) { var ta = a0 + span * (+k.target - lo) / (hi - lo); s += '<line x1="' + (cx + (r - 24) * Math.cos(ta)).toFixed(0) + '" y1="' + (cy + (r - 24) * Math.sin(ta)).toFixed(0) + '" x2="' + (cx + (r + 24) * Math.cos(ta)).toFixed(0) + '" y2="' + (cy + (r + 24) * Math.sin(ta)).toFixed(0) + '" stroke="' + YEL + '" stroke-width="4"/>'; }
      if (lo > 0) s += T(cx, cy + r + 40, 'หน้าปัดเริ่มที่ ' + lo + '%', 14, 400, MUT, 'middle');
    }
    s += T(cx, cy + 18, fmt(k, o.v), k.unit === '%' ? 70 : 56, 800, INK, 'middle', 'filter="url(#tglow)"');
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
    if (bw2.length) { var r2 = range(bw2.map(function (x) { return x[1]; }), k, 0.4); s += chartTitle(bx, 474, 'DC ดีสุด ' + nb + ' / แย่สุด ' + nb, axisNote(k, r2[0])); s += hbars(bx, 516, bwid, 172, bw2, k, r2[0], r2[1], 230); }
    s += panel(48, 726, W - 96, 290, 18, false);
    var all = sortBy(dcs, k, false), m = Math.min(all.length, 40);
    if (m) {
      var r3 = range(all.map(function (x) { return x[1]; }), k, 0.4), lo3 = r3[0], hi3 = r3[1], bw3 = (W - 96 - 80) / m, base = 960, hh = 170, t3 = hasT(k) ? +k.target : null;
      s += chartTitle(72, 764, 'ทุก DC เรียงจากดีไปแย่ (' + all.length + ' DC' + (all.length > m ? ' แสดง ' + m : '') + ')', axisNote(k, lo3));
      all.slice(0, m).forEach(function (x, i) { var hgt = Math.max(2, hh * (x[1] - lo3) / (hi3 - lo3 || 1)), ok = t3 == null ? (i < m / 2) : (k.dir < 0 ? x[1] <= t3 : x[1] >= t3); s += '<rect x="' + (88 + i * bw3).toFixed(1) + '" y="' + (base - hgt).toFixed(1) + '" width="' + Math.max(2, bw3 - 4).toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="3" fill="' + (ok ? 'url(#barv)' : RED) + '" fill-opacity=".9"/>'; });
      if (t3 != null) { var ty = base - hh * (t3 - lo3) / (hi3 - lo3 || 1); s += '<line x1="80" y1="' + ty + '" x2="' + (W - 72) + '" y2="' + ty + '" stroke="' + YEL + '" stroke-dasharray="6 5" stroke-width="2"/>'; }
      var worst = sortBy(worseThan(dcs, k, o.v), k, true).slice(0, 3).map(function (x) { return x[0] + ' ' + fmt(k, x[1]); }).join('  ·  ');
      if (worst) s += T(72, 996, fit('แย่สุด: ' + worst, 18, W - 420), 18, 600, YEL);
    } else s += T(W / 2, 880, 'ระบบนี้ไม่มีข้อมูลแยกราย DC', 20, 400, MUT, 'middle');
    s += footer(W, H, 'ที่มา: ' + sysName(k.sys) + (c.note ? ' · ' + c.note : ''));
    return s + '</svg>';
  }

  /* ---- 3) story 1080×1920 ---- */
  function svgStory(A, res, p) {
    var W = 1080, H = 1920, D = dims(res.map(function (o) { return o.k; })), s = svgOpen(W, H) + defs(A, W, H, 0.45);
    s += logo(A, 68, 28, 1.1) + (TH === 'neon' ? hud(52, 152, W - 104, 108) + T(W / 2, 236, MODES[p.mode].t, 78, 800, 'url(#gold)', 'middle', 'filter="url(#gglow)" font-style="italic"') : T(W / 2, 236, MODES[p.mode].t, 72, 800, TITLEC, 'middle') + '<rect x="' + (W / 2 - 120) + '" y="254" width="240" height="5" rx="2" fill="' + YEL + '"/>');
    s += '<rect x="60" y="276" width="' + (W - 120) + '" height="120" rx="18" fill="' + PERBG + '" fill-opacity="' + (TH === 'neon' ? 0.75 : 1) + '" stroke="' + PERSTROKE + '" stroke-width="2" stroke-opacity="' + (TH === 'navy' ? 0 : 0.8) + '"/>';
    s += '<rect x="84" y="296" width="140" height="36" rx="18" fill="' + (TH === 'light' ? CY : YEL) + '"/>' + T(154, 322, MODES[p.mode].en, 20, 800, TH === 'light' ? '#fff' : NAVY, 'middle') + T(240, 324, MODES[p.mode].th, 23, 600, YEL);
    s += T(W - 84, 326, fit(label(p).replace(/\s+\(.*/, ''), 32, 460), 32, 800, INK, 'end') + T(84, 376, '⇄  เทียบกับ', 22, 600, CY) + T(W - 84, 376, label(prevOf(p)).replace(/\s+\(.*/, ''), 26, 600, SOFT, 'end');
    var hd = head(res);
    s += panel(60, 414, W - 120, 104, 20) + T(100, 482, hd.short, 44, 800, INK);
    s += '<rect x="560" y="458" width="420" height="22" rx="11" fill="' + TRK + '" fill-opacity=".1"/><rect x="560" y="458" width="' + (420 * hd.r).toFixed(0) + '" height="22" rx="11" fill="' + GREEN + '"/>';
    var apA = UI.ap ? openActs() : [], apH = apA.length ? 250 : 0;
    var y = 540, avail = H - y - 110 - apH, rowsN = res.length, rh = Math.min(68, (avail - D.length * (66 + 18)) / Math.max(rowsN, 1)), fs = Math.max(16, Math.min(25, rh * 0.37));
    D.forEach(function (dn) {
      var ks = res.filter(function (o) { return o.k.dim === dn; }), h = 62 + ks.length * rh;
      s += panel(60, y, W - 120, h, 20, false) + '<rect x="88" y="' + (y + 24) + '" width="7" height="32" rx="3" fill="' + YEL + '"/>' + T(108, y + 50, dn, 30, 800, INK);
      ks.forEach(function (o, j) {
        var ry = y + 58 + j * rh;
        s += dot(104, ry + rh / 2, o.st, 7) + T(130, ry + rh / 2 + fs * 0.38, fit(o.k.name, fs, 540), fs, 400, SOFT);
        s += T(W - 250, ry + rh / 2 + fs * 0.45, fmt(o.k, o.v), fs * 1.28, 800, INK, 'end') + deltaT(W - 96, ry + rh / 2 + fs * 0.4, o, fs * 0.95, 'end');
      });
      y += h + 18;
    });
    if (apH) {
      var ay = H - 110 - apH + 10, late = apA.filter(function (a) { return stOf(a) === 'late'; }).length, urg = apA.filter(function (a) { return stOf(a) !== 'done'; }).sort(function (a, b) { return (stOf(b) === 'late') - (stOf(a) === 'late') || (a.due < b.due ? -1 : 1); }).slice(0, 3);
      s += panel(60, ay, W - 120, apH - 20, 20, false) + '<rect x="88" y="' + (ay + 24) + '" width="7" height="32" rx="3" fill="' + YEL + '"/>' + T(108, ay + 50, 'Action Plan', 30, 800, 'url(#gold)', 'start', 'filter="url(#gglow)"');
      s += T(W - 96, ay + 50, 'งาน ' + apA.length + ' · ล่าช้า ' + late, 24, 700, late ? RED : SOFT, 'end');
      urg.forEach(function (a, i) { var st = STT[stOf(a)]; s += dot(104, ay + 92 + i * 46, stOf(a) === 'late' ? -1 : 0, 7) + T(130, ay + 100 + i * 46, fit(a.title, 22, 600), 22, 400, SOFT) + T(W - 96, ay + 100 + i * 46, a.owner + ' · ' + dTh(a.due), 19, 600, st.c, 'end'); });
    }
    s += brand(W, H, 1.4);
    return s + '</svg>';
  }

  /* ---------- LINE text ---------- */
  function lineText(res, p, watch) {
    var D = dims(res.map(function (o) { return o.k; })), hd = head(res);
    var t = '📊 NIMEX ' + MODES[p.mode].t + '\n🗓 ' + label(p) + '\n⇄ เทียบกับ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + '\n✅ ' + hd.t + ' · ดีขึ้น ' + hd.up + ' · แย่ลง ' + hd.dn + '\n';
    D.forEach(function (dn) {
      t += '\n' + dimEmo(dn) + ' ' + dn + '\n';
      res.filter(function (o) { return o.k.dim === dn; }).forEach(function (o) {
        var d = o.d == null ? '' : ' (' + fmtD(o.k, o.d).replace(' pt', '').replace(' ', '') + ')';
        t += (o.st > 0 ? '🟢' : o.st < 0 ? '🔴' : '⚪') + ' ' + o.k.name + ' ' + fmt(o.k, o.v) + d + '\n';
      });
    });
    if (watch && watch.length) t += '\n⚠️ จุดที่ต้องดู\n' + watch.map(function (w) { return '• ' + w; }).join('\n') + '\n';
    if (UI.ap) t += apText();
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
      else if (o.cur && o.cur.dc && o.cur.dc.length) { var w = sortBy(worseThan(bigEnough(o.cur.dc), o.k, o.v), o.k, true).slice(0, 3).map(function (x) { return x[0]; }); if (w.length) line += ' · แย่สุด: ' + w.join(', '); }
      out.push(line);
    });
    return out.slice(0, 6);
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
  UI.mode = UI.mode || 'D'; UI.out = UI.out || { sum: 1, dim: 0, kpi: 0 }; UI.off = UI.off || {}; UI.apFmt = UI.apFmt || 'one'; UI.apHide = UI.apHide || {}; UI.apHideAct = UI.apHideAct || {}; UI.theme = THEMES[UI.theme] ? UI.theme : 'neon';
  var SLIDES = [], LAST = null;
  function saveUI() { ls(LSK, { mode: UI.mode, out: UI.out, off: UI.off, ap: UI.ap, apFmt: UI.apFmt, apHide: UI.apHide, apHideAct: UI.apHideAct, theme: UI.theme }); }
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
  function open() { build(); $('rep').hidden = false; document.body.style.overflow = 'hidden'; ensure(Object.keys(sysNeeded())); renderMake(); loadPrivate(); }
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
      '<div class="th-opt"><span>แบบภาพ / PowerPoint</span><div class="seg">' + [['neon', 'Neon (เดิม)'], ['light', 'A · Clean Light'], ['navy', 'B · Navy Flat']].map(function (t) { return '<button type="button" data-th="' + t[0] + '"' + (UI.theme === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>' +
      '<small>' + (UI.theme === 'neon' ? 'PowerPoint เป็นภาพทั้งแผ่น' : 'PowerPoint แก้ไขข้อความ/ตาราง/กราฟได้ · ฟอนต์ DB Heavent') + '</small></div>' +
      '<div class="ap-opt"><label class="rk"><input type="checkbox" id="apOn"' + (UI.ap ? ' checked' : '') + '> <b>Action Plan</b> (ผล → ปัญหา → แนวทาง → ไทม์ไลน์)</label>' +
      '<div class="seg ap-fmt"' + (UI.ap ? '' : ' hidden') + '><button type="button" data-apf="one"' + (UI.apFmt === 'one' ? ' class="on"' : '') + '>รวม 1 หน้า</button><button type="button" data-apf="each"' + (UI.apFmt === 'each' ? ' class="on"' : '') + '>แยกเรื่อง</button></div></div>' +
      '<button type="button" class="btn pri wide" id="repGo">สร้างตัวอย่าง</button><div class="rep-msg" id="repMsg" role="status"></div>' +
      '<div class="rep-exp" id="repExp" hidden><h3>แชร์ / ส่งออก</h3><button type="button" class="btn" data-x="png">PNG 16:9</button><button type="button" class="btn" data-x="story">PNG แนวตั้ง 1080×1920</button><button type="button" class="btn" data-x="pptx">PowerPoint</button><button type="button" class="btn" data-x="line">ข้อความ LINE</button><button type="button" class="btn pri" data-x="show">ฉายเต็มจอ</button></div>' +
      '</section></div><div class="rep-prev" id="repPrev"></div><section class="rep-ap" id="repAp" hidden></section><div class="rep-line" id="repLine" hidden><textarea id="repTxt" rows="14" aria-label="ข้อความสรุปสำหรับ LINE"></textarea><button type="button" class="btn pri" id="repCopy">คัดลอกข้อความ</button></div>';
    [].forEach.call(el.querySelectorAll('[data-m]'), function (b) { b.onclick = function () { UI.mode = b.dataset.m; UI.ref = null; UI.refTouched = false; saveUI(); renderMake(); }; });
    setRefInput(); renderStatus();
    $('repRef').onchange = function () { var v = this.value; if (!v) return; UI.ref = UI.mode === 'M' ? v + '-01' : v; UI.refTouched = true; renderPer(); };
    $('repLatest').onclick = function () { UI.ref = null; UI.refTouched = false; setRefInput(); renderPer(); };
    [].forEach.call(el.querySelectorAll('[data-k]'), function (c) { c.onchange = function () { if (c.checked) delete UI.off[c.dataset.k]; else UI.off[c.dataset.k] = 1; saveUI(); renderMake(); }; });
    [].forEach.call(el.querySelectorAll('[data-dim]'), function (c) { c.onchange = function () { list.filter(function (k) { return k.dim === c.dataset.dim; }).forEach(function (k) { if (c.checked) delete UI.off[k.id]; else UI.off[k.id] = 1; }); saveUI(); renderMake(); }; });
    [].forEach.call(el.querySelectorAll('[data-out]'), function (c) { c.onchange = function () { UI.out[c.dataset.out] = c.checked ? 1 : 0; saveUI(); }; });
    $('repGo').onclick = generate;
    [].forEach.call(el.querySelectorAll('[data-th]'), function (b) { b.onclick = function () { UI.theme = b.dataset.th; saveUI(); renderMake(); if (LAST) rebuildAp(); }; });
    $('apOn').onchange = function () { UI.ap = this.checked; saveUI(); el.querySelector('.ap-fmt').hidden = !UI.ap; if (LAST) rebuildAp(); };
    [].forEach.call(el.querySelectorAll('[data-apf]'), function (b) { b.onclick = function () { UI.apFmt = b.dataset.apf; saveUI(); [].forEach.call(el.querySelectorAll('[data-apf]'), function (x) { x.classList.toggle('on', x === b); }); if (LAST && UI.ap) rebuildAp(); }; });
    [].forEach.call(el.querySelectorAll('[data-x]'), function (b) { b.onclick = function () { doExport(b.dataset.x, b); }; });
    $('repCopy').onclick = function () { var t = $('repTxt'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(function () { APP().toast('คัดลอกข้อความแล้ว'); }).catch(function () { document.execCommand('copy'); APP().toast('คัดลอกข้อความแล้ว'); }); };
    if (LAST && LAST.mode === UI.mode) { showPreview(); if (UI.ap) renderAp(); }
  }
  function msg(t, bad) { var m = $('repMsg'); if (m) { m.textContent = t; m.classList.toggle('bad', !!bad); } }

  function generate() {
    var list = picked(); if (!list.length) return msg('ยังไม่ได้เลือกตัวชี้วัด', true);
    if (!UI.out.sum && !UI.out.dim && !UI.out.kpi && !UI.ap) return msg('เลือกรูปแบบอย่างน้อย 1 แบบ', true);
    var p = curPeriod(); pMode = p.mode; $('repGo').disabled = true; msg('กำลังรอข้อมูลจากระบบ…');
    var syss = {}; list.forEach(function (k) { syss[k.sys] = 1; });
    ensure(Object.keys(syss)).then(function () {
      msg('กำลังคำนวณ ' + list.length + ' ตัวชี้วัด…');
      return compute(list, p, { trend: !!(UI.out.dim || UI.out.kpi || UI.ap) });
    }).then(function (res) { return streaks(res, p); }).then(function (res) {
      return assets().then(function (A) {
        LAST = { mode: p.mode, p: p, res: res, list: list, probs: [] };
        renderSlides(A);
        var miss = res.filter(function (o) { return o.v == null; });
        msg('สร้างแล้ว ' + SLIDES.length + ' ภาพ' + (miss.length ? ' · ไม่มีข้อมูลในช่วงนี้ ' + miss.length + ' ตัว: ' + miss.map(function (o) { return o.k.name; }).slice(0, 3).join(', ') + (miss.length > 3 ? '…' : '') : ''));
        showPreview(); if (UI.ap) renderAp(); else if ($('repAp')) $('repAp').hidden = true;
      });
    }).catch(function (e) { console.error(e); msg('สร้างรายงานไม่สำเร็จ: ' + (e && e.message || e), true); }).then(function () { $('repGo').disabled = false; });
  }
  /* สร้างภาพทั้งหมดจากผลที่คำนวณแล้ว (ใช้ตอนสร้าง เปลี่ยนแบบภาพ และแก้ Action Plan) */
  function renderSlides(A) {
    var res = LAST.res, p = LAST.p, D = dims(LAST.list.filter(function (k) { return res.some(function (o) { return o.k === k; }); })), tag = fileTag(p);
    setTheme(UI.theme); SLIDES = [];
    if (UI.out.sum) SLIDES.push({ name: tag + '_summary', t: 'สรุปภาพรวม', svg: svgSummary(A, res, p), kind: 'sum' });
    if (UI.out.dim) D.forEach(function (dn, i) { SLIDES.push({ name: tag + '_dim' + (i + 1), t: dn, svg: svgDim(A, res, p, dn), kind: 'dim', dn: dn }); });
    if (UI.out.kpi) res.forEach(function (o, i) { SLIDES.push({ name: tag + '_kpi' + (i + 1), t: o.k.name, svg: svgKpi(A, o, p), kind: 'kpi', o: o }); });
    LAST.probs = [];
    if (UI.ap) { var ap = apSlides(A, res, p); SLIDES = SLIDES.concat(ap.slides); LAST.probs = ap.probs; }
    LAST.story = { name: tag + '_story', svg: svgStory(A, res, p) };
    LAST.line = lineText(res, p, watchList(res));
    LAST.theme = UI.theme;
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
      if ((LAST.theme || UI.theme) !== 'neon') return assets().then(smallLogo).then(function (A) { buildNative(P, A); return P.writeFile({ fileName: 'NIMEX_' + fileTag(LAST.p) + '_' + (LAST.theme === 'light' ? 'Light' : 'Navy') + '.pptx', compression: true }); });
      return SLIDES.reduce(function (ch, s) { return ch.then(function () { return svgToPng(s.svg, 1).then(b64).then(function (d) { var sl = P.addSlide(); sl.background = { color: '040B22' }; sl.addImage({ data: d, x: 0, y: 0, w: 13.333, h: 7.5 }); sl.addNotes(s.t + ' · ' + label(LAST.p) + ' เทียบกับ ' + label(prevOf(LAST.p))); }); }); }, Promise.resolve()).then(function () { return P.writeFile({ fileName: 'NIMEX_' + fileTag(LAST.p) + '.pptx' }); });
    });
    job.then(function () { APP().toast('บันทึกไฟล์แล้ว'); }).catch(function (e) { console.error(e); APP().toast('ส่งออกไม่สำเร็จ: ' + (e && e.message || e), true); }).then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ================= Action Plan: ผล → ปัญหา → แนวทางแก้ไข → ไทม์ไลน์ =================
     ปัญหา = KPI ที่เลือกซึ่งไม่ผ่านเกณฑ์ (หรือแย่ลงถ้าไม่มีเกณฑ์) · วิเคราะห์จากตัวเลขด้วยกฎคงที่ (ไม่ใช้ AI)
     งานแก้ไขเก็บในแท็บ Private ของ Sheet Hub (ผู้ชมอ่านไม่ได้) · งานค้างยกไปรายงานรอบถัดไปเอง */
  var AP = { actions: null, owners: null, playbook: null, loaded: false };
  var HZ = { w: { t: 'สัปดาห์นี้', c: GREEN }, m: { t: 'เดือนนี้', c: CY }, n: { t: 'เดือนหน้า', c: '#b48cff' }, c: { t: 'กำหนดเอง', c: YEL } };
  var STT = { todo: { t: 'ยังไม่เริ่ม', c: MUT }, doing: { t: 'กำลังทำ', c: CY }, done: { t: 'เสร็จ', c: GREEN }, late: { t: 'ล่าช้า', c: RED } };
  function today() { return iso(new Date()); }
  function owners() { return AP.owners && AP.owners.length ? AP.owners : window.HUB_OWNERS || ['DC Leader', 'Fleet Planning']; }
  function playbook(id) { var pb = AP.playbook && AP.playbook[id]; return pb && pb.length ? pb : (window.HUB_PLAYBOOK || {})[id] || []; }
  function actions() { return AP.actions || ls('nimex-hub-actions') || []; }
  function stOf(a) { return a.status !== 'done' && a.due < today() ? 'late' : a.status; }
  function hzDates(hz) {
    var t = today(), s = dow(t) === 0 ? addD(t, 1) : t;
    if (hz === 'w') return [s, addD(monday(s), 5)];
    if (hz === 'm') return [s, monthEnd(s)];
    var nf = iso(new Date(pd(t).getFullYear(), pd(t).getMonth() + 1, 1)); return [nf, monthEnd(nf)];
  }
  function loadPrivate() {
    var k = APP() && APP().storedKey && APP().storedKey(); if (!k || AP.loaded) return Promise.resolve();
    return APP().post({ a: 'private', key: k }).then(function (d) {
      if (d && d.ok && d.settings) { AP.actions = d.settings.actions || []; AP.owners = d.settings.owners || null; AP.playbook = d.settings.playbook || null; AP.loaded = true; ls('nimex-hub-actions', AP.actions); }
    }).catch(function () {});
  }
  function saveActions(list, msg) {
    var prev = AP.actions; AP.actions = list; ls('nimex-hub-actions', list);
    return APP().save({ actions: list }, msg || 'บันทึก Action Plan แล้ว').then(function (ok) { if (ok === false) { AP.actions = prev; ls('nimex-hub-actions', prev); } return ok; });
  }
  function unitWord(mode) { return mode === 'D' ? 'วัน' : mode === 'W' ? 'สัปดาห์' : 'เดือน'; }
  function gapTxt(k, d) { return k.unit === '%' ? Math.abs(d).toFixed(1) + ' pt' : k.unit === 'baht' ? money(Math.abs(d)).replace('−', '') : k.unit === 'min' ? Math.abs(d).toFixed(1) + ' นาที' : Math.abs(d).toFixed(1); }
  /* ref = เกณฑ์ (ถ้ามี) ไม่งั้นใช้ค่ารวมของช่วงนั้น */
  function analyse(o, p) {
    var k = o.k, c = o.cur || {}, ref = hasT(k) ? +k.target : o.v, dir = k.dir < 0 ? -1 : 1, U = unitWord(p.mode);
    var bad = function (v) { return v != null && (dir < 0 ? v > ref + 1e-9 : v < ref - 1e-9); };
    var short = function (x) { var w = x[2] == null ? 1 : x[2]; return w * Math.abs(ref - x[1]); };
    var regs = (c.region || []).filter(function (x) { return x[1] != null; }), dcs = bigEnough((c.dc || []).filter(function (x) { return x[1] != null; }));
    var badR = sortBy(regs.filter(function (x) { return bad(x[1]); }), k, true), badD = sortBy(dcs.filter(function (x) { return bad(x[1]); }), k, true);
    if (!badR.length) badR = sortBy(worseThan(regs, k, o.v), k, true);
    if (!badD.length) badD = sortBy(worseThan(dcs, k, o.v), k, true);
    var streak = o.streak || [], lines = [];
    var W = function (xs) { return xs.reduce(function (s, x) { return s + (x[2] == null ? 1 : x[2]); }, 0) || 1; };
    if (k.unit === 'baht') {
      var neg = regs.filter(function (x) { return x[1] < 0; }), tot = neg.reduce(function (s, x) { return s + x[1]; }, 0);
      if (neg.length && tot < 0) { var t2 = sortBy(neg, k, true).slice(0, 2), sh = t2.reduce(function (s, x) { return s + x[1]; }, 0) / tot * 100; lines.push(t2.map(function (x) { return x[0]; }).join(' + ') + ' = ' + sh.toFixed(0) + '% ของผลขาดทุนรวมรายภาค'); }
    } else if (badR.length) {
      var all = W(regs), tr = badR.slice(0, 2), pull = tr.reduce(function (s, x) { return s + short(x); }, 0) / all, sumAll = badR.reduce(function (s, x) { return s + short(x); }, 0) / all;
      lines.push(tr.map(function (x) { return x[0]; }).join(' + ') + (hasT(k) ? ' ดึงค่ารวมห่างเกณฑ์ ' : ' ต่ำกว่าค่าเฉลี่ยมากสุด ดึงลง ') + gapTxt(k, pull) + (badR.length > 2 && sumAll > 0 ? ' (' + (pull / sumAll * 100).toFixed(0) + '% ของส่วนที่ขาด)' : ''));
    }
    if (badD.length) {
      var sAll = badD.reduce(function (s, x) { return s + short(x); }, 0), s5 = badD.slice(0, 5).reduce(function (s, x) { return s + short(x); }, 0), share = sAll ? s5 / sAll * 100 : 0;
      if (k.unit === 'baht') lines.push(badD.length + ' DC ' + (hasT(k) ? 'ต่ำกว่าเกณฑ์' : 'ต่ำกว่าค่าเฉลี่ย') + ' · แย่สุด ' + badD[0][0] + ' ' + fmt(k, badD[0][1]));
      else if (badD.length === 1) lines.push(badD[0][0] + ' เป็น DC เดียวที่' + (hasT(k) ? 'ไม่ผ่านเกณฑ์' : 'แย่กว่าค่ารวม') + ' → แก้ที่ DC นี้');
      else if (badD.length <= 5) lines.push('มีเพียง ' + badD.length + ' DC ที่' + (hasT(k) ? 'ไม่ผ่านเกณฑ์' : 'แย่กว่าค่ารวม') + ' → แก้ DC เหล่านี้ก่อน');
      else if (share >= 40) lines.push('5 DC แย่สุด = ' + share.toFixed(0) + '% ของส่วนที่ขาด (จาก ' + badD.length + ' DC) → แก้ 5 DC นี้ก่อน');
      else lines.push('ปัญหากระจาย ' + badD.length + ' DC (5 แย่สุด = ' + share.toFixed(0) + '%) → แก้ระดับภาค');
    }
    var tv = (o.trend || []).map(function (t) { return t.v; }), run = 0, dec2 = 0;
    for (var i = tv.length - 1; i >= 0 && tv[i] != null && (hasT(k) ? (dir < 0 ? tv[i] > ref : tv[i] < ref) : false); i--) run++;
    for (var j = tv.length - 1; j > 0 && tv[j] != null && tv[j - 1] != null && (dir < 0 ? tv[j] > tv[j - 1] : tv[j] < tv[j - 1]); j--) dec2++;
    if (streak.length) lines.push(streak.slice(0, 3).join(', ') + ' ไม่ผ่าน 3 ' + U + 'ติด = ปัญหาเรื้อรัง ควรลงพื้นที่');
    else if (run >= 3) lines.push('ไม่ผ่านเกณฑ์ ' + run + ' ' + U + 'ติด');
    else if (dec2 >= 2) lines.push('แย่ลงต่อเนื่อง ' + dec2 + ' ' + U);
    var scope = (badR.length ? badR.slice(0, 2).map(function (x) { return x[0]; }) : badD.slice(0, 2).map(function (x) { return x[0].replace(/^\d+\s*/, ''); })).join(', ');
    return { lines: lines.slice(0, 3), regs: badR.slice(0, 3), regsAll: sortBy(regs, k, true).slice(0, 6), dcs: badD.slice(0, 5), streak: streak, run: run, dec: dec2, scope: scope || 'ทั่วประเทศ', ref: ref };
  }
  function severity(o) { var k = o.k; if (hasT(k)) return Math.abs(+k.target - o.v) / (Math.abs(+k.target) || 1); return o.pv ? Math.abs(o.d) / (Math.abs(o.pv) || 1) : 0; }
  function problems(res, p) { return res.filter(function (o) { return o.v != null && o.st < 0; }).sort(function (a, b) { return severity(b) - severity(a); }).map(function (o) { o.an = analyse(o, p); return o; }); }
  /* ซ่อนในรายงานรอบนี้: จำตามช่วงรายงาน (รอบถัดไปจะแสดงกลับเอง) · ไม่ลบงาน ไม่กระทบผู้ดูแลเครื่องอื่น */
  function curTag() { return LAST ? fileTag(LAST.p) : ''; }
  function hiddenK(kid) { return !!UI.apHide && UI.apHide[kid] === curTag(); }
  function hiddenA(id) { return !!UI.apHideAct && UI.apHideAct[id] === curTag(); }
  function setHide(map, id, on) { var t = curTag(); Object.keys(map).forEach(function (k) { if (map[k] !== t) delete map[k]; }); if (on) map[id] = t; else delete map[id]; saveUI(); }
  function actsFor(kid) { return actions().filter(function (a) { return a.kpi === kid; }); }
  function shownActs(kid) { return actsFor(kid).filter(function (a) { return !hiddenA(a.id); }); }
  function openActs() { var t30 = addD(today(), -30); return actions().filter(function (a) { return (a.status !== 'done' || a.due >= t30) && !hiddenK(a.kpi) && !hiddenA(a.id); }); }

  /* ---- slide: one problem per page ---- */
  function chipS(x, y, txt, col, w, size, op) { size = size || 15; w = w || txt.length * size * 0.62 + 26; return { s: '<rect x="' + x + '" y="' + y + '" width="' + w.toFixed(0) + '" height="' + (size + 14) + '" rx="' + (size + 14) / 2 + '" fill="' + col + '" fill-opacity="' + (op || 0.18) + '" stroke="' + col + '"/>' + T(x + w / 2, y + size + 2, txt, size, 700, col, 'middle'), w: w }; }
  function stepT(x, y, n, title) { return '<circle cx="' + (x + 18) + '" cy="' + y + '" r="18" fill="' + YEL + '"/>' + T(x + 18, y + 7, String(n), 20, 800, NAVY, 'middle') + T(x + 46, y + 8, title, 24, 800, 'url(#gold)', 'start', 'filter="url(#gglow)"'); }
  function svgApEach(A, probs, idx, p) {
    var W = 1920, H = 1080, o = probs[idx], k = o.k, an = o.an, s = svgOpen(W, H) + defs(A, W, H) + header(A, W, 'Action Plan · แผนแก้ไข', p);
    s += T(56, 162, 'ปัญหาจากผลที่เลือก:', 18, 600, MUT);
    var x = 250, st0 = Math.max(0, Math.min(idx - 1, probs.length - 3)); probs.slice(st0, st0 + 4).forEach(function (q, j) { var i = st0 + j, c = chipS(x, 142, (i + 1) + '  ' + fit(q.k.name, 17, 300) + ' ' + fmt(q.k, q.v), RED, null, 16, i === idx ? 0.38 : 0.1); if (x + c.w < W - 200) s += c.s; x += c.w + 12; });
    s += T(W - 56, 162, 'เรื่องที่ ' + (idx + 1) + ' / ' + probs.length, 18, 600, MUT, 'end');
    var top = 196, cw = [520, 700, 560], xs = [48, 592, 1316], ph = H - top - 64;
    cw.forEach(function (w, i) { s += panel(xs[i], top, w, ph); });
    var x0 = xs[0];
    s += stepT(x0 + 22, top + 40, 1, 'ผล') + T(x0 + 24, top + 96, fit(k.name, 20, 470), 20, 600, SOFT) + T(x0 + 24, top + 122, fit(k.dim + ' · ' + sysName(k.sys), 15, 470), 15, 400, MUT);
    s += T(x0 + 24, top + 206, fmt(k, o.v), 70, 800, INK, 'start', 'filter="url(#tglow)"');
    if (hasT(k)) s += T(x0 + 24, top + 246, 'เกณฑ์ ' + fmtT(k), 20, 600, YEL) + T(x0 + 260, top + 246, 'ห่างเกณฑ์ ' + gapTxt(k, +k.target - o.v), 20, 700, RED);
    if (o.d != null) s += T(x0 + 24, top + 282, fmtD(k, o.d) + '  เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, ''), 19, 700, o.better > 0 ? GREEN : RED);
    if (o.trend) { s += T(x0 + 24, top + 336, 'แนวโน้ม ' + o.trend.length + ' ' + unitWord(p.mode), 17, 700, INK); s += lineChart(x0 + 80, top + 360, cw[0] - 110, 150, [{ vals: o.trend.map(function (t) { return t.v; }) }], k, o.trend.map(function (t, i) { return i % 2 && o.trend.length > 8 ? '' : t.l; })); }
    var flag = an.run >= 2 ? 'ไม่ผ่านเกณฑ์ ' + an.run + ' ' + unitWord(p.mode) + 'ติด' : an.dec >= 2 ? 'แย่ลงต่อเนื่อง ' + an.dec + ' ' + unitWord(p.mode) : '';
    if (flag) s += '<rect x="' + (x0 + 22) + '" y="' + (top + 572) + '" width="' + (cw[0] - 44) + '" height="64" rx="12" fill="' + RED + '" fill-opacity=".10" stroke="' + RED + '" stroke-opacity=".5"/>' + T(x0 + 40, top + 612, flag, 20, 700, RED);
    if (o.cur && o.cur.n) s += T(x0 + 24, top + ph - 26, 'ตัวตั้ง ' + Math.round(o.cur.n[0]).toLocaleString('en-US') + ' / ตัวหาร ' + Math.round(o.cur.n[1]).toLocaleString('en-US'), 15, 400, MUT);
    var x1 = xs[1], w1 = cw[1];
    s += stepT(x1 + 22, top + 40, 2, an.regsAll.length ? 'ปัญหา · รายภาค' : 'ปัญหา · ราย DC');
    var list = an.regsAll.length ? an.regsAll : an.dcs, rr = range(list.map(function (q) { return q[1]; }), k, 0.4);
    s += hbars(x1 + 24, top + 80, w1 - 48, Math.min(210, list.length * 36), list, k, rr[0], rr[1], an.regsAll.length ? 130 : 230);
    var y = top + 80 + Math.min(210, list.length * 36) + 40;
    if (an.regsAll.length) {
      s += T(x1 + 24, y, 'DC แย่สุด 5 อันดับ', 20, 800, INK);
      an.dcs.forEach(function (d, i) {
        var yy = y + 16 + i * 36, rg = '';
        s += '<rect x="' + (x1 + 22) + '" y="' + yy + '" width="' + (w1 - 44) + '" height="30" rx="8" fill="' + TRK + '" fill-opacity="' + (i % 2 ? 0.05 : 0.09) + '"/>';
        s += T(x1 + 36, yy + 21, (i + 1) + '. ' + fit(d[0], 16, 300), 16, 700, INK) + T(x1 + 420, yy + 21, fmt(k, d[1]), 17, 800, RED) + (d[2] != null ? T(x1 + 540, yy + 21, '(' + Math.round(d[2]).toLocaleString('en-US') + ')', 14, 400, MUT) : '');
        if (an.streak.indexOf(d[0]) >= 0) s += T(x1 + w1 - 36, yy + 21, '🔁 3 ' + unitWord(p.mode) + 'ติด', 14, 700, YEL, 'end');
      });
      y += 16 + Math.max(1, an.dcs.length) * 36 + 34;
    }
    s += '<rect x="' + (x1 + 22) + '" y="' + (y - 24) + '" width="' + (w1 - 44) + '" height="' + (top + ph - y + 8) + '" rx="12" fill="' + CY + '" fill-opacity=".07" stroke="' + CY + '" stroke-opacity=".45"/>';
    s += T(x1 + 40, y + 4, '🔎 ข้อวิเคราะห์ (ระบบสรุปจากตัวเลข)', 18, 800, CY);
    var ly2 = y + 38; (an.lines.length ? an.lines : ['ไม่มีข้อมูลแยกภาค/DC สำหรับวิเคราะห์']).forEach(function (l) { wrap('• ' + l, 16, w1 - 90, 2).forEach(function (t, j) { if (ly2 < top + ph - 10) s += T(x1 + 40 + (j ? 12 : 0), ly2, t, 16, 400, SOFT2); ly2 += 26; }); ly2 += 4; });
    var x2 = xs[2], w2 = cw[2], acts = shownActs(k.id).filter(function (a) { return stOf(a) !== 'done' || a.created >= addD(today(), -30); }).slice(0, 4);
    s += stepT(x2 + 22, top + 40, 3, 'แนวทางแก้ไข');
    if (!acts.length) s += T(x2 + w2 / 2, top + 300, 'ยังไม่ได้กำหนดแนวทาง', 20, 600, MUT, 'middle') + T(x2 + w2 / 2, top + 332, 'เลือกได้ในศูนย์รายงาน › Action Plan', 16, 400, MUT, 'middle');
    acts.forEach(function (a, i) {
      var yy = top + 78 + i * 148, h = HZ[a.hz] || HZ.c, st = STT[stOf(a)];
      s += '<rect x="' + (x2 + 20) + '" y="' + yy + '" width="' + (w2 - 40) + '" height="134" rx="14" fill="' + TRK + '" fill-opacity=".06" stroke="' + TRK + '" stroke-opacity=".12"/><rect x="' + (x2 + 20) + '" y="' + yy + '" width="6" height="134" rx="3" fill="' + h.c + '"/>';
      s += T(x2 + 42, yy + 34, fit((i + 1) + '. ' + a.title, 18, w2 - 80), 18, 700, INK);
      s += T(x2 + 42, yy + 66, '👤 ' + a.owner, 16, 400, SOFT) + T(x2 + 260, yy + 66, fit('📍 ' + a.scope, 16, w2 - 290), 16, 400, SOFT);
      var c1 = chipS(x2 + 42, yy + 84, h.t, h.c, null, 15); s += c1.s + T(x2 + 42 + c1.w + 12, yy + 106, '📅 ' + dTh(a.start) + '–' + dTh(a.due, 1), 15, 600, INK);
      s += chipS(x2 + w2 - 150, yy + 84, st.t + (a.pct ? ' ' + a.pct + '%' : ''), st.c, 110, 13).s;
    });
    if (hasT(k)) s += T(x2 + 24, top + ph - 30, 'เป้าหมายหลังแก้: ' + fmtT(k), 17, 700, YEL);
    s += footer(W, H, 'ผล: KPI ที่เลือก · ปัญหา: จุดที่แย่สุดของผลนั้น (ภาค + DC 5 อันดับ) · แนวทาง/ไทม์ไลน์: ผู้ดูแลกำหนด');
    return s + '</svg>';
  }
  /* ---- slide: all problems on one page (max 5 rows per page) ---- */
  function svgApOne(A, probs, p, page, pages) {
    var W = 1920, H = 1080, s = svgOpen(W, H) + defs(A, W, H) + header(A, W, 'Action Plan · สรุปรวม', p), rows = probs.slice(page * 5, page * 5 + 5);
    var acts = openActs().filter(function (a) { return probs.some(function (q) { return q.k.id === a.kpi; }); }), y0 = 146;
    s += panel(48, y0, W - 96, 64, 14, false) + T(76, y0 + 42, 'ปัญหาจากผลที่เลือก ' + probs.length + ' เรื่อง', 24, 800, INK);
    var by = {}; acts.forEach(function (a) { by[a.owner] = (by[a.owner] || 0) + 1; });
    s += T(470, y0 + 42, fit('แนวทาง ' + acts.length + ' งาน · ' + Object.keys(by).map(function (o) { return o + ' ' + by[o]; }).join(' · '), 20, 760), 20, 600, MUT);
    ['w', 'm', 'n'].forEach(function (h, i) { s += chipS(1290 + i * 175, y0 + 16, HZ[h].t + ' ' + acts.filter(function (a) { return a.hz === h; }).length, HZ[h].c, 160, 16).s; });
    if (pages > 1) s += T(W - 70, y0 + 42, (page + 1) + '/' + pages, 18, 600, MUT, 'end');
    var gx = 48, gy = 226, gw = W - 96, gh = H - gy - 60;
    s += panel(gx, gy, gw, gh, 18, false);
    [['①  ผล', 24], ['②  ปัญหา · ภาค / DC แย่สุด 5', 370], ['🔎  ข้อวิเคราะห์', 820], ['③  แนวทางแก้ไข · ผู้รับผิดชอบ', 1170], ['④  กำหนดเสร็จ', 1610]].forEach(function (c) { s += T(gx + c[1], gy + 40, c[0], 19, 800, 'url(#gold)', 'start', 'filter="url(#gglow)"'); });
    s += '<line x1="' + (gx + 16) + '" y1="' + (gy + 58) + '" x2="' + (gx + gw - 16) + '" y2="' + (gy + 58) + '" stroke="' + YEL + '" stroke-opacity=".5"/>';
    var rh = (gh - 80) / Math.max(4, rows.length), y = gy + 66;
    rows.forEach(function (o, i) {
      var k = o.k, an = o.an, n = page * 5 + i + 1, list = shownActs(k.id).filter(function (a) { return stOf(a) !== 'done'; }).slice(0, 2);
      if (i) s += '<line x1="' + (gx + 16) + '" y1="' + y + '" x2="' + (gx + gw - 16) + '" y2="' + y + '" stroke="' + TRK + '" stroke-opacity=".10"/>';
      s += '<circle cx="' + (gx + 40) + '" cy="' + (y + 34) + '" r="15" fill="' + RED + '"/>' + T(gx + 40, y + 40, String(n), 17, 800, INK, 'middle');
      s += T(gx + 66, y + 40, fit(k.name, 17, 290), 17, 700, SOFT) + T(gx + 66, y + 90, fmt(k, o.v), 38, 800, INK, 'start', 'filter="url(#tglow)"');
      if (o.d != null) s += T(gx + 330, y + 88, fmtD(k, o.d), 17, 700, o.better > 0 ? GREEN : RED, 'end');
      s += T(gx + 66, y + 120, hasT(k) ? 'เกณฑ์ ' + fmtT(k) : 'ไม่มีเกณฑ์ (เทียบช่วงก่อน)', 15, 600, hasT(k) ? YEL : MUT);
      var px = gx + 370, d5 = an.dcs.map(function (d) { return d[0].replace(/^\d+\s*(C?DC\s*)?/, '') + ' ' + fmt(k, d[1]).replace(/%$/, '') + (an.streak.indexOf(d[0]) >= 0 ? '🔁' : ''); });
      if (an.regs.length) s += T(px, y + 36, 'ภาคแย่สุด', 13, 700, MUT) + T(px, y + 58, fit(an.regs.map(function (r) { return r[0] + ' ' + fmt(k, r[1]); }).join(' · '), 15, 430), 15, 700, RED);
      s += T(px, y + (an.regs.length ? 88 : 36), 'DC แย่สุด 5', 13, 700, MUT);
      s += T(px, y + (an.regs.length ? 110 : 58), fit(d5.slice(0, 3).join(' · '), 14, 430), 14, 400, INK) + (d5.length > 3 ? T(px, y + (an.regs.length ? 131 : 79), fit(d5.slice(3).join(' · '), 14, 430), 14, 400, INK) : '');
      var ax = gx + 820; s += '<rect x="' + (ax - 10) + '" y="' + (y + 12) + '" width="330" height="' + (rh - 24) + '" rx="10" fill="' + CY + '" fill-opacity=".07" stroke="' + CY + '" stroke-opacity=".35"/>';
      var avail = Math.max(1, Math.floor((rh - 30) / 22)), ly = y + 38;
      an.lines.forEach(function (l) { var ws = wrap('• ' + l, 13.5, 312, 2); if (avail < ws.length) return; ws.forEach(function (t, j) { s += T(ax + 4 + (j ? 10 : 0), ly, t, 13.5, 400, SOFT2); ly += 21; avail--; }); ly += 4; });
      var bx = gx + 1170;
      if (!list.length) s += T(bx, y + 50, 'ยังไม่ได้กำหนดแนวทาง', 16, 600, MUT);
      list.forEach(function (a, j) { var yy = y + 24 + j * Math.min(56, rh / 2.2); s += T(bx, yy + 18, fit((j + 1) + '. ' + a.title, 15, 420), 15, 700, INK) + chipS(bx + 18, yy + 26, a.owner, a.owner === 'Fleet Planning' ? YEL : CY, null, 12).s; });
      var hx = gx + 1610, a0 = list[0];
      if (a0) { var h = HZ[a0.hz] || HZ.c, st = STT[stOf(a0)]; s += chipS(hx, y + 24, h.t, h.c, 150, 15).s + T(hx, y + 78, '📅 ' + dTh(a0.start) + '–' + dTh(a0.due), 15, 700, INK) + chipS(hx, y + 92, st.t, st.c, 150, 13, 0.2).s; }
      y += rh;
    });
    s += footer(W, H, 'ปัญหาเรียงจากแย่สุด · 🔁 = ไม่ผ่าน 3 ' + unitWord(p.mode) + 'ติด · หน้าถัดไป: ไทม์ไลน์');
    return s + '</svg>';
  }
  /* ---- slide: timeline (Gantt) ---- */
  function svgTimeline(A, p, res, page) {
    var W = 1920, H = 1080, s = svgOpen(W, H) + defs(A, W, H) + header(A, W, 'ไทม์ไลน์การแก้ไข', p), acts = openActs(), t = today();
    var cnt = { todo: 0, doing: 0, done: 0, late: 0 }; acts.forEach(function (a) { cnt[stOf(a)]++; });
    var y0 = 146; s += panel(48, y0, W - 96, 70, 14, false);
    [['งานทั้งหมด ' + acts.length, INK], ['กำลังทำ ' + cnt.doing, CY], ['เสร็จ ' + cnt.done, GREEN], ['ล่าช้า ' + cnt.late, RED], ['ยังไม่เริ่ม ' + cnt.todo, MUT]].forEach(function (c, i) { s += T(76 + i * 240, y0 + 45, c[0], 24, 800, c[1]); });
    s += T(W - 76, y0 + 45, 'วันที่ทำรายงาน: ' + TH_DS[pd(t).getDay()] + ' ' + dTh(t, 1), 18, 600, MUT, 'end');
    var gx = 48, gy = 236, gw = W - 96, gh = H - gy - 70, lx = gx + 24, tl = gx + 860, tr = gx + gw - 24;
    s += panel(gx, gy, gw, gh, 18, false);
    if (!acts.length) return s + T(W / 2, gy + gh / 2, 'ยังไม่มีงานแก้ไข · กำหนดได้ในศูนย์รายงาน › Action Plan', 22, 600, MUT, 'middle') + footer(W, H, '') + '</svg>';
    [['งาน / KPI', lx], ['ผู้รับผิดชอบ', lx + 470], ['สถานะ', lx + 680]].forEach(function (c) { s += T(c[1], gy + 40, c[0], 17, 700, MUT); });
    var a0 = acts.reduce(function (m, a) { return a.start < m ? a.start : m; }, t), a1 = acts.reduce(function (m, a) { return a.due > m ? a.due : m; }, t);
    var st0 = monday(a0 < addD(t, -7) ? addD(t, -7) : a0), nW = Math.ceil((DT.diffD(st0, a1) + 1) / 7), monthly = nW > 12;
    var cols = [];
    if (monthly) { var m = st0.slice(0, 8) + '01'; while (m <= a1) { cols.push({ a: m, b: monthEnd(m), l: TH_ML[pd(m).getMonth()] }); m = iso(new Date(pd(m).getFullYear(), pd(m).getMonth() + 1, 1)); } }
    else for (var i = 0; i < Math.max(nW, 4); i++) { var wa = addD(st0, i * 7), wb = addD(wa, 5); cols.push({ a: wa, b: addD(wa, 6), l: (pd(wa).getMonth() === pd(wb).getMonth() ? pd(wa).getDate() : dTh(wa)) + '–' + dTh(wb) }); }
    var cw = (tr - tl) / cols.length, span0 = cols[0].a, spanD = DT.diffD(span0, cols[cols.length - 1].b) + 1;
    var X = function (d) { return tl + (tr - tl) * Math.max(0, Math.min(spanD, DT.diffD(span0, d))) / spanD; };
    cols.forEach(function (c, i) { var x = tl + i * cw; s += '<line x1="' + x.toFixed(0) + '" y1="' + (gy + 60) + '" x2="' + x.toFixed(0) + '" y2="' + (gy + gh - 20) + '" stroke="' + TRK + '" stroke-opacity=".07"/>' + T(x + cw / 2, gy + 50, fit(c.l, 14, cw - 6), 14, 600, SOFT, 'middle'); });
    var tx = X(t); s += '<line x1="' + tx.toFixed(0) + '" y1="' + (gy + 36) + '" x2="' + tx.toFixed(0) + '" y2="' + (gy + gh - 20) + '" stroke="' + YEL + '" stroke-width="2.5"/>' + T(tx, gy + gh - 4, 'วันนี้', 14, 700, YEL, 'middle');
    var rows = [], seen = {};
    acts.slice().sort(function (a, b) { return a.kpi < b.kpi ? -1 : a.kpi > b.kpi ? 1 : a.start < b.start ? -1 : 1; }).forEach(function (a) {
      if (!seen[a.kpi]) { seen[a.kpi] = 1; var o = (res || []).filter(function (q) { return q.k.id === a.kpi; })[0], base = actsFor(a.kpi).reduce(function (m, x) { return x.base != null && (!m || x.created < m.created) ? x : m; }, null);
        var kk = o ? o.k : { unit: a.unit, dir: 1 }, later = o && o.v != null && base && base.created < p.a, head = a.kname + (base && base.base != null ? '  ·  เริ่ม ' + fmt(kk, base.base) + (later ? ' → ตอนนี้ ' + fmt(kk, o.v) : '') : '');
        rows.push({ h: head, up: later && base.base != null ? better(kk, o.v - base.base) : 0 }); }
      rows.push({ a: a });
    });
    var per = 13, pg = rows.slice(page * per, page * per + per), rh = (gh - 100) / per, y = gy + 70;
    pg.forEach(function (r) {
      if (r.h) { s += '<rect x="' + (gx + 12) + '" y="' + (y + 4) + '" width="' + (gw - 24) + '" height="' + (rh - 8) + '" rx="8" fill="' + YEL + '" fill-opacity=".10"/>' + T(lx, y + rh * 0.66, fit('▸ ' + r.h, 17, gw - 120), 17, 800, YEL) + (r.up ? T(gx + gw - 30, y + rh * 0.66, r.up > 0 ? 'ดีขึ้นหลังเริ่มแก้ ▲' : 'ยังไม่ดีขึ้น ▼', 15, 700, r.up > 0 ? GREEN : RED, 'end') : ''); }
      else {
        var a = r.a, st = STT[stOf(a)], b0 = X(a.start) + 2, b1 = Math.max(b0 + 14, X(addD(a.due, 1)) - 2), by = y + rh * 0.5 - 11;
        s += T(lx + 18, y + rh * 0.64, fit(a.title, 16, 440), 16, 600, INK) + T(lx + 470, y + rh * 0.64, fit(a.owner, 15, 200), 15, 400, SOFT) + chipS(lx + 680, y + rh * 0.5 - 13, st.t, st.c, 110, 13).s;
        s += '<rect x="' + b0.toFixed(0) + '" y="' + by.toFixed(0) + '" width="' + (b1 - b0).toFixed(0) + '" height="22" rx="11" fill="' + st.c + '" fill-opacity=".25" stroke="' + st.c + '"/>';
        var pc = a.status === 'done' ? 100 : a.pct || 0; if (pc) s += '<rect x="' + b0.toFixed(0) + '" y="' + by.toFixed(0) + '" width="' + ((b1 - b0) * pc / 100).toFixed(0) + '" height="22" rx="11" fill="' + st.c + '"/>';
        s += T(Math.min(b1 + 10, tr - 40), by + 17, pc + '%', 14, 700, INK);
      }
      y += rh;
    });
    var pages = Math.ceil(rows.length / per);
    s += footer(W, H, 'แถบ = ช่วงที่ต้องแก้ · สีเต็ม = % ความคืบหน้า · งานค้างยกไปรายงานรอบถัดไปอัตโนมัติ' + (pages > 1 ? ' · หน้า ' + (page + 1) + '/' + pages : ''));
    return { svg: s + '</svg>', pages: pages };
  }
  function apSlides(A, res, p) {
    var all = problems(res, p), probs = all.filter(function (o) { return !hiddenK(o.k.id); }), out = [], tag = fileTag(p);
    if (UI.apFmt === 'each') probs.forEach(function (o, i) { out.push({ name: tag + '_action' + (i + 1), t: 'Action Plan · ' + o.k.name, svg: svgApEach(A, probs, i, p), ap: 1, kind: 'apeach', probs: probs, idx: i }); });
    else if (probs.length) { var pgs = Math.ceil(probs.length / 5); for (var i = 0; i < pgs; i++) out.push({ name: tag + '_action' + (pgs > 1 ? i + 1 : ''), t: 'Action Plan · สรุปรวม', svg: svgApOne(A, probs, p, i, pgs), ap: 1, kind: 'apone', probs: probs, page: i, pages: pgs }); }
    var t0 = svgTimeline(A, p, res, 0); out.push({ name: tag + '_timeline', t: 'ไทม์ไลน์การแก้ไข', svg: t0.svg || t0, ap: 1, kind: 'tl', page: 0 });
    for (var j = 1; j < (t0.pages || 1); j++) out.push({ name: tag + '_timeline' + (j + 1), t: 'ไทม์ไลน์การแก้ไข ' + (j + 1), svg: svgTimeline(A, p, res, j).svg, ap: 1, kind: 'tl', page: j });
    return { slides: out, probs: all };
  }
  function apText() {
    var acts = openActs(); if (!acts.length) return '';
    var late = acts.filter(function (a) { return stOf(a) === 'late'; }), urgent = acts.filter(function (a) { return stOf(a) !== 'done'; }).sort(function (a, b) { return (stOf(b) === 'late') - (stOf(a) === 'late') || (a.due < b.due ? -1 : 1); }).slice(0, 3);
    return '\n🛠 Action Plan · งาน ' + acts.length + ' · ล่าช้า ' + late.length + ' · เสร็จ ' + acts.filter(function (a) { return a.status === 'done'; }).length + '\n' + urgent.map(function (a) { return (stOf(a) === 'late' ? '🔴' : '🟡') + ' ' + a.title + ' — ' + a.owner + ' · ครบ ' + dTh(a.due) + (a.pct ? ' (' + a.pct + '%)' : ''); }).join('\n') + '\n';
  }

  /* ---- editor (in the report panel) ---- */
  function renderAp() {
    var el = $('repAp'); if (!el || !LAST) return;
    var probs = LAST.probs || [], os = owners();
    var oSel = function (v) { return '<select data-a="owner">' + os.concat(os.indexOf(v) < 0 && v ? [v] : []).map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '<option value="__new">+ พิมพ์ชื่ออื่น…</option></select>'; };
    var hSel = function (v) { return '<select data-a="hz">' + ['w', 'm', 'n', 'c'].map(function (h) { return '<option value="' + h + '"' + (h === v ? ' selected' : '') + '>' + HZ[h].t + '</option>'; }).join('') + '</select>'; };
    var nHid = probs.filter(function (o) { return hiddenK(o.k.id); }).length;
    var html = '<h3>Action Plan <small>ปัญหาจากผลที่เลือก ' + probs.length + ' เรื่อง' + (nHid ? ' · ซ่อนในรอบนี้ ' + nHid : '') + ' · ติ๊กแนวทาง เลือกผู้รับผิดชอบและระยะเวลา แล้วกดบันทึก · เอาติ๊ก "แสดง" ออกถ้าไม่นำเสนอเรื่องนั้นในรอบนี้</small></h3>';
    if (!probs.length) html += '<p class="rep-note">ไม่มี KPI ที่ไม่ผ่านเกณฑ์หรือแย่ลงในผลที่เลือก</p>';
    probs.forEach(function (o, pi) {
      var k = o.k, an = o.an, have = actsFor(k.id).filter(function (a) { return a.status !== 'done'; }), hid = hiddenK(k.id);
      html += '<fieldset class="ap-p' + (hid ? ' off' : '') + '" data-p="' + pi + '"><legend>' + (pi + 1) + '. ' + esc(k.name) + ' <b class="bad">' + esc(fmt(k, o.v)) + '</b>' + (hasT(k) ? ' <small>เกณฑ์ ' + esc(fmtT(k)) + '</small>' : '') +
        ' <label class="ap-show"><input type="checkbox" data-showk="' + esc(k.id) + '"' + (hid ? '' : ' checked') + '> แสดงในรายงานรอบนี้</label></legend>' +
        (hid ? '<p class="rep-note">ซ่อนจากรายงาน ' + esc(label(LAST.p).replace(/\s+\(.*/, '')) + ' (สไลด์ ไทม์ไลน์ LINE และรูปแนวตั้ง) · รอบถัดไปจะแสดงกลับเอง · งานไม่ถูกลบ</p></fieldset>' : '') +
        '<p class="ap-an">' + (an.regs.length ? '<b>ภาคแย่สุด:</b> ' + esc(an.regs.map(function (r) { return r[0] + ' ' + fmt(k, r[1]); }).join(' · ')) + '<br>' : '') + (an.dcs.length ? '<b>DC แย่สุด 5:</b> ' + esc(an.dcs.map(function (d) { return d[0] + ' ' + fmt(k, d[1]); }).join(' · ')) + '<br>' : '') + an.lines.map(function (l) { return '🔎 ' + esc(l); }).join('<br>') + '</p>' +
        (hid ? '' : (have.length ? '<p class="rep-note">มีงานค้างของ KPI นี้ ' + have.length + ' งาน (แก้สถานะได้ในตารางงานด้านล่าง)</p>' : '') +
        playbook(k.id).concat([{ t: '', o: os[0] }]).map(function (pbk, i) {
          var t = pbk.t.replace('{พื้นที่}', an.scope), exists = have.some(function (a) { return a.title === t; }), d = hzDates('w');
          return '<div class="ap-row" data-i="' + i + '"><input type="checkbox" data-a="on"' + (exists ? ' disabled title="มีงานนี้อยู่แล้ว"' : '') + '><input data-a="title" value="' + esc(t) + '" placeholder="พิมพ์แนวทางอื่น…" maxlength="160">' + oSel(pbk.o) + hSel('w') + '<input type="date" data-a="start" value="' + d[0] + '"><input type="date" data-a="due" value="' + d[1] + '"></div>';
        }).join('') + '</fieldset>');
    });
    var acts = actions().slice().sort(function (a, b) { return (a.status === 'done') - (b.status === 'done') || (a.due < b.due ? -1 : 1); });
    html += '<h3>งานแก้ไขทั้งหมด <small>' + acts.length + ' งาน · งานที่ยังไม่เสร็จยกไปรายงานรอบถัดไปเอง</small></h3>' +
      (acts.length ? '<div class="rep-tw"><table class="rep-t"><thead><tr><th title="แสดงในรายงานรอบนี้">แสดง</th><th>งาน</th><th>KPI</th><th>ผู้รับผิดชอบ</th><th>ช่วง</th><th>สถานะ</th><th>%</th><th></th></tr></thead><tbody>' + acts.map(function (a) {
        return '<tr data-id="' + esc(a.id) + '"' + (hiddenA(a.id) || hiddenK(a.kpi) ? ' class="off"' : '') + '><td><input type="checkbox" data-showa="' + esc(a.id) + '"' + (hiddenA(a.id) ? '' : ' checked') + (hiddenK(a.kpi) ? ' disabled title="KPI นี้ถูกซ่อนในรอบนี้"' : '') + ' aria-label="แสดงในรายงานรอบนี้"></td><td><input data-e="title" value="' + esc(a.title) + '" maxlength="160" style="min-width:260px"></td><td>' + esc(a.kname) + '</td><td>' + esc(a.owner) + '</td><td class="nw"><input type="date" data-e="start" value="' + a.start + '"> – <input type="date" data-e="due" value="' + a.due + '"></td>' +
          '<td><select data-e="status">' + ['todo', 'doing', 'done'].map(function (s) { return '<option value="' + s + '"' + (a.status === s ? ' selected' : '') + '>' + STT[s].t + '</option>'; }).join('') + '</select>' + (stOf(a) === 'late' ? ' <b class="bad">ล่าช้า</b>' : '') + '</td>' +
          '<td><input type="number" min="0" max="100" step="5" data-e="pct" value="' + (a.pct || 0) + '" style="width:64px"></td><td><button type="button" class="act" data-del="' + esc(a.id) + '" title="ลบ">✕</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="rep-note">ยังไม่มีงาน</p>') +
      '<div class="rep-row"><button type="button" class="btn pri" id="apSave">บันทึก Action Plan และอัปเดตสไลด์</button><span class="rep-note">บันทึกลง Sheet ของ Hub (เฉพาะผู้ดูแล)</span></div>';
    el.innerHTML = html; el.hidden = false;
    [].forEach.call(el.querySelectorAll('select[data-a="owner"]'), function (sel) { sel.onchange = function () { if (sel.value !== '__new') return; var v = (prompt('ชื่อผู้รับผิดชอบ') || '').trim().slice(0, 40); if (!v) { sel.selectedIndex = 0; return; } var op = document.createElement('option'); op.textContent = v; op.selected = true; sel.insertBefore(op, sel.lastChild); }; });
    [].forEach.call(el.querySelectorAll('select[data-a="hz"]'), function (sel) { sel.onchange = function () { if (sel.value === 'c') return; var r = sel.closest('.ap-row'), d = hzDates(sel.value); r.querySelector('[data-a="start"]').value = d[0]; r.querySelector('[data-a="due"]').value = d[1]; }; });
    [].forEach.call(el.querySelectorAll('.ap-row input[data-a="title"]'), function (inp) { inp.oninput = function () { var c = inp.parentNode.querySelector('[data-a="on"]'); if (inp.value.trim() && !c.disabled) c.checked = true; }; });
    [].forEach.call(el.querySelectorAll('[data-showk]'), function (c) { c.onchange = function () { setHide(UI.apHide, c.dataset.showk, !c.checked); rebuildAp(); }; });
    [].forEach.call(el.querySelectorAll('[data-showa]'), function (c) { c.onchange = function () { setHide(UI.apHideAct, c.dataset.showa, !c.checked); rebuildAp(); }; });
    [].forEach.call(el.querySelectorAll('[data-del]'), function (b) { b.onclick = function () { if (!confirm('ลบงานนี้?')) return; saveActions(actions().filter(function (a) { return a.id !== b.dataset.del; }), 'ลบงานแล้ว').then(rebuildAp); }; });
    $('apSave').onclick = function () {
      var list = clone(actions()), now = today(), added = 0;
      [].forEach.call(el.querySelectorAll('tr[data-id]'), function (tr) { var a = list.filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!a) return; [].forEach.call(tr.querySelectorAll('[data-e]'), function (i) { var f = i.dataset.e, v = i.value; if (f === 'pct') v = Math.max(0, Math.min(100, Math.round(+v || 0))); if ((f === 'start' || f === 'due') && !v) return; if (f === 'title' && !v.trim()) return; a[f] = v; }); if (a.status === 'done') a.pct = 100; if (a.due < a.start) a.due = a.start; });
      [].forEach.call(el.querySelectorAll('.ap-p'), function (fs) {
        var o = probs[+fs.dataset.p];
        [].forEach.call(fs.querySelectorAll('.ap-row'), function (r) {
          var on = r.querySelector('[data-a="on"]'), title = r.querySelector('[data-a="title"]').value.trim(); if (!on.checked || !title) return;
          var st = r.querySelector('[data-a="start"]').value || now, du = r.querySelector('[data-a="due"]').value || st;
          list.push({ id: 'a' + Date.now().toString(36) + (added++), kpi: o.k.id, kname: o.k.name.slice(0, 80), prob: (o.an.regs.length ? 'ภาค ' + o.an.regs.map(function (x) { return x[0]; }).join(', ') : o.an.dcs.slice(0, 3).map(function (x) { return x[0]; }).join(', ')).slice(0, 200),
            title: title.slice(0, 160), owner: r.querySelector('[data-a="owner"]').value.slice(0, 40), scope: o.an.scope.slice(0, 120), hz: r.querySelector('[data-a="hz"]').value, start: st, due: du < st ? st : du, status: 'todo', pct: 0, created: now, base: o.v, unit: o.k.unit });
        });
      });
      if (list.length > 150) { var keep = list.filter(function (a) { return a.status !== 'done'; }), done = list.filter(function (a) { return a.status === 'done'; }).sort(function (a, b) { return a.due < b.due ? 1 : -1; }); list = keep.concat(done).slice(0, 150); }
      saveActions(list, added ? 'เพิ่มงานแก้ไข ' + added + ' งานแล้ว' : 'บันทึก Action Plan แล้ว').then(function (ok) { if (ok !== false) rebuildAp(); });
    };
  }
  function rebuildAp() {
    if (!LAST) return;
    assets().then(function (A) {
      renderSlides(A);
      showPreview(); if (UI.ap) renderAp(); else if ($('repAp')) $('repAp').hidden = true;
      msg('สร้างแล้ว ' + SLIDES.length + ' ภาพ' + (UI.ap ? ' (รวม Action Plan)' : ''));
    });
  }
  /* owners + playbook settings */
  function renderApSet() {
    var el = $('repApSet'); if (!el) return;
    var ks = kpis(), cur = el.dataset.k || ks[0].id;
    el.innerHTML = '<h3>ตั้งค่า Action Plan</h3><label class="rep-date">ผู้รับผิดชอบ (บรรทัดละชื่อ)</label><textarea id="apOwners" rows="3">' + esc(owners().join('\n')) + '</textarea>' +
      '<label class="rep-date">คลังแนวทางของ KPI <select id="apK">' + ks.map(function (k) { return '<option value="' + k.id + '"' + (k.id === cur ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') + '</select></label>' +
      '<textarea id="apPb" rows="6" placeholder="บรรทัดละ 1 แนวทาง · ใส่ | ตามด้วยผู้รับผิดชอบ · {พื้นที่} = ภาค/DC ที่แย่สุด">' + esc(playbook(cur).map(function (x) { return x.t + ' | ' + x.o; }).join('\n')) + '</textarea>' +
      '<div class="rep-row"><button type="button" class="btn pri" id="apSetSave">บันทึกผู้รับผิดชอบและคลังแนวทาง</button></div>';
    $('apK').onchange = function () { el.dataset.k = this.value; renderApSet(); };
    $('apSetSave').onclick = function () {
      var os = $('apOwners').value.split('\n').map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 30);
      if (!os.length) return APP().toast('ใส่ผู้รับผิดชอบอย่างน้อย 1 ชื่อ', true);
      var pb = clone(AP.playbook || window.HUB_PLAYBOOK || {}), id = $('apK').value;
      pb[id] = $('apPb').value.split('\n').map(function (l) { var p2 = l.split('|'); return { t: p2[0].trim().slice(0, 160), o: (p2[1] || os[0]).trim().slice(0, 40) }; }).filter(function (x) { return x.t; }).slice(0, 12);
      APP().save({ owners: os, playbook: pb }, 'บันทึกการตั้งค่า Action Plan แล้ว').then(function (ok) { if (ok !== false) { AP.owners = os; AP.playbook = pb; renderApSet(); } });
    };
  }

  /* ================= PowerPoint แบบแก้ไขได้ (ธีม light / navy) =================
     ข้อความ ตาราง และกราฟเป็นของ PowerPoint จริง · ฟอนต์ DB Heavent (เครื่องที่ไม่มีฟอนต์นี้ PowerPoint จะแทนด้วยฟอนต์อื่น)
     พิกัดออกแบบที่ 1920×1080 แล้วแปลงเป็นนิ้ว (13.333×7.5) */
  var PF = 'DB Heavent', KX = 13.333 / 1920;
  function ix(v) { return +(v * KX).toFixed(3); }
  function hx(c) { return String(c).replace('#', '').slice(0, 6).toUpperCase(); }
  function pt(px) { return Math.round(px * 0.75 * 1.1); }   /* DB Heavent ตัวเล็กกว่า Prompt · เผื่อเครื่องที่ใช้ฟอนต์แทน */
  function NP(P, A, p, title) {   /* new slide with header + footer */
    var L = TH === 'light', sl = P.addSlide();
    sl.background = { color: hx(BGC) };
    if (L) sl.addShape(P.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: ix(124), fill: { color: 'F5F7FB' }, line: { color: 'F5F7FB' } });
    sl.addShape(P.ShapeType.roundRect, { x: ix(48), y: ix(20), w: ix(136), h: ix(88), fill: { color: 'FFFFFF' }, line: { color: L ? 'D9E0EB' : 'FFFFFF' }, rectRadius: 0.08 });
    sl.addImage({ data: A.logoS || A.logo, x: ix(56), y: ix(26), w: ix(120), h: ix(76), sizing: { type: 'contain', w: ix(120), h: ix(76) } });
    sl.addShape(P.ShapeType.rect, { x: ix(212), y: ix(32), w: ix(6), h: ix(64), fill: { color: hx(YEL) }, line: { color: hx(YEL) } });
    sl.addText(title, { x: ix(230), y: ix(24), w: ix(1920 - 230 - 48 - 740), h: ix(80), fontFace: PF, fontSize: pt(44), bold: true, color: hx(TITLEC), valign: 'middle', fit: 'shrink' });
    var bx = 1920 - 48 - 720, m = MODES[p.mode];
    sl.addShape(P.ShapeType.roundRect, { x: ix(bx), y: ix(18), w: ix(720), h: ix(88), fill: { color: hx(PERBG) }, line: { color: L ? '0B2A5B' : hx(PERBG), width: L ? 1.5 : 0 }, rectRadius: 0.1 });
    sl.addShape(P.ShapeType.roundRect, { x: ix(bx + 14), y: ix(28), w: ix(120), h: ix(30), fill: { color: L ? '0B2A5B' : hx(YEL) }, line: { color: L ? '0B2A5B' : hx(YEL) }, rectRadius: 0.5 });
    sl.addText(m.en, { x: ix(bx + 14), y: ix(28), w: ix(120), h: ix(30), fontFace: PF, fontSize: pt(16), bold: true, color: L ? 'FFFFFF' : '0A1A3A', align: 'center', valign: 'middle', margin: 0 });
    sl.addText(m.th, { x: ix(bx + 146), y: ix(26), w: ix(250), h: ix(34), fontFace: PF, fontSize: pt(17), bold: true, color: hx(YEL), valign: 'middle', margin: 0 });
    sl.addText(label(p), { x: ix(bx + 400), y: ix(24), w: ix(306), h: ix(38), fontFace: PF, fontSize: pt(22), bold: true, color: hx(INK), align: 'right', valign: 'middle', margin: 0, fit: 'shrink' });
    sl.addText('เทียบกับ  ' + label(prevOf(p)), { x: ix(bx + 16), y: ix(66), w: ix(690), h: ix(32), fontFace: PF, fontSize: pt(18), color: hx(SOFT), align: 'right', valign: 'middle', margin: 0 });
    sl.addShape(P.ShapeType.rect, { x: 0, y: ix(124), w: 13.333, h: ix(4), fill: { color: hx(YEL) }, line: { color: hx(YEL) } });
    return sl;
  }
  function NF(P, sl, txt) {
    sl.addText(txt, { x: ix(48), y: ix(1036), w: ix(1360), h: ix(34), fontFace: PF, fontSize: pt(15), color: hx(MUT), valign: 'middle', margin: 0, fit: 'shrink' });
    sl.addText('Fleet Planning', { x: ix(1440), y: ix(1026), w: ix(432), h: ix(48), fontFace: PF, fontSize: pt(28), bold: true, italic: true, color: hx(BRAND.indexOf('url') === 0 ? '#f2c14e' : BRAND), align: 'right', valign: 'middle', margin: 0 });
  }
  function box(P, sl, x, y, w, h, fill) { sl.addShape(P.ShapeType.roundRect, { x: ix(x), y: ix(y), w: ix(w), h: ix(h), fill: { color: hx(fill || PANEL) }, line: { color: TH === 'light' ? 'D9E0EB' : hx(fill || PANEL), width: TH === 'light' ? 1 : 0 }, rectRadius: 0.12 }); }
  function tx(sl, s, x, y, w, h, o) { o = o || {}; sl.addText(s, Object.assign({ x: ix(x), y: ix(y), w: ix(w), h: ix(h), fontFace: PF, fontSize: pt(o.size || 20), color: hx(o.color || INK), bold: !!o.bold, align: o.align || 'left', valign: o.valign || 'middle', margin: 0, fit: 'shrink' }, o.x2 || {})); }
  function stColor(o) { return o.st > 0 ? GREEN : o.st < 0 ? RED : MUT; }
  function badgeN(P, sl, x, y, w, h, s, c, outline) { sl.addShape(P.ShapeType.roundRect, { x: ix(x), y: ix(y), w: ix(w), h: ix(h), fill: { color: outline ? hx(PANEL) : hx(c) }, line: { color: hx(c), width: 1.5 }, rectRadius: 0.5 }); tx(sl, s, x, y, w, h, { size: h * 0.5, bold: true, align: 'center', color: outline ? c : '#ffffff' }); }
  function hbarsN(P, sl, x, y, w, h, items, k) {
    if (!items.length) return tx(sl, 'ไม่มีข้อมูลแยก', x, y + h / 2 - 15, w, 30, { color: MUT, align: 'center' });
    var r = range(items.map(function (i) { return i[1]; }), k, 0.4), lo = r[0], hi = r[1], n = items.length, rh = h / n, lw = items.some(function (i) { return String(i[0]).length > 10; }) ? 230 : 140, span = w - lw - 130, t = hasT(k) ? +k.target : null;
    items.forEach(function (it, i) {
      var by = y + i * rh, bh = Math.min(26, rh * 0.62), v = it[1], bw = v == null ? 0 : Math.max(3, span * (v - lo) / (hi - lo || 1)), ok = t == null ? true : (k.dir < 0 ? v <= t : v >= t);
      tx(sl, String(it[0]), x, by, lw - 12, rh, { size: Math.min(18, rh * 0.55), align: 'right', color: SOFT });
      sl.addShape(P.ShapeType.rect, { x: ix(x + lw), y: ix(by + (rh - bh) / 2), w: ix(span), h: ix(bh), fill: { color: hx(TRK), transparency: TH === 'light' ? 92 : 88 }, line: { color: hx(TRK), transparency: 100 } });
      sl.addShape(P.ShapeType.rect, { x: ix(x + lw), y: ix(by + (rh - bh) / 2), w: ix(Math.min(span, bw)), h: ix(bh), fill: { color: hx(ok ? BAR1 : RED) }, line: { color: hx(ok ? BAR1 : RED) } });
      tx(sl, fmt(k, v), x + lw + Math.min(span, bw) + 8, by, 120, rh, { size: Math.min(17, rh * 0.5), bold: true });
    });
    if (t != null && t >= lo && t <= hi) { var tX = x + lw + span * (t - lo) / (hi - lo || 1); sl.addShape(P.ShapeType.line, { x: ix(tX), y: ix(y), w: 0, h: ix(h), line: { color: hx(YEL), width: 2, dashType: 'dash' } }); }
    if (k.unit === '%' && lo > 0) tx(sl, 'แกนเริ่มที่ ' + lo + '%', x, y + h + 2, 300, 22, { size: 13, color: MUT });
  }
  function lineN(P, sl, x, y, w, h, series, k, labels) {
    var data = series.map(function (s2) { return { name: s2.name, labels: labels, values: s2.vals.map(function (v) { return v == null ? null : +(+v).toFixed(2); }) }; });
    if (hasT(k)) data.push({ name: 'เกณฑ์', labels: labels, values: labels.map(function () { return +k.target; }) });
    var cols = [hx(CY), 'B48CFF', hx(GREEN)].slice(0, series.length); if (hasT(k)) cols.push(hx(YEL));
    sl.addChart(P.ChartType.line, data, { x: ix(x), y: ix(y), w: ix(w), h: ix(h), chartColors: cols, lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 7,
      showLegend: series.length > 1 || hasT(k), legendPos: 't', legendFontFace: PF, legendFontSize: 12, legendColor: hx(SOFT),
      catAxisLabelFontFace: PF, catAxisLabelFontSize: 12, catAxisLabelColor: hx(MUT), valAxisLabelFontFace: PF, valAxisLabelFontSize: 11, valAxisLabelColor: hx(MUT),
      valGridLine: { color: TH === 'light' ? 'E3E8F0' : '2A4372', size: 0.5 }, catGridLine: { style: 'none' }, plotArea: { fill: { color: hx(PANEL) } },
      showValue: series.length === 1 && labels.length <= 8, dataLabelFontFace: PF, dataLabelFontSize: 11, dataLabelColor: hx(INK), dataLabelPosition: 't',
      valAxisLabelFormatCode: k.unit === '%' ? '0.0' : '#,##0' });
  }
  function tableN(sl, rows, x, y, w, colW, o) {
    o = o || {};
    var head = rows[0].map(function (c) { return { text: c, options: { bold: true, color: TH === 'light' ? 'FFFFFF' : hx(SOFT), fill: { color: TH === 'light' ? '0B2A5B' : '1B3A72' } } }; });
    var body = rows.slice(1).map(function (r, i) { return r.map(function (c) { var cell = typeof c === 'object' && c !== null && c.text !== undefined ? c : { text: String(c == null ? '' : c) }; cell.options = Object.assign({ color: hx(INK), fill: { color: i % 2 && TH === 'light' ? 'F7F9FC' : hx(PANEL) } }, cell.options || {}); return cell; }); });
    sl.addTable([head].concat(body), { x: ix(x), y: ix(y), w: ix(w), colW: colW.map(ix), fontFace: PF, fontSize: o.size || 14, valign: 'middle', border: { type: 'solid', pt: 0.5, color: TH === 'light' ? 'E3E8F0' : '2A4372' }, rowH: o.rowH ? ix(o.rowH) : undefined, autoPage: false, margin: 0.04 });
  }
  function nSummary(P, A, res, p) {
    var sl = NP(P, A, p, MODES[p.mode].t + ' · สรุปภาพรวม'), hd = head(res);
    var cards = [['ผล', hd.t, GREEN], ['ดีขึ้น', String(hd.up), GREEN], ['แย่ลง', String(hd.dn), RED]];
    cards.forEach(function (c, i) { var x = 48 + i * 380; box(P, sl, x, 152, 360, 84); sl.addShape(P.ShapeType.rect, { x: ix(x), y: ix(152), w: ix(8), h: ix(84), fill: { color: hx(c[2]) }, line: { color: hx(c[2]) } }); tx(sl, c[0], x + 26, 158, 320, 30, { size: 18, color: MUT }); tx(sl, c[1], x + 26, 190, 320, 40, { size: 30, bold: true, color: c[2] }); });
    tx(sl, 'เขียว = ผ่านเกณฑ์ / ดีขึ้น · แดง = ไม่ผ่าน / แย่ลง', 1220, 176, 652, 40, { size: 17, color: MUT, align: 'right' });
    var rows = [['ด้าน', 'ตัวชี้วัด', 'ผล', 'เกณฑ์', 'เทียบช่วงก่อน', 'สถานะ']], last = null;
    res.forEach(function (o) {
      var st = o.v == null ? '–' : hasT(o.k) ? (o.st > 0 ? 'ผ่าน' : 'ไม่ผ่าน') : (o.better > 0 ? 'ดีขึ้น' : o.better < 0 ? 'แย่ลง' : '–');
      rows.push([{ text: o.k.dim === last ? '' : o.k.dim, options: { bold: true, color: hx(CY) } }, o.k.name, { text: fmt(o.k, o.v), options: { bold: true, align: 'right', fontSize: 16 } }, hasT(o.k) ? fmtT(o.k) : '–',
        { text: o.d == null ? '' : fmtD(o.k, o.d), options: { bold: true, color: hx(o.better > 0 ? GREEN : o.better < 0 ? RED : MUT) } },
        { text: st, options: { bold: true, align: 'center', color: st === '–' ? hx(MUT) : TH === 'navy' ? hx(o.st > 0 ? GREEN : RED) : 'FFFFFF', fill: { color: st === '–' || TH === 'navy' ? hx(PANEL) : hx(o.st > 0 ? GREEN : RED) } } }]);
      last = o.k.dim;
    });
    var rh = Math.min(52, (1010 - 262) / rows.length);
    tableN(sl, rows, 40, 258, 1840, [300, 640, 230, 190, 280, 200], { rowH: rh, size: rh > 44 ? 15 : 12 });
    NF(P, sl, sources(res));
  }
  function nKpi(P, A, o, p) {
    var k = o.k, c = o.cur || {}, sl = NP(P, A, p, k.name);
    box(P, sl, 48, 152, 560, 392);
    tx(sl, k.dim + ' · ' + sysName(k.sys), 76, 166, 510, 30, { size: 17, color: MUT });
    tx(sl, fmt(k, o.v), 76, 202, 510, 120, { size: k.unit === '%' ? 96 : 70, bold: true, color: TITLEC.indexOf('url') === 0 ? INK : TITLEC });
    if (hasT(k)) { badgeN(P, sl, 76, 334, 180, 38, o.st > 0 ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์', o.st > 0 ? GREEN : RED); tx(sl, 'เกณฑ์ ' + fmtT(k), 272, 334, 300, 38, { size: 21, color: SOFT }); }
    if (o.d != null) tx(sl, fmtD(k, o.d) + '  เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, '') + '  (' + fmt(k, o.pv) + ')', 76, 392, 520, 40, { size: 21, bold: true, color: o.better > 0 ? GREEN : RED });
    if (c.n && c.n[1] != null) tx(sl, 'ตัวตั้ง ' + Math.round(c.n[0]).toLocaleString('en-US') + ' / ตัวหาร ' + Math.round(c.n[1]).toLocaleString('en-US'), 76, 444, 520, 30, { size: 16, color: MUT });
    box(P, sl, 632, 152, 1240, 392); tx(sl, 'แนวโน้ม' + (o.trend ? ' ' + o.trend.length + ' ' + unitWord(p.mode) : ''), 660, 162, 600, 36, { size: 22, bold: true, color: CY });
    if (o.trend) lineN(P, sl, 650, 200, 1200, 330, [{ name: k.name, vals: o.trend.map(function (t) { return t.v; }) }], k, o.trend.map(function (t) { return t.l; }));
    var reg = c.region || [];
    box(P, sl, 48, 568, 900, 440); tx(sl, reg.length ? 'รายภาค (แย่สุดก่อน)' : 'ราย DC (แย่สุดก่อน)', 76, 578, 600, 36, { size: 22, bold: true, color: CY });
    hbarsN(P, sl, 70, 624, 856, 350, sortBy(reg.length ? reg : bigEnough(c.dc || []), k, true).slice(0, 10), k);
    box(P, sl, 972, 568, 900, 440); tx(sl, 'DC แย่สุด 5 อันดับ', 1000, 578, 600, 36, { size: 22, bold: true, color: CY });
    var w5 = sortBy(worseThan(bigEnough(c.dc || []), k, o.v), k, true).slice(0, 5);
    if (w5.length) tableN(sl, [['#', 'DC', 'ผล', 'จำนวน']].concat(w5.map(function (d, i) { return [String(i + 1), d[0], { text: fmt(k, d[1]), options: { bold: true, color: hx(RED), align: 'right' } }, d[2] == null ? '' : Math.round(d[2]).toLocaleString('en-US')]; })), 996, 618, 852, [56, 446, 230, 120], { rowH: 54, size: 15 });
    else tx(sl, (c.dc || []).length ? 'ไม่มี DC ที่ผลต่ำกว่าค่ารวม' : 'ระบบนี้ไม่มีข้อมูลแยกราย DC', 996, 760, 852, 40, { color: MUT, align: 'center' });
    NF(P, sl, 'ที่มา: ' + sysName(k.sys) + (c.note ? ' · ' + c.note : ''));
  }
  function nDim(P, A, res, p, dn) {
    var ks = res.filter(function (o) { return o.k.dim === dn; }), sl = NP(P, A, p, dn), n = ks.length, cw = (1824 - (n - 1) * 20) / n;
    ks.forEach(function (o, i) {
      var x = 48 + i * (cw + 20); box(P, sl, x, 150, cw, 190);
      tx(sl, o.k.name, x + 20, 160, cw - 40, 40, { size: 17, color: SOFT });
      tx(sl, fmt(o.k, o.v), x + 20, 202, cw - 40, 70, { size: n > 4 ? 40 : 52, bold: true });
      if (o.d != null) tx(sl, fmtD(o.k, o.d), x + 20, 282, cw / 2, 40, { size: 19, bold: true, color: o.better > 0 ? GREEN : RED });
      if (hasT(o.k) && o.v != null) badgeN(P, sl, x + cw - 150, 288, 130, 32, o.st > 0 ? 'ผ่านเกณฑ์' : 'ไม่ผ่าน', o.st > 0 ? GREEN : RED);
    });
    var k0 = ks[0], c0 = k0 && k0.cur || {}, gw = 900;
    box(P, sl, 48, 360, gw, 320); tx(sl, k0.k.name + ((c0.region || []).length ? ' · รายภาค' : ' · ราย DC'), 72, 368, gw - 48, 34, { size: 20, bold: true, color: CY });
    hbarsN(P, sl, 66, 410, gw - 40, 240, sortBy((c0.region || []).length ? c0.region : bigEnough(c0.dc || []), k0.k, true).slice(0, 8), k0.k);
    box(P, sl, 972, 360, gw, 320); var tr = ks.filter(function (o) { return o.trend && o.k.unit === k0.k.unit; }).slice(0, 3);
    tx(sl, 'แนวโน้ม', 996, 368, gw - 48, 34, { size: 20, bold: true, color: CY });
    if (tr.length) lineN(P, sl, 986, 404, gw - 30, 266, tr.map(function (o) { return { name: o.k.name, vals: o.trend.map(function (t) { return t.v; }) }; }), k0.k, tr[0].trend.map(function (t) { return t.l; }));
    box(P, sl, 48, 700, gw, 310); tx(sl, 'DC ผลแย่สุด 5 อันดับ · ' + k0.k.name, 72, 708, gw - 48, 34, { size: 20, bold: true, color: CY });
    var w5 = sortBy(worseThan(bigEnough(c0.dc || []), k0.k, k0.v), k0.k, true).slice(0, 5);
    if (w5.length) tableN(sl, [['#', 'DC', 'ผล']].concat(w5.map(function (d, i) { return [String(i + 1), d[0], { text: fmt(k0.k, d[1]), options: { bold: true, color: hx(RED), align: 'right' } }]; })), 70, 750, gw - 44, [60, 600, 196], { rowH: 42, size: 14 });
    box(P, sl, 972, 700, gw, 310); tx(sl, 'เทียบช่วงก่อนหน้า', 996, 708, gw - 48, 34, { size: 20, bold: true, color: CY });
    tableN(sl, [['ตัวชี้วัด', 'ช่วงก่อน', 'ช่วงนี้', 'ผลต่าง']].concat(ks.map(function (o) { return [o.k.name, fmt(o.k, o.pv), { text: fmt(o.k, o.v), options: { bold: true } }, { text: fmtD(o.k, o.d), options: { bold: true, color: hx(o.better > 0 ? GREEN : o.better < 0 ? RED : MUT) } }]; })), 994, 750, gw - 44, [420, 140, 140, 156], { rowH: Math.min(48, 240 / (n + 1)), size: 14 });
    NF(P, sl, sources(ks));
  }
  function nApOne(P, A, probs, p, page) {
    var sl = NP(P, A, p, 'Action Plan · สรุปรวม'), rows = [['ผล', 'ปัญหา · ภาค / DC แย่สุด 5', 'ข้อวิเคราะห์', 'แนวทางแก้ไข · ผู้รับผิดชอบ', 'กำหนดเสร็จ']];
    probs.slice(page * 5, page * 5 + 5).forEach(function (o, i) {
      var k = o.k, an = o.an, list = shownActs(k.id).filter(function (a) { return stOf(a) !== 'done'; }).slice(0, 3);
      rows.push([
        { text: [{ text: (page * 5 + i + 1) + '. ' + k.name + '\n', options: { fontSize: 13, color: hx(SOFT) } }, { text: fmt(k, o.v), options: { fontSize: 22, bold: true } }, { text: (o.d != null ? '  ' + fmtD(k, o.d) : '') + '\n', options: { fontSize: 13, bold: true, color: hx(o.better > 0 ? GREEN : RED) } }, { text: hasT(k) ? 'เกณฑ์ ' + fmtT(k) : 'ไม่มีเกณฑ์', options: { fontSize: 12, color: hx(YEL) } }] },
        { text: [{ text: an.regs.length ? 'ภาค: ' + an.regs.map(function (r) { return r[0] + ' ' + fmt(k, r[1]); }).join(' · ') + '\n' : '', options: { color: hx(RED), bold: true } }, { text: 'DC: ' + an.dcs.map(function (d) { return d[0] + ' ' + fmt(k, d[1]) + (an.streak.indexOf(d[0]) >= 0 ? ' (3 ช่วงติด)' : ''); }).join(' · ') }] },
        an.lines.map(function (l) { return '• ' + l; }).join('\n'),
        list.length ? list.map(function (a, j) { return (j + 1) + '. ' + a.title + ' — ' + a.owner; }).join('\n') : { text: 'ยังไม่ได้กำหนดแนวทาง', options: { color: hx(MUT) } },
        list.length ? list.map(function (a) { return (HZ[a.hz] || HZ.c).t + ' · ' + dTh(a.start) + '–' + dTh(a.due) + ' · ' + STT[stOf(a)].t; }).join('\n') : ''
      ]);
    });
    tableN(sl, rows, 40, 150, 1840, [330, 470, 400, 420, 220], { size: 12 });
    NF(P, sl, 'ปัญหาเรียงจากแย่สุด · ผล: KPI ที่เลือก · แนวทาง/กำหนดเสร็จ: ผู้ดูแลกำหนด');
  }
  function nApEach(P, A, probs, idx, p) {
    var o = probs[idx], k = o.k, an = o.an, sl = NP(P, A, p, 'Action Plan · ' + k.name);
    box(P, sl, 48, 150, 520, 860); tx(sl, '① ผล', 72, 160, 400, 40, { size: 24, bold: true, color: YEL });
    tx(sl, k.name, 72, 204, 470, 60, { size: 18, color: SOFT }); tx(sl, fmt(k, o.v), 72, 268, 470, 100, { size: 72, bold: true });
    if (hasT(k)) tx(sl, 'เกณฑ์ ' + fmtT(k) + '  ·  ห่าง ' + gapTxt(k, +k.target - o.v), 72, 372, 470, 36, { size: 19, color: RED, bold: true });
    if (o.d != null) tx(sl, fmtD(k, o.d) + ' เทียบ ' + label(prevOf(p)).replace(/\s+\(.*/, ''), 72, 412, 470, 36, { size: 19, bold: true, color: o.better > 0 ? GREEN : RED });
    if (o.trend) lineN(P, sl, 60, 470, 496, 300, [{ name: k.name, vals: o.trend.map(function (t) { return t.v; }) }], k, o.trend.map(function (t) { return t.l; }));
    box(P, sl, 592, 150, 700, 860); tx(sl, '② ปัญหา', 616, 160, 400, 40, { size: 24, bold: true, color: YEL });
    var list = an.regsAll.length ? an.regsAll : an.dcs; hbarsN(P, sl, 610, 210, 664, Math.min(240, list.length * 40), list, k);
    var y = 210 + Math.min(240, list.length * 40) + 30;
    if (an.regsAll.length && an.dcs.length) { tableN(sl, [['DC แย่สุด 5', 'ผล', '']].concat(an.dcs.map(function (d) { return [d[0], { text: fmt(k, d[1]), options: { bold: true, color: hx(RED) } }, an.streak.indexOf(d[0]) >= 0 ? '3 ' + unitWord(p.mode) + 'ติด' : '']; })), 612, y, 660, [380, 140, 140], { rowH: 38, size: 13 }); y += 6 * 38 + 20; }
    tx(sl, 'ข้อวิเคราะห์', 616, y, 640, 32, { size: 18, bold: true, color: CY });
    tx(sl, an.lines.map(function (l) { return '• ' + l; }).join('\n'), 616, y + 34, 650, 1000 - y - 44, { size: 16, valign: 'top', x2: { fit: 'shrink', paraSpaceAfter: 4 } });
    box(P, sl, 1316, 150, 556, 860); tx(sl, '③ แนวทางแก้ไข', 1340, 160, 500, 40, { size: 24, bold: true, color: YEL });
    var acts = shownActs(k.id).filter(function (a) { return stOf(a) !== 'done' || a.created >= addD(today(), -30); }).slice(0, 5);
    if (!acts.length) tx(sl, 'ยังไม่ได้กำหนดแนวทาง', 1340, 400, 500, 40, { color: MUT, align: 'center' });
    acts.forEach(function (a, i) {
      var yy = 214 + i * 156, h = HZ[a.hz] || HZ.c, st = STT[stOf(a)];
      box(P, sl, 1336, yy, 516, 144, TH === 'light' ? '#f7f9fc' : '#1b3a72'); sl.addShape(P.ShapeType.rect, { x: ix(1336), y: ix(yy), w: ix(6), h: ix(144), fill: { color: hx(h.c) }, line: { color: hx(h.c) } });
      tx(sl, (i + 1) + '. ' + a.title, 1356, yy + 8, 480, 56, { size: 17, bold: true, valign: 'top' });
      tx(sl, '👤 ' + a.owner + '   📍 ' + a.scope, 1356, yy + 66, 480, 30, { size: 14, color: SOFT });
      tx(sl, h.t + ' · ' + dTh(a.start) + '–' + dTh(a.due, 1), 1356, yy + 102, 330, 30, { size: 14, bold: true, color: h.c });
      badgeN(P, sl, 1716, yy + 102, 120, 30, st.t + (a.pct ? ' ' + a.pct + '%' : ''), st.c, true);
    });
    NF(P, sl, 'เรื่องที่ ' + (idx + 1) + ' / ' + probs.length + ' · ผล: KPI ที่เลือก · ปัญหา: จุดที่แย่สุดของผลนั้น');
  }
  function nTimeline(P, A, p, res, page) {
    var sl = NP(P, A, p, 'ไทม์ไลน์การแก้ไข'), acts = openActs(), t = today(), cnt = { todo: 0, doing: 0, done: 0, late: 0 };
    acts.forEach(function (a) { cnt[stOf(a)]++; });
    [['งานทั้งหมด ' + acts.length, INK], ['กำลังทำ ' + cnt.doing, CY], ['เสร็จ ' + cnt.done, GREEN], ['ล่าช้า ' + cnt.late, RED], ['ยังไม่เริ่ม ' + cnt.todo, MUT]].forEach(function (c, i) { tx(sl, c[0], 60 + i * 260, 146, 250, 50, { size: 24, bold: true, color: c[1] }); });
    if (!acts.length) { tx(sl, 'ยังไม่มีงานแก้ไข', 48, 500, 1824, 60, { color: MUT, align: 'center', size: 26 }); return NF(P, sl, ''); }
    var lx = 48, tl = 860, tr = 1872, a0 = acts.reduce(function (m, a) { return a.start < m ? a.start : m; }, t), a1 = acts.reduce(function (m, a) { return a.due > m ? a.due : m; }, t);
    var st0 = monday(a0 < addD(t, -7) ? addD(t, -7) : a0), nW = Math.max(4, Math.min(12, Math.ceil((DT.diffD(st0, a1) + 1) / 7))), spanD = nW * 7, cw = (tr - tl) / nW;
    var X = function (d) { return tl + (tr - tl) * Math.max(0, Math.min(spanD, DT.diffD(st0, d))) / spanD; };
    tx(sl, 'งาน', lx + 10, 206, 400, 30, { size: 16, bold: true, color: MUT }); tx(sl, 'ผู้รับผิดชอบ', lx + 470, 206, 200, 30, { size: 16, bold: true, color: MUT }); tx(sl, 'สถานะ', lx + 680, 206, 120, 30, { size: 16, bold: true, color: MUT });
    for (var i = 0; i < nW; i++) { var wa = addD(st0, i * 7); tx(sl, dTh(wa) + '–' + dTh(addD(wa, 5)), tl + i * cw, 206, cw, 30, { size: 12, align: 'center', color: SOFT }); sl.addShape(P.ShapeType.line, { x: ix(tl + i * cw), y: ix(240), w: 0, h: ix(770), line: { color: TH === 'light' ? 'E3E8F0' : '2A4372', width: 0.75 } }); }
    var rows = [], seen = {};
    acts.slice().sort(function (a, b) { return a.kpi < b.kpi ? -1 : a.kpi > b.kpi ? 1 : a.start < b.start ? -1 : 1; }).forEach(function (a) { if (!seen[a.kpi]) { seen[a.kpi] = 1; rows.push({ h: a.kname }); } rows.push({ a: a }); });
    var per = 14, pg = rows.slice(page * per, page * per + per), rh = 760 / per, y = 246;
    pg.forEach(function (r) {
      if (r.h) { sl.addShape(P.ShapeType.rect, { x: ix(40), y: ix(y + 3), w: ix(1840), h: ix(rh - 6), fill: { color: hx(YEL), transparency: 85 }, line: { color: hx(YEL), transparency: 100 } }); tx(sl, '▸ ' + r.h, lx + 10, y, 1400, rh, { size: 16, bold: true, color: YEL }); }
      else {
        var a = r.a, st = STT[stOf(a)], b0 = X(a.start), b1 = Math.max(b0 + 14, X(addD(a.due, 1))), pc = a.status === 'done' ? 100 : a.pct || 0;
        tx(sl, a.title, lx + 24, y, 440, rh, { size: 14 }); tx(sl, a.owner, lx + 470, y, 200, rh, { size: 13, color: SOFT }); badgeN(P, sl, lx + 680, y + rh / 2 - 13, 110, 26, st.t, st.c, true);
        sl.addShape(P.ShapeType.roundRect, { x: ix(b0), y: ix(y + rh / 2 - 10), w: ix(b1 - b0), h: ix(20), fill: { color: hx(st.c), transparency: 70 }, line: { color: hx(st.c), width: 1 }, rectRadius: 0.5 });
        if (pc) sl.addShape(P.ShapeType.roundRect, { x: ix(b0), y: ix(y + rh / 2 - 10), w: ix((b1 - b0) * pc / 100), h: ix(20), fill: { color: hx(st.c) }, line: { color: hx(st.c) }, rectRadius: 0.5 });
        tx(sl, pc + '%', Math.min(b1 + 6, tr - 50), y, 60, rh, { size: 12, bold: true });
      }
      y += rh;
    });
    var tX = X(t); sl.addShape(P.ShapeType.line, { x: ix(tX), y: ix(236), w: 0, h: ix(780), line: { color: hx(YEL), width: 2 } }); tx(sl, 'วันนี้', tX - 40, 1006, 80, 24, { size: 12, bold: true, color: YEL, align: 'center' });
    NF(P, sl, 'แถบ = ช่วงที่ต้องแก้ · สีเต็ม = % ความคืบหน้า · งานค้างยกไปรายงานรอบถัดไปอัตโนมัติ');
  }
  /* โลโก้ย่อสำหรับ PPTX (ลดขนาดไฟล์ · ทุกสไลด์ใช้ภาพเดียวกัน) */
  function smallLogo(A) {
    if (A.logoS) return Promise.resolve(A);
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () { var w = 320, h = Math.round(im.height * w / im.width), c = document.createElement('canvas'), g = c.getContext('2d'); c.width = w; c.height = h; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h); A.logoS = c.toDataURL('image/jpeg', 0.9); res(A); };
      im.onerror = function () { A.logoS = A.logo; res(A); }; im.src = A.logo;
    });
  }
  function buildNative(P, A) {
    setTheme(LAST.theme || UI.theme);
    SLIDES.forEach(function (s2) {
      if (s2.kind === 'sum') nSummary(P, A, LAST.res, LAST.p);
      else if (s2.kind === 'dim') nDim(P, A, LAST.res, LAST.p, s2.dn);
      else if (s2.kind === 'kpi') nKpi(P, A, s2.o, LAST.p);
      else if (s2.kind === 'apone') nApOne(P, A, s2.probs, LAST.p, s2.page);
      else if (s2.kind === 'apeach') nApEach(P, A, s2.probs, s2.idx, LAST.p);
      else if (s2.kind === 'tl') nTimeline(P, A, LAST.p, LAST.res, s2.page);
    });
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
    var aps = document.createElement('section'); aps.id = 'repApSet'; aps.className = 'rep-apset'; el.appendChild(aps); loadPrivate().then(renderApSet);
    $('repAdd').onclick = function () { var s = Object.keys(AD)[0], m = Object.keys(AD[s].metrics)[0], md = AD[s].metrics[m]; EDIT.push({ id: 'k' + Date.now().toString(36), dim: EDIT.length ? EDIT[EDIT.length - 1].dim : 'ด้านใหม่', sys: s, key: m, name: md.name, modes: 'DWM', unit: md.unit, dir: md.dir, target: null, on: true }); renderSet(); };
    $('repReset').onclick = function () { if (confirm('คืนค่ารายการ KPI เป็นค่าเริ่มต้นจากไฟล์ config.js?')) { EDIT = clone(window.HUB_KPIS); renderSet(); } };
    $('repSave').onclick = function () {
      var bad = EDIT.filter(function (k) { return !k.name || !k.dim || !k.modes; });
      if (bad.length) return APP().toast('กรอกชื่อ ด้าน และช่วงเวลาให้ครบทุกแถว', true);
      var val = EDIT.map(function (k) { return { id: String(k.id).slice(0, 30), dim: String(k.dim).slice(0, 40), sys: k.sys, key: k.key, name: String(k.name).slice(0, 80), modes: k.modes, unit: k.unit, dir: k.dir < 0 ? -1 : 1, target: hasT(k) ? +k.target : null, on: k.on !== false }; });
      APP().save({ kpis: val }, 'บันทึกตาราง KPI แล้ว').then(function (ok) { if (ok !== false) { window.HUB_SHARED_KPIS = val; CACHE = {}; EDIT = null; renderSet(); } });
    };
  }

  window.HUB_REPORT = { open: open, onShared: function () { EDIT = null; }, _calc: calc, _period: period,
    /* ใช้ทดสอบเท่านั้น */
    _t: { set: function (last, ui, acts) { LAST = last; Object.assign(UI, ui || {}); if (acts) AP.actions = acts; last.res.forEach(function (o) { o.st = status(o.k, o.v, o.pv); o.better = better(o.k, o.d); }); }, render: function () { return assets().then(renderSlides).then(function () { return SLIDES.map(function (x) { return { t: x.t, svg: x.svg, kind: x.kind }; }).concat([{ t: 'story', svg: LAST.story.svg }]); }); },
      pptx: function () { return (window.PptxGenJS ? Promise.resolve() : loadLib(CDN.pptx)).then(function () { var P = new window.PptxGenJS(); P.layout = 'LAYOUT_WIDE'; return assets().then(smallLogo).then(function (A) { buildNative(P, A); return P.write({ outputType: 'base64', compression: true }); }); }); } } };
})();
