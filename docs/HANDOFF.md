# ขั้นตอนการทำงานร่วมกันและการส่งต่องาน (Handoff Pipeline)

เอกสารนี้กำหนดว่า AI แต่ละตัวทำอะไร ส่งอะไรให้ใคร ผ่าน GitHub อย่างไร เพื่อให้งานต่อกันได้โดยไม่ต้องอธิบายซ้ำ

---

## 1. ภาพรวมสายงาน

```
 แผนฝึก 8 สัปดาห์.docx  (แหล่งความจริงของเนื้อหา)
          │
          ▼
 ① ChatGPT SOL ── docs/GDD.md ─────────────┐   แบบแผน แนวคิด สมดุลเกม
          │                                  │
          ▼                                  ▼
 ② Claude Opus ── game/js, css, html   ③ Gemini Neo ── docs/AUDIO_SPEC.md + game/assets/audio/*
          │        (โค้ด + manifest)          │   เสียงเอฟเฟกต์ เพลง รายละเอียดฉาก
          │                                  │
          │      ④ Blender ── blender/*.py → game/assets/sprites/*.png + manifest.js
          │                                  │
          └────────── GitHub: branch → Pull Request → review → main → GitHub Pages ──┘
```

**กติกาสำคัญที่สุด: แต่ละทีมแก้เฉพาะไฟล์ที่ตัวเองเป็นเจ้าของ** แล้วสื่อสารกันผ่าน "สัญญา" (contract) ที่ตกลงไว้ คือ

| สัญญา | ไฟล์ | ใครเขียน | ใครอ่าน |
|---|---|---|---|
| รายการรอบและกลไก | `docs/GDD.md` §3–4 | ChatGPT | Claude |
| คีย์เสียง | `game/assets/audio/manifest.js` + `docs/AUDIO_SPEC.md` | Claude สร้างคีย์ / Gemini ใส่ไฟล์ | เกม |
| คีย์ภาพ | `game/assets/sprites/manifest.js` + `docs/ART_SPEC.md` | Claude สร้างคีย์ / Blender สร้างไฟล์ | เกม |

ถ้าต้องการคีย์ใหม่ (เช่นเสียงใหม่ ภาพใหม่) ให้เปิด Issue แบบ **Handoff** ถึง Claude เพื่อเพิ่มคีย์ในโค้ดก่อน — ห้ามเปลี่ยนชื่อคีย์เดิมเอง

---

## 2. ความเป็นเจ้าของไฟล์

| เส้นทาง | เจ้าของ | หมายเหตุ |
|---|---|---|
| `แผนฝึกการตลาด 8 สัปดาห์.docx` | ผู้สอน/เจ้าของโปรเจกต์ | อ่านอย่างเดียว |
| `docs/GDD.md` | ChatGPT SOL | แบบแผนเกม |
| `game/js/**`, `game/css/**`, `game/index.html` | Claude Opus | โค้ด |
| `game/js/curriculum.js` | Claude (แปลงจาก GDD) | ChatGPT เสนอเนื้อหาผ่าน GDD ไม่แก้ไฟล์ JS ตรง |
| `docs/AUDIO_SPEC.md`, `game/assets/audio/**` | Gemini Neo | ไฟล์เสียง + manifest |
| `blender/**`, `game/assets/sprites/**`, `docs/ART_SPEC.md` | Blender | `manifest.js` ถูกเขียนทับโดยสคริปต์ |
| `.github/**`, `handoff/**`, `docs/HANDOFF.md` | ทุกทีม | แก้ได้เมื่อตกลงกันใน PR |

---

## 3. Branch และ Commit

| งาน | ชื่อ branch | ตัวอย่าง commit |
|---|---|---|
| แบบแผนเกม | `design/<หัวข้อ>` | `design: ปรับสมดุลโปรโมชันสัปดาห์ 4` |
| โค้ด | `code/<หัวข้อ>` | `code: เพิ่มกลไกฟังตัวเลขในบทสนทนา` |
| เสียง | `audio/<หัวข้อ>` | `audio: ใส่เสียง correct/wrong/coin` |
| ภาพ | `art/<หัวข้อ>` | `art: โมเดลชั้นวางและลูกค้าเวอร์ชัน 2` |
| ส่งต่องาน | ใช้ branch ของงานนั้น | `handoff: ใบส่งต่อ code → audio รอบ 2` |

- 1 PR = 1 ทีม = 1 เรื่อง เพื่อ review ง่าย
- `main` ต้องเปิดเกมได้เสมอ → GitHub Actions deploy ไป GitHub Pages อัตโนมัติ (`.github/workflows/pages.yml`)

---

## 4. ใบส่งต่องาน (Handoff Packet)

ทุกครั้งที่ทีมหนึ่งทำเสร็จและต้องให้อีกทีมทำต่อ ให้สร้างไฟล์ใน `handoff/` ตามแม่แบบ `handoff/TEMPLATE.md`
ชื่อไฟล์: `YYYY-MM-DD_<จาก>-to-<ถึง>_<หัวข้อ>.md` แล้วแนบลิงก์ในคำอธิบาย PR หรือ Issue

ใบส่งต่อต้องตอบ 6 ข้อ:

1. **ทำอะไรเสร็จแล้ว** (ลิงก์ PR/commit)
2. **ส่งอะไรให้** (ไฟล์ คีย์ ขนาด รูปแบบ)
3. **ผู้รับต้องทำอะไร** (รายการงานที่ตรวจได้)
4. **สัญญาที่ห้ามเปลี่ยน** (ชื่อคีย์ รูปแบบไฟล์ ขนาด)
5. **วิธีทดสอบ** (คำสั่งรัน / หน้าที่ต้องเปิด / สิ่งที่ควรเห็น)
6. **คำถามค้าง** (ถ้ามี)

---

## 5. รอบการทำงาน (ทำซ้ำได้ทุกเวอร์ชัน)

| ขั้น | ผู้ทำ | รับเข้า | ส่งออก | เสร็จเมื่อ |
|---|---|---|---|---|
| 1 ออกแบบ | ChatGPT SOL | docx + ผลเล่นทดสอบ + Issue | PR แก้ `docs/GDD.md` + ใบส่งต่อถึง Claude | GDD ระบุรอบ กลไก ตัวเลข และเกณฑ์ชนะครบ |
| 2 เขียนโค้ด | Claude Opus | GDD + ใบส่งต่อ | PR แก้ `game/` + คีย์ใหม่ใน manifest + ใบส่งต่อถึง Gemini/Blender | เกมเปิดได้ ไม่มี error ใน console ทุกรอบเล่นจบได้ |
| 3a เสียง | Gemini Neo | AUDIO_SPEC + คีย์ | ไฟล์ `.ogg/.mp3` + แก้ `audio/manifest.js` | ทุกคีย์มีไฟล์ ความดังสม่ำเสมอ ≤ 200 KB/ไฟล์ |
| 3b ภาพ | Blender | ART_SPEC + คีย์ | รันสคริปต์ → PNG + `sprites/manifest.js` | ภาพไม่ถูกตัดขอบ พื้นหลังโปร่งใส ขนาดตรงสเปก |
| 4 รวมและทดสอบ | Claude Opus | PR จาก 3a/3b | merge เข้า `main` + บันทึกผลทดสอบ | เล่นครบ 8 สัปดาห์ 3 สินค้า |
| 5 เล่นทดสอบ | ผู้ฝึก/ครู | ลิงก์ GitHub Pages | Issue ข้อเสนอแนะ (template Design change) | ส่งกลับขั้น 1 |

ขั้น 3a และ 3b ทำพร้อมกันได้ เพราะแตะไฟล์คนละชุด

---

## 6. Prompt สำเร็จรูปสำหรับแต่ละ AI

> ชุดส่งงานพร้อมใช้ (ไฟล์แนบ + prompt + คำสั่ง git ตอนรับงานกลับ) อยู่ที่ `handoff/to-chatgpt-sol.md`, `handoff/to-gemini-neo.md`, `handoff/to-blender.md` และไฟล์ zip ใน `dist/` (สร้างด้วย `python tools/make_bundles.py`)

คัดลอกไปใช้ได้เลย แทน `<...>` ด้วยข้อมูลจริง และแนบไฟล์ที่ระบุ

### ① ChatGPT SOL — แบบแผนเกม

```
คุณคือ Game Designer ของโปรเจกต์ "ร้านชำจำลอง" (เกมฝึกการตลาด ปวส.)
แนบ: แผนฝึกการตลาด 8 สัปดาห์.docx, docs/GDD.md, handoff/<ใบส่งต่อล่าสุด>.md
งาน: <เช่น ปรับสมดุลโมเดลอุปสงค์สัปดาห์ 4 / เพิ่มสถานการณ์ลูกค้า>
ข้อกำหนด:
- แก้เฉพาะ docs/GDD.md โดยคงหัวข้อ §1–§8 เดิม
- ทุกรอบต้องอ้างหัวข้อจาก docx (สัปดาห์/รอบ) และระบุ engine ที่มีอยู่: mcq, calc, sort, dialogue, observe, sim, post, pitch
- ถ้าต้องการกลไกใหม่ ให้เขียนสเปกในหัวข้อ "§9 คำขอกลไกใหม่" พร้อม input/output/เกณฑ์คะแนน
- ตัวเลขทุกตัวต้องคำนวณซ้ำได้ แสดงสูตร
ส่งออก: GDD ฉบับแก้ทั้งไฟล์ + ใบส่งต่อตาม handoff/TEMPLATE.md ถึง Claude
```

### ② Claude Opus — โค้ด

```
อ่าน docs/GDD.md และ handoff/<ใบส่งต่อจาก ChatGPT>.md แล้วแปลงเป็นโค้ดใน game/
- เนื้อหารอบอยู่ใน game/js/curriculum.js, กลไกใน game/js/engines.js
- ห้ามแก้ไฟล์เสียง/ภาพจริง เพิ่มได้เฉพาะคีย์ใหม่ใน manifest (ค่า null) และอัปเดต AUDIO_SPEC/ART_SPEC
- ทดสอบ: python -m http.server 8765 --directory game แล้วเล่นทุกรอบที่แก้ ไม่มี error ใน console
ส่งออก: PR branch code/<หัวข้อ> + ใบส่งต่อถึง Gemini และ/หรือ Blender ถ้ามีคีย์ใหม่
```

### ③ Gemini Neo — เสียงและรายละเอียดในเกม

```
คุณคือ Sound Designer ของเกม "ร้านชำจำลอง"
แนบ: docs/AUDIO_SPEC.md, game/assets/audio/manifest.js, handoff/<ใบส่งต่อ>.md
งาน: สร้าง/เลือกเสียงตามตารางใน AUDIO_SPEC ทุกคีย์ที่ยังเป็น null
ข้อกำหนด: รูปแบบ .ogg (สำรอง .mp3), 44.1 kHz, mono สำหรับ SFX, peak ≤ -3 dBFS, ไม่เกิน 200 KB/ไฟล์
ใช้เฉพาะเสียงที่สร้างเองหรือมีสิทธิ์ใช้ (CC0/ได้รับอนุญาต) และกรอกแหล่งที่มาในคอลัมน์ "ที่มา/สิทธิ์"
เสนอรายละเอียดฉากเพิ่ม (เสียงบรรยากาศ ข้อความลูกค้า) ในหัวข้อ "ข้อเสนอเพิ่มเติม" ของ AUDIO_SPEC
ส่งออก: ไฟล์เสียงใน game/assets/audio/, manifest.js ที่ใส่ path แล้ว, ใบส่งต่อถึง Claude
```

### ④ Blender — ภาพ/โมเดล

```
รัน: blender -b -P blender/generate_store_assets.py
ถ้าปรับโมเดล ให้แก้ฟังก์ชัน build_* ใน blender/generate_store_assets.py โดยคงคีย์และขนาดใน docs/ART_SPEC.md
ตรวจ: ภาพใน game/assets/sprites/ ไม่ถูกตัดขอบ พื้นหลังโปร่งใส แล้วเปิดเกมดูฉากร้าน (สัปดาห์ 1 รอบ 2)
ส่งออก: PR branch art/<หัวข้อ> พร้อม PNG + manifest.js + ภาพหน้าจอในเกม
```

---

## 7. Checklist ก่อน merge เข้า main

- [ ] `node tools/check.js` ผ่าน (GitHub Actions รันให้อัตโนมัติทุก PR)
- [ ] เปิด `game/index.html` ผ่าน http server ได้ ไม่มี error ใน console
- [ ] เล่นรอบที่แก้จนจบ ได้หน้าดาว และบันทึกลงแฟ้มผลงาน
- [ ] ทดสอบครบ 3 สินค้า (น้ำดื่ม / ขนม / ของใช้) ถ้าแก้เนื้อหา
- [ ] ไม่เปลี่ยนชื่อคีย์เสียง/ภาพที่มีอยู่
- [ ] มีใบส่งต่องานใน `handoff/` ถ้ามีทีมอื่นต้องทำต่อ
- [ ] ข้อมูลจำลองถูกกำกับว่า "จำลอง" ในข้อความที่ผู้เล่นเห็น
