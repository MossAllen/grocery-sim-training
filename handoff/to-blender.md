# 📦 ชุดส่งงาน → Blender (ภาพและโมเดล 3D)

## ✅ การตัดสินใจเฟส 1 (2026-11-25) — ใช้เป็นกรอบงาน
1. เทคโนโลยี: HTML/CSS/JS ล้วน (ย้ายฉากร้านไป LittleJS เมื่อจำเป็น)
2. ภาพ: low-poly 3D จาก Blender render เป็น 2D + Kenney CC0
3. เสียงพากย์: ไฟล์พากย์สำเร็จสำหรับประโยคหลัก (docs/VOICE_LINES.md) + TTS สำรอง
4. ทุกรอบมีปุ่ม 📚 อ่านประกอบ: คลิป 1 + แหล่งทางการ 1 จาก docs/RESEARCH.md
5. โหมดข้อมูลจริง: ผู้ฝึกกรอกราคา ต้นทุน ยอดขายจากร้านจริงแทนตัวเลขสุ่มได้

## ไฟล์ที่ใช้
อยู่ในไฟล์ `dist/handoff-blender.zip` แล้ว

1. `blender/generate_store_assets.py` — สคริปต์สร้างโมเดล + render + เขียน manifest
2. `docs/ART_SPEC.md` — คีย์ ขนาด สไตล์ และสิ่งที่ควรทำต่อ
3. `game/assets/sprites/*` — ภาพเวอร์ชัน 0.1 (ใช้เทียบ)
4. `docs/RESEARCH.md` §2 (คลิป Blender) และ §4 (คู่มือ bpy, Kenney CC0, awesome-blender)
5. `docs/ROADMAP.md` เฟส 3 — ฉาก isometric และลูกค้า 4 แบบ 2 ท่า

> ตามข้อ 2: ถ้าจะนำโมเดล Kenney (CC0) มาใช้ ให้ import .glb/.fbx เข้าสคริปต์แล้ว render ด้วยกล้องและแสงเดิม
> และเพิ่มแถวใน THIRD_PARTY.md ทุกครั้ง

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
