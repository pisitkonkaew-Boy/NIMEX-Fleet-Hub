/* NIMEX Fleet Hub — ตัวเชื่อมตัวเลข KPI จากหน้าเว็บของแต่ละระบบ
   Hub เปิดหน้าระบบย่อยไว้เบื้องหลัง (iframe โดเมนเดียวกัน) แล้วเรียกฟังก์ชันคำนวณเดิมของหน้านั้น
   ไม่มีสูตรใหม่: ทุกตัวเลขมาจากฟังก์ชันของระบบนั้นเอง ถ้าหน้าระบบเปลี่ยนชื่อฟังก์ชัน ตัวเชื่อมของระบบนั้นต้องแก้ตาม
   ช่วงวันที่ a, b เป็น 'YYYY-MM-DD' (รวมทั้งสองวัน)
   ผลของแต่ละตัวชี้วัด: { v, n:[ตัวตั้ง,ตัวหาร]?, region:[[ชื่อ,ค่า,จำนวน?]], dc:[[ชื่อ,ค่า,จำนวน?]] } */
(function () {
  'use strict';
  var DAY = 864e5;
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addD(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffD(a, b) { return Math.round((pd(b) - pd(a)) / DAY); }
  function fin(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function ev(w, code) { return w.eval(code); }
  function call(w, args, code) { w.__hubArgs = args; try { return w.eval('(function(A){' + code + '})(window.__hubArgs)'); } finally { w.__hubArgs = null; } }
  function has(w, names) { try { return names.every(function (n) { return w.eval('typeof ' + n) !== 'undefined'; }); } catch (e) { return false; } }

  var A = {};

  /* ---------- Car Performance: index วัน นับจากวันที่ 1 ของเดือนแรก (mInfo[0].m เป็น พ.ศ.) ---------- */
  A.car = {
    repo: 'NIMEX-Car-Performance-Dashboard',
    ready: function (w) { return has(w, ['total', 'mInfo', 'filt', 'M_', 'pfOf', 'dim', 'S']) && ev(w, 'mInfo.length') > 0; },
    base: function (w) { var m = ev(w, 'mInfo[0].m').split('-'); return (+m[0] - 543) + '-' + m[1] + '-01'; },
    latest: function (w) { return addD(this.base(w), ev(w, 'S.day')); },
    idx: function (w, a, b) { var B = this.base(w); return [Math.max(0, diffD(B, a)), diffD(B, b)]; },
    metrics: {
      pf: { name: 'กำไร-ขาดทุนรถบริษัท', unit: 'baht', dir: 1 },
      util: { name: 'อัตราการใช้งานรถบริษัท', unit: '%', dir: 1 },
      pcars: { name: 'อัตราส่วนรถบริษัท (ทำกำไร)', unit: '%', dir: 1 },
      ratio: { name: 'ค่าใช้จ่ายต่อรายได้', unit: '%', dir: -1 },
      fr: { name: 'น้ำมันต่อรายได้', unit: '%', dir: -1 }
    },
    calc: function (w, key, a, b) {
      var r = this.idx(w, a, b); if (r[1] < 0 || r[1] < r[0]) return null;
      return call(w, { r: r, k: key }, [
        'var f=A.k==="pf"?pfOf:M_[A.k];',
        'var o=total(A.r,filt());if(!o.carsN&&!o.rev)return null;',
        'var Z=dim("zone",A.r,filt({zone:"",dc:""})),D=dim("dc",A.r,filt({dc:""})).filter(function(x){return x.carsN>0});',
        'var num=function(v){return typeof v==="number"&&isFinite(v)?v:null};',
        'return {v:num(f(o)),cnt:o.carsN,region:Z.map(function(x){return [x.name,num(f(x)),x.carsN]}),dc:D.map(function(x){return [x.name,num(f(x)),x.carsN]})};'
      ].join(''));
    }
  };

  /* ---------- Delivery Driver Performance (window.NX_APP) ---------- */
  A.driver = {
    repo: 'NIMEX-Delivery-Driver-Performance',
    ready: function (w) { return !!(w.NX_APP && w.NX_APP.BYKEY && w.NX_APP.M && w.NX_APP.M.d0); },
    latest: function (w) { var X = w.NX_APP, mx = -1; X.DATA.E.forEach(function (r) { if (r[0] > mx) mx = r[0]; }); X.DATA.C.forEach(function (r) { if (r[0] > mx) mx = r[0]; }); return mx < 0 ? null : addD(X.M.d0, mx); },
    metrics: {
      drive: { name: 'อัตราการขึ้นขับรถบริษัท ทั่วประเทศ', unit: '%', dir: 1 },
      bills: { name: 'อัตราการจัดส่งสำเร็จ (ทุกสาเหตุ) ทั่วประเทศ', unit: '%', dir: 1 },
      billsC: { name: 'อัตราการจัดส่งสำเร็จ (ตัดสาเหตุลูกค้า) ทั่วประเทศ', unit: '%', dir: 1 },
      cost: { name: 'ต้นทุนกระจาย (% ต่อรายได้)', unit: '%', dir: -1 },
      pick: { name: 'ต้นทุนเข้ารับ (% ต่อรายได้)', unit: '%', dir: -1 }
    },
    calc: function (w, key, a, b) {
      var X = w.NX_APP, d0 = X.M.d0, ia = Math.max(0, diffD(d0, a)), ib = Math.min(X.M.nd - 1, diffD(d0, b));
      if (ib < ia) return null;
      var dcs = X.DATA.dcs;
      var one = function (kf) { var mp = X.BYKEY(ia, ib, kf), out = []; mp.forEach(function (o, k) { var r = X.kv(o, 'all'); out.push([k, fin(r[key]), r.n[key] ? r.n[key][1] : null]); }); return out; };
      var all = X.BYKEY(ia, ib, function () { return 'all'; }).get('all'); if (!all) return null;
      var r = X.kv(all, 'all');
      return { v: fin(r[key]), n: r.n[key], region: one(function (x) { return dcs[x[1]] ? dcs[x[1]].r : null; }), dc: one(function (x) { return dcs[x[1]] ? dcs[x[1]].n : null; }) };
    }
  };

  /* ---------- Fleet Performance: แผน (วันกำหนดส่ง ÷ PA) เทียบเที่ยวที่ปล่อยจริง ---------- */
  A.fleet = {
    repo: 'NIMEX-Fleet-Performance',
    ready: function (w) { return !!(w.MD && w.DATA && w.DATA.months) && has(w, ['ovCalc', 'keepFn', 'ensureMonths']); },
    latest: function (w) { var mx = ''; (w.MD.trips || []).forEach(function (t) { if (t[1] > mx) mx = t[1]; }); return mx || null; },
    prepare: function (w, a, b) {   /* โหลดเดือนที่ยังไม่ได้โหลด (หน้าเดิมโหลดล่วงหน้าแค่ 2 เดือน) */
      var ms = [], d = a.slice(0, 7); while (d <= b.slice(0, 7)) { ms.push(d); var y = +d.slice(0, 4), m = +d.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } d = y + '-' + ('0' + m).slice(-2); }
      return call(w, { ms: ms }, 'return ensureMonths(A.ms);');
    },
    metrics: {
      pa: { name: 'อัตราเที่ยววิ่งตาม PA (แผนเที่ยววิ่ง)', unit: '%', dir: 1, note: 'เที่ยวที่ปล่อยจริง ÷ รถตามแผน (วันกำหนดส่ง ÷ PA) × 100' },
      eff: { name: 'ประสิทธิภาพการจัดส่ง', unit: '%', dir: 1 }
    },
    calc: function (w, key, a, b) {
      var ds = []; for (var d = a; d <= b; d = addD(d, 1)) ds.push(d);
      return call(w, { ds: ds, k: key }, [
        'var keep=keepFn({group:"all",zone:"",dc:""}),D={plan:A.ds,perf:A.ds};',
        'var f=function(o){if(A.k==="pa")return o.plan[0]&&o.act[0]!=null?o.act[0]/o.plan[0]*100:null;return o.eff[0]};',
        'var t=ovCalc("all",keep,D)[0];if(!t||(t.plan[0]==null&&t.act[0]==null))return null;',
        'var num=function(v){return typeof v==="number"&&isFinite(v)?v:null};',
        'var Z=ovCalc("zone",keep,D).filter(function(o){return o.key!=="?"}),C=ovCalc("dc",keep,D).filter(function(o){return o.key!=="?"});',
        'return {v:num(f(t)),n:[t.act[0],t.plan[0]],region:Z.map(function(o){return [o.name,num(f(o)),o.plan[0]]}),dc:C.map(function(o){return [o.name,num(f(o)),o.plan[0]]})};'
      ].join(''));
    }
  };

  /* ---------- Inbound Cost: % ค่าจ้างต่อรายได้ (window.NX) ---------- */
  A.inbound = {
    repo: 'NIMEX-Inbound-Cost-Dashboard',
    ready: function (w) { return !!(w.NX && w.NX.between && w.NX.C); },
    latest: function (w) { try { var L = w.eval('LAST'); return L ? iso(L) : null; } catch (e) { return null; } },
    metrics: {
      ab: { name: 'ต้นทุนเข้ารับ (AB) BKK', unit: '%', dir: -1 },
      cc: { name: 'ต้นทุนเข้ารับ (CC) BKK', unit: '%', dir: -1 },
      all: { name: 'ต้นทุนเข้ารับรวม BKK', unit: '%', dir: -1 }
    },
    calc: function (w, key, a, b) {
      var NX = w.NX, A1 = pd(a), B1 = pd(b); B1.setHours(23, 59, 59);
      var rows = NX.between(A1, B1); if (!rows.length) return null;
      var pick = function (agg) { var o = key === 'ab' ? agg.AB : key === 'cc' ? agg.CC : agg.total; return o && o.trips ? [fin(o.pct), o.trips] : [null, 0]; };
      var t = pick(NX.C.aggregate(rows)); if (t[0] == null) return null;
      var by = {}; rows.forEach(function (r) { (by[r.dc] = by[r.dc] || { n: r.dc + ' ' + r.dn, r: [] }).r.push(r); });
      var dc = Object.keys(by).map(function (k) { var p = pick(NX.C.aggregate(by[k].r)); return [by[k].n, p[0], p[1]]; });
      return { v: t[0], cnt: t[1], region: [], dc: dc };
    }
  };

  /* ---------- D2D Operation Report: analyze(filterRecords()) ---------- */
  A.d2d = {
    repo: 'NIMEX-D2D-Operation-Report',
    ready: function (w) { return has(w, ['RECORDS', 'analyze', 'filterRecords']) && ev(w, 'RECORDS.length') > 0; },
    latest: function (w) { return ev(w, 'REPORT_END_DATE||RECORDS.reduce(function(m,r){return r.confirmDateISO>m?r.confirmDateISO:m},"")') || null; },
    metrics: {
      kpi2: { name: 'อัตราบิลที่สามารถจัดรถเข้ารับได้ตรงตามเวลานัดรับ', unit: '%', dir: 1 },
      kpi3: { name: 'อัตรารถเข้ารับสำเร็จ (ตัดสาเหตุลูกค้า) ทั่วประเทศ', unit: '%', dir: 1 },
      kpi1: { name: 'อัตราการเข้ารับ D2D สำเร็จ (ตัดสาเหตุลูกค้า)', unit: '%', dir: 1 }
    },
    calc: function (w, key, a, b) {
      return call(w, { a: a, b: b, k: key }, [
        'var rs=filterRecords({start:A.a,end:A.b});if(!rs.length)return null;',
        'var num=function(v){return typeof v==="number"&&isFinite(v)?v:null};',
        'var t=analyze(rs),gz={},gd={};rs.forEach(function(r){(gz[r.zone]=gz[r.zone]||[]).push(r);var dk=r.dcCode+" "+r.dcName;(gd[dk]=gd[dk]||[]).push(r)});',
        'var m=function(g){return Object.keys(g).map(function(k){var x=analyze(g[k]);return [k,num(x[A.k]),x.total]})};',
        'return {v:num(t[A.k]),cnt:t.total,region:m(gz),dc:m(gd)};'
      ].join(''));
    }
  };

  /* ---------- Pickup Vehicle: computeKPISet(tripsInRange()) — ต้องมี window.__pickupA จาก share.js ---------- */
  A.pickup = {
    repo: 'NIMEX-Pickup-Vehicle-Dashboard',
    ready: function (w) { var P = w.__pickupA; return !!(P && P.state && P.state.trips && P.state.trips.length); },
    latest: function (w) { var mx = ''; w.__pickupA.state.trips.forEach(function (t) { if (t.dateKey && t.dateKey > mx) mx = t.dateKey; }); return mx || null; },
    metrics: { ontime: { name: 'เวลาเข้ารับ BKK OnTime', unit: '%', dir: 1 } },
    calc: function (w, key, a, b) {
      var P = w.__pickupA, ts = P.state.trips.filter(function (t) { return t.dateKey && t.dateKey >= a && t.dateKey <= b; });
      if (!ts.length) return null;
      var k = P.computeKPISet(ts), by = {};
      ts.forEach(function (t) { var n = P.dcShortLabel ? P.dcShortLabel(t.dcCode) : t.dcCode; (by[n] = by[n] || []).push(t); });
      return { v: k.ontimePct * 100, n: [k.ontime, k.total], region: [], dc: Object.keys(by).map(function (n) { var x = P.computeKPISet(by[n]); return [n, x.ontimePct * 100, x.total]; }) };
    }
  };

  /* ---------- Fleet Transport Operator: KPI ต่องวด (ครึ่งเดือน) · รายเดือน = เฉลี่ยงวดในเดือน ---------- */
  A.operator = {
    repo: 'NIMEX-Fleet-Transport-Operator',
    ready: function (w) { var P = w.ftoPeriod; return !!(P && P.keys && P.keys.length && P.kval); },
    latest: function (w) { var ks = w.ftoPeriod.keys, k = ks[ks.length - 1], e = w.ftoPeriod.periodEnd(k); return iso(e); },
    metrics: {
      k6: { name: 'อัตราส่วนรถที่มียอดปิดบัญชีคงเหลืองวดละ 7,000 บาทขึ้นไป', unit: '%', dir: 1 },
      k7: { name: 'อัตราความถูกต้องตรงเวลาในการปิดบัญชีรถกระจาย', unit: '%', dir: 1 },
      k8: { name: 'ปิดบัญชีรถเสริม: ถูกต้องและตรงเวลา', unit: '%', dir: 1 }
    },
    calc: function (w, key, a, b) {
      var P = w.ftoPeriod, kp = (P.cfg.kpis || []).filter(function (k) { return k.id === key; })[0]; if (!kp) return null;
      var ks = P.keys.filter(function (k) { var e = iso(P.periodEnd(k)); return e >= a && e <= b; });
      var vs = ks.map(function (k) { return P.kval(kp, k); }).filter(function (v) { return isFinite(v); });
      if (!vs.length) return null;
      var dc = [];
      if (kp.src === 'net_ge') {
        var by = {}; ks.forEach(function (k) { P.units(k).forEach(function (u) { var o = by[u.dc] = by[u.dc] || { y: 0, n: 0 }; o.n++; if (u.net >= kp.param) o.y++; }); });
        dc = Object.keys(by).map(function (n) { return [n, by[n].y / by[n].n * 100, by[n].n]; });
      }
      return { v: vs.reduce(function (s, v) { return s + v; }, 0) / vs.length, region: [], dc: dc, note: ks.length > 1 ? 'เฉลี่ย ' + ks.length + ' งวด' : '' };
    }
  };

  /* ---------- Check-in Performance: getRows / summ (index วันจาก dInfo, ปี พ.ศ.) ---------- */
  A['checkin-perf'] = {
    repo: 'NIMEX-Check-in-Performance-Dashboard',
    ready: function (w) { return has(w, ['getRows', 'summ', 'dInfo', 'dcZone', 'dcName']) && ev(w, 'dInfo.length') > 0; },
    dateOf: function (o) { return (o.y - 543) + '-' + ('0' + o.m).slice(-2) + '-' + ('0' + o.d).slice(-2); },
    latest: function (w) { return this.dateOf(ev(w, 'dInfo[dInfo.length-1]')); },
    metrics: {
      on: { name: 'อัตรา % ตรงเวลา Check-in Performance', unit: '%', dir: 1 },
      fine: { name: 'ค่าปรับรวม (บาท) Check-in Performance', unit: 'baht', dir: -1 },
      late: { name: 'ค่าเฉลี่ยเวลาสาย Check-in Performance', unit: 'min', dir: -1 }
    },
    calc: function (w, key, a, b) {
      var di = ev(w, 'dInfo'), self = this, ia = -1, ib = -1;
      di.forEach(function (o, i) { var s = self.dateOf(o); if (s >= a && ia < 0) ia = i; if (s <= b) ib = i; });
      if (ia < 0 || ib < ia) return null;
      return call(w, { r: [ia, ib], k: key }, [
        'var rows=getRows(A.r[0],A.r[1],true);if(!rows.length)return null;',
        'var f=function(s){return A.k==="on"?(s.n?s.s[0]/s.n*100:null):A.k==="fine"?s.fine:(s.s[1]?s.lateSum/s.s[1]:null)};',
        'var g=function(kf){var m={};rows.forEach(function(r){var k=kf(r);(m[k]=m[k]||[]).push(r)});return Object.keys(m).map(function(k){var s=summ(m[k]);return [k,f(s),s.n]})};',
        'var s=summ(rows);return {v:f(s),cnt:s.n,region:g(function(r){return dcZone[r[1]]}),dc:g(function(r){return dcName[r[1]]})};'
      ].join(''));
    }
  };

  /* ---------- Vehicle P&L: ข้อมูลรายเดือน (FM) ---------- */
  A.vpl = {
    repo: 'NIMEX-Vehicle-P-L-Dashboard',
    ready: function (w) { return !!(w.FM && w.FM.kpiCalc && w.FX); },
    latest: function (w) { var ms = w.eval('months'), m = ms[ms.length - 1]; var d = new Date(+m.slice(0, 4), +m.slice(5, 7), 0); return iso(d); },
    metrics: {
      net: { name: 'กำไร-ขาดทุนรถบริษัท', unit: 'baht', dir: 1 },
      util: { name: 'อัตราการใช้งานรถบริษัท', unit: '%', dir: 1 },
      pveh: { name: 'อัตราส่วนรถบริษัท (ทำกำไร)', unit: '%', dir: 1 }
    },
    calc: function (w, key, a, b) {
      var FM = w.FM, ms = w.eval('months').filter(function (m) { return m >= a.slice(0, 7) && m <= b.slice(0, 7); });
      if (!ms.length) return null;
      var rows = FM.allData.filter(function (r) { return ms.indexOf(r.date) >= 0; }); if (!rows.length) return null;
      var f = function (k) { return key === 'net' ? k.net : key === 'util' ? k.utilizationPct : (k.vehicles ? k.profitVeh / k.vehicles * 100 : null); };
      var grp = function (kf) { var m = {}; rows.forEach(function (r) { var k = kf(r); (m[k] = m[k] || []).push(r); }); return Object.keys(m).map(function (k) { var x = FM.kpiCalc(m[k]); return [k, fin(f(x)), x.vehicles]; }); };
      var k = FM.kpiCalc(rows);
      return { v: fin(f(k)), cnt: k.vehicles, region: grp(function (r) { return r.zone; }), dc: grp(function (r) { return r.dcCode + ' ' + r.dcName; }) };
    }
  };

  window.HUB_ADAPTERS = A;
  window.HUB_DATE = { iso: iso, pd: pd, addD: addD, diffD: diffD };
})();
