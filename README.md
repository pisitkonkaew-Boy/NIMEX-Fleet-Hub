# NIMEX Fleet Hub

ศูนย์รวม Dashboard ระบบรถ NIMEX (หน้าเว็บอย่างเดียว ไม่มีข้อมูลตัวเลขใน repo นี้)

- 2 หมวด หมวดละ 3 × 3 ช่อง: บริหารจัดการรถและคน / บริหารจัดการต้นทุนและประสิทธิภาพ
- เพิ่มระบบใหม่: เพิ่ม 1 รายการใน `HUB_SYSTEMS` ของ `config.js` (ระบุ group, name, th, desc, repo, icon) แล้วเพิ่มเลข `HUB_V`
- ซ่อน/แสดงระบบ: ในโหมด `#admin` การ์ดทุกใบมีปุ่ม "แสดง / ซ่อนอยู่" กดแล้วบันทึกให้ผู้ชมทุกคน
- เพิ่มลิงก์ระบบใหม่: โหมด `#admin` → ปุ่ม "เพิ่มระบบ" บนหัวหมวดหรือในช่องว่าง → ใส่ชื่อ คำอธิบาย ลิงก์ หมวด ไอคอน (แก้ไข/ลบได้จากปุ่ม "แก้ไข" บนการ์ด)
- ช่องว่าง: กด "ซ่อนช่องนี้" หรือ "ซ่อนช่องว่างทั้งหมด" ผู้ชมจะไม่เห็นช่องว่าง
- กดการ์ดแล้วเปิดแดชบอร์ดในแท็บใหม่
- หน้าตา A (Navy Classic) / B (Command Night): ผู้ดูแลเปิดลิงก์ต่อท้าย `#admin` → กดปุ่ม "หน้าตา" ด้านบน → ใส่รหัส → ผู้ชมทุกคนเห็นแบบเดียวกัน
- รหัสผู้ดูแลเก็บใน Script Properties `ADMIN_KEY` ของ Apps Script เท่านั้น

## ติดตั้ง Apps Script ของ Hub (ครั้งเดียว)
1. สร้าง Google Sheet ใหม่ → Extensions > Apps Script → วางเนื้อหา `Code.gs.txt` บันทึกเป็น Code.gs
2. Project Settings > Script Properties → เพิ่ม `ADMIN_KEY` (ใช้รหัสเดียวกับระบบอื่น)
3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone → คัดลอก URL `/exec`
4. ใส่ URL ใน `HUB_API` ของ `config.js` แล้วเพิ่มเลข `HUB_V`

## GitHub Pages
Settings → Pages → Deploy from branch → main / (root)
