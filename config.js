/* NIMEX Fleet Hub — ทะเบียนระบบ
   เพิ่ม/ลบระบบได้ที่นี่ แล้วเพิ่มเลข HUB_V เพื่อล้างแคชผู้ชม
   ลำดับ ย้ายกลุ่ม ซ่อน/แสดง ชื่อกลุ่ม และจำนวนแถว ผู้ดูแลปรับเองได้ในโหมด #admin (ค่าที่บันทึกใน Sheet ของ Hub จะใช้แทนค่าในไฟล์นี้) */
window.HUB_V = 6;
/* Apps Script ของ Hub (ลงท้าย /exec) ใช้เก็บค่าที่ผู้ดูแลตั้งให้ผู้ชมทุกคนเห็นเหมือนกัน */
window.HUB_API = 'https://script.google.com/macros/s/AKfycbxQuPWvrty_9puGb3yPXoY6AlAlPNmAdW-ddAN-3lHIy8CCjJqDZcJhwx1b9fveZwlg/exec';
window.HUB_STYLE = 'a';   /* หน้าตาเริ่มต้น: a = Navy Classic, b = Command Night */
window.HUB_BASE = 'https://pisitkonkaew-boy.github.io/';
/* กลุ่มเริ่มต้น (rows = จำนวนแถว แถวละ 3 ช่อง) */
window.HUB_GROUPS = [
  { id: 'daily', name: 'Daily Report', short: 'Daily', icon: 'clock', rows: 3 },
  { id: 'monthly', name: 'Monthly Report', short: 'Monthly', icon: 'chart', rows: 2 }
];
/* hidden: true = ซ่อนจากผู้ชมเป็นค่าเริ่มต้น */
window.HUB_SYSTEMS = [
  { id: 'car', group: 'daily', name: 'Car Performance', th: 'ผลรถบริษัท',
    desc: 'ผลประกอบการ การใช้งาน และน้ำมันของรถบริษัท NIM Express และ SEAL Gold Chain',
    repo: 'NIMEX-Car-Performance-Dashboard', icon: 'gauge' },
  { id: 'driver', group: 'daily', name: 'Delivery Driver Performance', th: 'ผลงานพนักงานขับรถ',
    desc: 'ผลการจัดส่ง ต้นทุน และเบี้ยขยันของพนักงานขับรถ NIM Express และ SEAL Gold Chain',
    repo: 'NIMEX-Delivery-Driver-Performance', icon: 'user' },
  { id: 'fleet', group: 'daily', name: 'Fleet Performance', th: 'ผลการใช้รถและการจัดส่ง',
    desc: 'แผนการใช้รถ ผลการจัดส่ง SLA ต้นทุน และความผิดปกติของเที่ยววิ่ง',
    repo: 'NIMEX-Fleet-Performance', icon: 'route' },
  { id: 'inbound', group: 'daily', name: 'Inbound Cost', th: 'ต้นทุนงานเข้ารับ',
    desc: 'ต้นทุนงานเข้ารับเทียบรายได้ DC 610 / 621 / 691 · AB แห้ง / CC เย็น',
    repo: 'NIMEX-Inbound-Cost-Dashboard', icon: 'coin' },
  { id: 'd2d', group: 'daily', name: 'D2D Operation Report', th: 'งานเข้ารับ Door to Door',
    desc: 'อัตราเข้ารับสำเร็จ จัดรถตรงวันนัด และรถเข้ารับสำเร็จ รายภาคและราย DC',
    repo: 'NIMEX-D2D-Operation-Report', icon: 'box' },
  { id: 'pickup', group: 'daily', name: 'Pickup Vehicle', th: 'รถเข้ารับสินค้า',
    desc: 'รถเข้ารับสินค้า BKK 3 DC (610 / 621 / 691) ตรงเวลา ล่าช้า และรอเข้ารับ',
    repo: 'NIMEX-Pickup-Vehicle-Dashboard', icon: 'truck' },
  { id: 'vehicle', group: 'daily', name: 'Fleet Vehicle', th: 'ข้อมูลรถราย DC',
    desc: 'รายการรถ ประเภท และสถานะ ราย DC และรายทะเบียน',
    repo: 'NIMEX-Fleet-vehicle-dashboard', icon: 'truck', hidden: true },
  { id: 'checkin-daily', group: 'daily', name: 'Check-in Daily', th: 'Check-in รายวัน',
    desc: 'การ Check-in ของพนักงานขับรถรายวัน ราย DC',
    repo: 'NIMEX-Check-In-Daily-Dashboard', icon: 'clock', hidden: true },
  { id: 'operator', group: 'monthly', name: 'Fleet Transport Operator', th: 'ผู้ประกอบการขนส่ง',
    desc: 'รถและผู้ประกอบการขนส่ง ราย DC และรายทะเบียน',
    repo: 'NIMEX-Fleet-Transport-Operator', icon: 'route', hidden: true },
  { id: 'checkin-perf', group: 'monthly', name: 'Check-in Performance', th: 'ผล Check-in ตรงเวลา',
    desc: '% Check-in ตรงเวลา ราย DC รายวัน และสถานะ',
    repo: 'NIMEX-Check-in-Performance-Dashboard', icon: 'clock', hidden: true },
  { id: 'vpl', group: 'monthly', name: 'Vehicle P&L', th: 'ผลประกอบการรถบริษัท',
    desc: 'รายได้ ค่าใช้จ่าย และผลสุทธิ ราย DC และรายคัน',
    repo: 'NIMEX-Vehicle-P-L-Dashboard', icon: 'chart' },
  { id: 'card', group: 'monthly', name: 'Fleet Card', th: 'บัตรน้ำมันเทียบวงเงิน',
    desc: 'การใช้น้ำมันเทียบวงเงิน PA รายเดือน รายกลุ่ม ราย DC และรายทะเบียน',
    repo: 'NIMEX-Fleet-Card-Dashboard', icon: 'fuel' },
  { id: 'planning', group: 'monthly', name: 'Fleet Planning Catalog', th: 'แคตตาล็อกวางแผนรถ',
    desc: 'ข้อมูลรถสำหรับวางแผนกองรถ ขนาด ความจุ และการใช้งาน',
    repo: 'NIMEX-Fleet_Planning_Catalog', icon: 'grid', hidden: true }
];

/* ---------- ศูนย์รายงาน: รายการ KPI เริ่มต้น (ผู้ดูแลแก้ชื่อ เป้า ทิศทาง เพิ่ม/ลบ ได้ในหน้าตั้งค่ารายงาน) ----------
   sys = id ระบบข้างบน · key = ตัวชี้วัดในตัวเชื่อม (adapters.js) · modes: D = รายวัน W = รายสัปดาห์ M = รายเดือน
   unit: % | baht | min · dir: 1 = สูงดี, -1 = ต่ำดี · target: ว่าง = ยังไม่ตั้งเป้า */
window.HUB_DIMS = [
  { name: 'ด้านรถบริษัท', emo: '🚐' }, { name: 'ด้านประสิทธิภาพ', emo: '🚚' }, { name: 'ด้านแผนการใช้รถและต้นทุน', emo: '🗺️' },
  { name: 'ด้านการเข้ารับ', emo: '📦' }, { name: 'ด้านปิดบัญชีรถ', emo: '🧾' }, { name: 'ด้านบริหารจัดการ', emo: '🕘' }, { name: 'ด้านรถบริษัท P&L', emo: '💰' }
];
window.HUB_KPIS = [
  { id: 'car-pf', dim: 'ด้านรถบริษัท', sys: 'car', key: 'pf', name: 'กำไร-ขาดทุนรถบริษัท', modes: 'DW', unit: 'baht', dir: 1 },
  { id: 'car-util', dim: 'ด้านรถบริษัท', sys: 'car', key: 'util', name: 'อัตราการใช้งานรถบริษัท', modes: 'DW', unit: '%', dir: 1 },
  { id: 'car-pcars', dim: 'ด้านรถบริษัท', sys: 'car', key: 'pcars', name: 'อัตราส่วนรถบริษัท (ทำกำไร)', modes: 'DW', unit: '%', dir: 1 },
  { id: 'drv-drive', dim: 'ด้านประสิทธิภาพ', sys: 'driver', key: 'drive', name: 'อัตราการขึ้นขับรถบริษัท ทั่วประเทศ', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'drv-bills', dim: 'ด้านประสิทธิภาพ', sys: 'driver', key: 'bills', name: 'อัตราการจัดส่งสำเร็จ (ทุกสาเหตุ) ทั่วประเทศ', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'drv-billsc', dim: 'ด้านประสิทธิภาพ', sys: 'driver', key: 'billsC', name: 'อัตราการจัดส่งสำเร็จ (ตัดสาเหตุลูกค้า) ทั่วประเทศ', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'flt-pa', dim: 'ด้านแผนการใช้รถและต้นทุน', sys: 'fleet', key: 'pa', name: 'อัตราเที่ยววิ่งตาม PA (แผนเที่ยววิ่ง)', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'inb-ab', dim: 'ด้านแผนการใช้รถและต้นทุน', sys: 'inbound', key: 'ab', name: 'ต้นทุนเข้ารับ (AB) BKK', modes: 'DWM', unit: '%', dir: -1 },
  { id: 'inb-cc', dim: 'ด้านแผนการใช้รถและต้นทุน', sys: 'inbound', key: 'cc', name: 'ต้นทุนเข้ารับ (CC) BKK', modes: 'DWM', unit: '%', dir: -1 },
  { id: 'd2d-k2', dim: 'ด้านการเข้ารับ', sys: 'd2d', key: 'kpi2', name: 'อัตราบิลที่สามารถจัดรถเข้ารับได้ตรงตามเวลานัดรับ', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'd2d-k3', dim: 'ด้านการเข้ารับ', sys: 'd2d', key: 'kpi3', name: 'อัตรารถเข้ารับสำเร็จ (ตัดสาเหตุลูกค้า) ทั่วประเทศ', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'd2d-k1', dim: 'ด้านการเข้ารับ', sys: 'd2d', key: 'kpi1', name: 'อัตราการเข้ารับ D2D สำเร็จ (ตัดสาเหตุลูกค้า)', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'pk-ontime', dim: 'ด้านการเข้ารับ', sys: 'pickup', key: 'ontime', name: 'เวลาเข้ารับ BKK OnTime', modes: 'DWM', unit: '%', dir: 1 },
  { id: 'to-k6', dim: 'ด้านปิดบัญชีรถ', sys: 'operator', key: 'k6', name: 'อัตราส่วนรถที่มียอดปิดบัญชีคงเหลืองวดละ 7,000 บาทขึ้นไป', modes: 'M', unit: '%', dir: 1 },
  { id: 'to-k7', dim: 'ด้านปิดบัญชีรถ', sys: 'operator', key: 'k7', name: 'อัตราความถูกต้องตรงเวลาในการปิดบัญชีรถกระจาย', modes: 'M', unit: '%', dir: 1 },
  { id: 'to-k8', dim: 'ด้านปิดบัญชีรถ', sys: 'operator', key: 'k8', name: 'ปิดบัญชีรถเสริม: ถูกต้องและตรงเวลา', modes: 'M', unit: '%', dir: 1 },
  { id: 'ci-on', dim: 'ด้านบริหารจัดการ', sys: 'checkin-perf', key: 'on', name: 'อัตรา % ตรงเวลา Check-in Performance', modes: 'M', unit: '%', dir: 1 },
  { id: 'ci-fine', dim: 'ด้านบริหารจัดการ', sys: 'checkin-perf', key: 'fine', name: 'ค่าปรับรวม (บาท) Check-in Performance', modes: 'M', unit: 'baht', dir: -1 },
  { id: 'ci-late', dim: 'ด้านบริหารจัดการ', sys: 'checkin-perf', key: 'late', name: 'ค่าเฉลี่ยเวลาสาย Check-in Performance', modes: 'M', unit: 'min', dir: -1 },
  { id: 'vpl-net', dim: 'ด้านรถบริษัท P&L', sys: 'vpl', key: 'net', name: 'กำไร-ขาดทุนรถบริษัท', modes: 'M', unit: 'baht', dir: 1 },
  { id: 'vpl-util', dim: 'ด้านรถบริษัท P&L', sys: 'vpl', key: 'util', name: 'อัตราการใช้งานรถบริษัท', modes: 'M', unit: '%', dir: 1 },
  { id: 'vpl-pveh', dim: 'ด้านรถบริษัท P&L', sys: 'vpl', key: 'pveh', name: 'อัตราส่วนรถบริษัท (ทำกำไร)', modes: 'M', unit: '%', dir: 1 }
];
