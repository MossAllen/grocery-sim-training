# 📦 ชุดส่งงาน → Blender (ภาพและโมเดล 3D)

## ไฟล์ที่ใช้
อยู่ในไฟล์ `dist/handoff-blender.zip` แล้ว

1. `blender/generate_store_assets.py` — สคริปต์สร้างโมเดล + render + เขียน manifest
2. `docs/ART_SPEC.md` — คีย์ ขนาด สไตล์ และสิ่งที่ควรทำต่อ
3. `game/assets/sprites/*` — ภาพเวอร์ชัน 0.1 (ใช้เทียบ)

## ขั้นตอน (ทำในเครื่องนี้ได้เลย — มี Blender 5.3 แล้ว)

1. เปิดสคริปต์ใน Blender (แท็บ Scripting) หรือแก้ในโปรแกรมแก้โค้ด
2. ปรับโมเดลในฟังก์ชัน `build_shelf`, `build_counter`, `build_customer`, `build_item` ตามหัวข้อ "ขั้นต่อไปที่แนะนำ" ใน ART_SPEC
   - ห้ามเปลี่ยนชื่อคีย์และขนาดในตาราง `SIZES`
   - ถ้าจะเพิ่มภาพใหม่ (เช่น `store_bg`) ให้เปิด Issue แบบ "ขอเสียงหรือภาพใหม่" ก่อน
3. Render:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b -P blender/generate_store_assets.py
```

4. ตรวจ: ภาพไม่ถูกตัดขอบ พื้นหลังโปร่งใส แล้วเปิดเกมดูสัปดาห์ 1 รอบ 2 (ฉากร้าน)

```powershell
node tools/check.js
```

5. ส่งงาน:

```powershell
git switch -c art/models-v2
git add blender game/assets/sprites docs/ART_SPEC.md handoff/
git commit -m "art: ปรับโมเดลร้านชำเวอร์ชัน 2"
git push -u origin art/models-v2
gh pr create --fill
```

แนบภาพหน้าจอฉากร้านในเกมในคำอธิบาย PR

## ถ้าใช้ AI ช่วยเขียนโมเดล

แนบ `generate_store_assets.py` + `ART_SPEC.md` แล้วสั่ง:

```
ปรับฟังก์ชัน build_* ในสคริปต์ Blender นี้ให้โมเดลร้านชำไทยแบบ low-poly สวยขึ้นตาม ART_SPEC.md
ห้ามเปลี่ยนชื่อคีย์ ขนาดในตาราง SIZES และฟังก์ชัน main/render/camera_and_light
ต้องรันได้ด้วย blender -b -P (ไม่มีหน้าจอ) บน Blender 5.x ส่งกลับสคริปต์ทั้งไฟล์
```
