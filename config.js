/* NIMEX Fleet Hub — ทะเบียนระบบ
   เพิ่ม/ลบ/ย้ายระบบได้ที่นี่ แล้วเพิ่มเลข HUB_V เพื่อล้างแคชผู้ชม */
window.HUB_V = 5;
/* Apps Script ของ Hub (ลงท้าย /exec) ใช้เก็บค่าที่ผู้ดูแลตั้ง เช่น หน้าตา A/B ให้ผู้ชมทุกคนเห็นเหมือนกัน
   ถ้ายังว่าง ปุ่มสลับหน้าตาจะเปลี่ยนเฉพาะเครื่องที่กด */
window.HUB_API = 'https://script.google.com/macros/s/AKfycbxQuPWvrty_9puGb3yPXoY6AlAlPNmAdW-ddAN-3lHIy8CCjJqDZcJhwx1b9fveZwlg/exec';
window.HUB_STYLE = 'a';   /* หน้าตาเริ่มต้น: a = Navy Classic, b = Command Night */
window.HUB_SLOTS = 9;     /* จำนวนช่องต่อหมวด (3 × 3) */
window.HUB_BASE = 'https://pisitkonkaew-boy.github.io/';
window.HUB_GROUPS = [
  { id: 'fleet', name: 'บริหารจัดการรถและคน', short: 'รถและคน', icon: 'truck' },
  { id: 'cost', name: 'บริหารจัดการต้นทุนและประสิทธิภาพ', short: 'ต้นทุน', icon: 'chart' }
];
/* hidden: true = ซ่อนจากผู้ชมเป็นค่าเริ่มต้น (ผู้ดูแลกดแสดง/ซ่อนได้จากการ์ดในโหมด #admin และค่านั้นจะใช้แทน) */
window.HUB_SYSTEMS = [
  { id: 'fleet', group: 'fleet', name: 'Fleet Performance', th: 'ผลการใช้รถและการจัดส่ง',
    desc: 'แผนการใช้รถ ผลการจัดส่ง SLA ต้นทุน และความผิดปกติของเที่ยววิ่ง',
    repo: 'NIMEX-Fleet-Performance', icon: 'route' },
  { id: 'pickup', group: 'fleet', name: 'Pickup Vehicle', th: 'รถเข้ารับสินค้า',
    desc: 'รถเข้ารับสินค้า BKK 3 DC (610 / 621 / 691) ตรงเวลา ล่าช้า และรอเข้ารับ',
    repo: 'NIMEX-Pickup-Vehicle-Dashboard', icon: 'truck' },
  { id: 'driver', group: 'fleet', name: 'Delivery Driver Performance', th: 'ผลงานพนักงานขับรถ',
    desc: 'ผลการจัดส่ง ต้นทุน และเบี้ยขยันของพนักงานขับรถ NIM Express และ SEAL Gold Chain',
    repo: 'NIMEX-Delivery-Driver-Performance', icon: 'user' },
  { id: 'vehicle', group: 'fleet', name: 'Fleet Vehicle', th: 'ข้อมูลรถราย DC',
    desc: 'รายการรถ ประเภท และสถานะ ราย DC และรายทะเบียน',
    repo: 'NIMEX-Fleet-vehicle-dashboard', icon: 'truck', hidden: true },
  { id: 'operator', group: 'fleet', name: 'Fleet Transport Operator', th: 'ผู้ประกอบการขนส่ง',
    desc: 'รถและผู้ประกอบการขนส่ง ราย DC และรายทะเบียน',
    repo: 'NIMEX-Fleet-Transport-Operator', icon: 'route', hidden: true },
  { id: 'checkin-daily', group: 'fleet', name: 'Check-in Daily', th: 'Check-in รายวัน',
    desc: 'การ Check-in ของพนักงานขับรถรายวัน ราย DC',
    repo: 'NIMEX-Check-In-Daily-Dashboard', icon: 'clock', hidden: true },
  { id: 'checkin-perf', group: 'fleet', name: 'Check-in Performance', th: 'ผล Check-in ตรงเวลา',
    desc: '% Check-in ตรงเวลา ราย DC รายวัน และสถานะ',
    repo: 'NIMEX-Check-in-Performance-Dashboard', icon: 'clock', hidden: true },
  { id: 'inbound', group: 'cost', name: 'Inbound Cost', th: 'ต้นทุนงานเข้ารับ',
    desc: 'ต้นทุนงานเข้ารับเทียบรายได้ DC 610 / 621 / 691 · AB แห้ง / CC เย็น',
    repo: 'NIMEX-Inbound-Cost-Dashboard', icon: 'coin' },
  { id: 'vpl', group: 'cost', name: 'Vehicle P&L', th: 'ผลประกอบการรถบริษัท',
    desc: 'รายได้ ค่าใช้จ่าย และผลสุทธิ ราย DC และรายคัน',
    repo: 'NIMEX-Vehicle-P-L-Dashboard', icon: 'chart' },
  { id: 'car', group: 'cost', name: 'Car Performance', th: 'ผลรถบริษัท',
    desc: 'ผลประกอบการ การใช้งาน และน้ำมันของรถบริษัท NIM Express และ SEAL Gold Chain',
    repo: 'NIMEX-Car-Performance-Dashboard', icon: 'gauge' },
  { id: 'card', group: 'cost', name: 'Fleet Card', th: 'บัตรน้ำมันเทียบวงเงิน',
    desc: 'การใช้น้ำมันเทียบวงเงิน PA รายเดือน รายกลุ่ม ราย DC และรายทะเบียน',
    repo: 'NIMEX-Fleet-Card-Dashboard', icon: 'fuel' },
  { id: 'planning', group: 'cost', name: 'Fleet Planning Catalog', th: 'แคตตาล็อกวางแผนรถ',
    desc: 'ข้อมูลรถสำหรับวางแผนกองรถ ขนาด ความจุ และการใช้งาน',
    repo: 'NIMEX-Fleet_Planning_Catalog', icon: 'grid', hidden: true }
];
