/* NIMEX Fleet Hub — ทะเบียนระบบ
   เพิ่ม/ลบระบบได้ที่นี่ แล้วเพิ่มเลข HUB_V เพื่อล้างแคชผู้ชม
   ลำดับ ย้ายกลุ่ม ซ่อน/แสดง ชื่อกลุ่ม และจำนวนแถว ผู้ดูแลปรับเองได้ในโหมด #admin (ค่าที่บันทึกใน Sheet ของ Hub จะใช้แทนค่าในไฟล์นี้) */
window.HUB_V = 10;
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
  { id: 'flt-pa', dim: 'ด้านแผนการใช้รถและต้นทุน', sys: 'fleet', key: 'pa', name: 'อัตราเที่ยววิ่งตาม PA (แผนเที่ยววิ่ง)', modes: 'DWM', unit: '%', dir: -1 },
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

/* ---------- Action Plan: ผู้รับผิดชอบและคลังแนวทางเริ่มต้น (ผู้ดูแลแก้ได้ในศูนย์รายงาน > ตั้งค่า Action Plan) ----------
   แนวทางแต่ละข้อ: t = ข้อความ, o = ผู้รับผิดชอบเริ่มต้น · {พื้นที่} จะถูกแทนด้วยภาค/DC ที่แย่สุดของปัญหานั้น */
window.HUB_OWNERS = ['DC Leader', 'Fleet Planning'];
window.HUB_PLAYBOOK = {
  'car-pf': [
    { t: 'ทบทวนรถขาดทุนรายคันใน {พื้นที่} แล้วปรับเส้นทาง/งานให้เต็มคัน', o: 'Fleet Planning' },
    { t: 'โยกรถที่ใช้งานต่ำไป DC ที่ขาดรถ แทนการจ้างรถร่วม', o: 'Fleet Planning' },
    { t: 'คุมค่าใช้จ่ายน้ำมันและซ่อมบำรุงของรถขาดทุนสูงสุด 10 คัน', o: 'DC Leader' },
    { t: 'ทบทวนรถ Stock ที่ไม่ได้ใช้งาน เสนอคืน/ขาย', o: 'Fleet Planning' }],
  'car-util': [
    { t: 'ตรวจรถจอดไม่วิ่งรายวันใน {พื้นที่} พร้อมเหตุผล', o: 'DC Leader' },
    { t: 'จัดรถบริษัทวิ่งก่อนรถร่วมทุกเส้นทางที่ทำได้', o: 'DC Leader' },
    { t: 'เร่งรถซ่อมให้กลับมาวิ่ง กำหนดวันเสร็จชัดเจน', o: 'Fleet Planning' },
    { t: 'ทบทวนจำนวนรถต่อ DC ให้ตรงปริมาณงาน', o: 'Fleet Planning' }],
  'car-pcars': [
    { t: 'วิเคราะห์รถขาดทุนต่อเนื่อง 3 ช่วงใน {พื้นที่} หาสาเหตุรายคัน', o: 'Fleet Planning' },
    { t: 'ปรับงานเพิ่มรายได้ต่อเที่ยวของรถที่เกือบถึงจุดคุ้มทุน', o: 'DC Leader' },
    { t: 'ลดค่าใช้จ่ายคงที่ของรถขาดทุน (เช่า/ประกัน/ซ่อม)', o: 'Fleet Planning' },
    { t: 'ติดตามรายสัปดาห์กับ DC ที่สัดส่วนรถทำกำไรต่ำสุด', o: 'Fleet Planning' }],
  'drv-drive': [
    { t: 'ตรวจรายชื่อพนักงานขาด/ลา/ลาออก รายวัน กับหัวหน้า DC ({พื้นที่})', o: 'DC Leader' },
    { t: 'จัดพนักงานสำรอง (Pool) ข้าม DC ในภาคเดียวกัน', o: 'Fleet Planning' },
    { t: 'ลงพื้นที่ DC ที่ไม่ผ่านติดกันหลายช่วง หาสาเหตุ', o: 'Fleet Planning' },
    { t: 'ทบทวนแผนรถ: รถไม่มีคนขับ / รถเข้าซ่อม', o: 'Fleet Planning' },
    { t: 'ทบทวนเบี้ยขยันสำหรับการขึ้นขับครบ', o: 'Fleet Planning' }],
  'drv-bills': [
    { t: 'ทวนสอบที่อยู่/เบอร์ผู้รับก่อนออกรถ ใน {พื้นที่}', o: 'DC Leader' },
    { t: 'ติดตามบิลค้างส่งรายวัน และเร่งส่งซ้ำภายในวันถัดไป', o: 'DC Leader' },
    { t: 'ปรับเส้นทาง/จำนวนบิลต่อคันให้เหมาะกับพื้นที่', o: 'Fleet Planning' },
    { t: 'สรุปสาเหตุไม่สำเร็จ 3 อันดับแรก แล้วแก้ทีละสาเหตุ', o: 'Fleet Planning' }],
  'drv-billsc': [
    { t: 'สรุปสาเหตุที่ไม่ใช่ลูกค้า (รถ/คน/ระบบ) ของ {พื้นที่}', o: 'Fleet Planning' },
    { t: 'โค้ชพนักงานที่ส่งไม่สำเร็จสูงสุด 10 อันดับ', o: 'DC Leader' },
    { t: 'ตรวจรถพร้อมใช้ก่อนออกงาน ลดเหตุรถเสียกลางทาง', o: 'DC Leader' },
    { t: 'ติดตามรายวันจนกว่าจะผ่านเกณฑ์ 2 ช่วงติด', o: 'Fleet Planning' }],
  'flt-pa': [
    { t: 'ทบทวน PA ของ DC ที่ใช้รถเกินแผนใน {พื้นที่}', o: 'Fleet Planning' },
    { t: 'รวมเที่ยวที่บิลน้อย ลดเที่ยวเกินแผน', o: 'DC Leader' },
    { t: 'ตรวจเที่ยวซ้ำ/เที่ยวพิเศษที่ไม่อยู่ในแผน', o: 'DC Leader' },
    { t: 'ปรับแผนรถรายวันตามปริมาณบิลจริง', o: 'Fleet Planning' }],
  'inb-ab': [
    { t: 'รวมเส้นทางเข้ารับ AB ที่บิลน้อยของ {พื้นที่}', o: 'Fleet Planning' },
    { t: 'ทบทวนค่าเหมารายเที่ยว/รายวันของเส้นทางต้นทุนสูง', o: 'Fleet Planning' },
    { t: 'เพิ่มจุดเข้ารับในเส้นทางเดิมให้เต็มคัน', o: 'DC Leader' },
    { t: 'ติดตาม % ต้นทุนรายวันของ 5 เส้นทางแย่สุด', o: 'Fleet Planning' }],
  'inb-cc': [
    { t: 'รวมเส้นทางเข้ารับ CC ที่บิลน้อยของ {พื้นที่}', o: 'Fleet Planning' },
    { t: 'ทบทวนค่าเหมารายเที่ยว CC กับผู้รับจ้าง', o: 'Fleet Planning' },
    { t: 'ปรับรอบเข้ารับ CC ให้ตรงช่วงที่ลูกค้ามีของ', o: 'DC Leader' },
    { t: 'ติดตาม % ต้นทุนรายวันของ 5 เส้นทางแย่สุด', o: 'Fleet Planning' }],
  'd2d-k2': [
    { t: 'ติดตามบิลเลยเวลานัดรายวันใน {พื้นที่}', o: 'DC Leader' },
    { t: 'ปรับรอบรถเข้ารับช่วงบ่ายให้รองรับนัดหนาแน่น', o: 'DC Leader' },
    { t: 'ตั้งเวลาปิดรับนัด + แจ้งเตือน DC ล่วงหน้า', o: 'Fleet Planning' },
    { t: 'จัดรถสำรองสำหรับวันที่นัดเกินกำลังรถ', o: 'Fleet Planning' }],
  'd2d-k3': [
    { t: 'สรุปสาเหตุเข้ารับไม่สำเร็จที่ไม่ใช่ลูกค้า ของ {พื้นที่}', o: 'Fleet Planning' },
    { t: 'ยืนยันนัดกับลูกค้าก่อนออกรถ', o: 'DC Leader' },
    { t: 'เร่งเข้ารับซ้ำภายในวันถัดไป', o: 'DC Leader' },
    { t: 'ติดตามรายวันจนกว่าจะผ่านเกณฑ์ 2 ช่วงติด', o: 'Fleet Planning' }],
  'd2d-k1': [
    { t: 'ตรวจบิล D2D ที่เข้ารับไม่ได้ของ {พื้นที่} รายวัน', o: 'DC Leader' },
    { t: 'จัดรถ/คนเพิ่มในช่วงนัดหนาแน่น', o: 'Fleet Planning' },
    { t: 'ปรับพื้นที่ให้บริการ D2D ให้สอดคล้องกำลังรถ', o: 'Fleet Planning' },
    { t: 'ประชุมสั้นรายวันกับ DC ที่ไม่ผ่านติดกันหลายช่วง', o: 'Fleet Planning' }],
  'pk-ontime': [
    { t: 'ติดตามรถเข้ารับล่าช้ารายวันของ {พื้นที่}', o: 'DC Leader' },
    { t: 'ปรับลำดับจุดเข้ารับตามเวลานัด', o: 'DC Leader' },
    { t: 'เพิ่มรถช่วงชั่วโมงเร่งด่วน', o: 'Fleet Planning' },
    { t: 'สรุปจุดที่ล่าช้าซ้ำ แล้วปรับเวลานัด', o: 'Fleet Planning' }],
  'to-k6': [
    { t: 'ทบทวนรถที่ยอดคงเหลือต่ำกว่าเกณฑ์ใน {พื้นที่}', o: 'Fleet Planning' },
    { t: 'เพิ่มงาน/เที่ยวให้รถที่ยอดคงเหลือต่ำ', o: 'DC Leader' },
    { t: 'ตรวจรายการหักที่ผิดปกติของผู้ประกอบการ', o: 'Fleet Planning' },
    { t: 'คุยกับผู้ประกอบการที่ต่ำกว่าเกณฑ์ติดกันหลายเดือน', o: 'Fleet Planning' }],
  'to-k7': [
    { t: 'กำหนดวันส่งเอกสารปิดบัญชีรถกระจายให้ชัด ({พื้นที่})', o: 'DC Leader' },
    { t: 'ตรวจทานความถูกต้องก่อนส่งปิดบัญชี', o: 'DC Leader' },
    { t: 'ติดตาม DC ที่ส่งช้า/ผิด ซ้ำ', o: 'Fleet Planning' }],
  'to-k8': [
    { t: 'กำหนดวันส่งเอกสารปิดบัญชีรถเสริมให้ชัด', o: 'DC Leader' },
    { t: 'ตรวจทานความถูกต้องก่อนส่งปิดบัญชี', o: 'DC Leader' },
    { t: 'ติดตาม DC ที่ส่งช้า/ผิด ซ้ำ', o: 'Fleet Planning' }],
  'ci-on': [
    { t: 'ติดตามพนักงาน Check-in สายซ้ำใน {พื้นที่}', o: 'DC Leader' },
    { t: 'ทบทวนเวลาเข้างานให้สอดคล้องรอบรถ', o: 'Fleet Planning' },
    { t: 'แจ้งเตือนก่อนเวลาเข้างาน', o: 'DC Leader' },
    { t: 'สรุปรายเดือนพร้อมผลตามระเบียบ', o: 'Fleet Planning' }],
  'ci-fine': [
    { t: 'ติดตามพนักงานที่ถูกปรับสูงสุด 10 อันดับ ({พื้นที่})', o: 'DC Leader' },
    { t: 'หาสาเหตุสายซ้ำ (เดินทาง/รอบรถ/ตารางงาน)', o: 'DC Leader' },
    { t: 'ทบทวนเกณฑ์ค่าปรับให้สอดคล้องระเบียบ', o: 'Fleet Planning' }],
  'ci-late': [
    { t: 'ติดตามพนักงานที่สายเฉลี่ยสูงใน {พื้นที่}', o: 'DC Leader' },
    { t: 'ปรับเวลาเข้างานตามรอบรถจริง', o: 'Fleet Planning' },
    { t: 'แจ้งเตือนก่อนเวลาเข้างาน', o: 'DC Leader' }],
  'vpl-net': [
    { t: 'ทบทวนรถขาดทุนรายคันใน {พื้นที่} แล้วปรับเส้นทาง/งาน', o: 'Fleet Planning' },
    { t: 'คุมค่าใช้จ่ายน้ำมันและซ่อมบำรุงของรถขาดทุนสูงสุด 10 คัน', o: 'DC Leader' },
    { t: 'โยกรถใช้งานต่ำไป DC ที่ขาดรถ', o: 'Fleet Planning' },
    { t: 'ทบทวนรถ Stock ที่ไม่ได้ใช้งาน เสนอคืน/ขาย', o: 'Fleet Planning' }],
  'vpl-util': [
    { t: 'ตรวจรถจอดไม่วิ่งใน {พื้นที่} พร้อมเหตุผล', o: 'DC Leader' },
    { t: 'จัดรถบริษัทวิ่งก่อนรถร่วม', o: 'DC Leader' },
    { t: 'เร่งรถซ่อมให้กลับมาวิ่ง', o: 'Fleet Planning' }],
  'vpl-pveh': [
    { t: 'วิเคราะห์รถขาดทุนต่อเนื่องใน {พื้นที่} หาสาเหตุรายคัน', o: 'Fleet Planning' },
    { t: 'ปรับงานเพิ่มรายได้ต่อเที่ยวของรถใกล้จุดคุ้มทุน', o: 'DC Leader' },
    { t: 'ลดค่าใช้จ่ายคงที่ของรถขาดทุน', o: 'Fleet Planning' }]
};
