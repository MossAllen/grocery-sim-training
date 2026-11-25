# 📦 ชุดส่งงาน → Gemini Neo (เสียงเอฟเฟกต์และรายละเอียดในเกม)

## อัปโหลดไฟล์เหล่านี้ให้ Gemini
อยู่ในไฟล์ `dist/handoff-gemini-neo.zip` แล้ว

1. `docs/AUDIO_SPEC.md` — รายการเสียง 11 คีย์ ความยาว อารมณ์ จุดที่เล่น
2. `game/assets/audio/manifest.js` — ไฟล์ที่ต้องใส่ path เสียง
3. `game/js/sfx.js` — เสียงสังเคราะห์สำรองที่ใช้อยู่ตอนนี้ (ใช้เทียบโทนเสียง)
4. `game/js/curriculum.js` — ข้อความลูกค้าและบทสนทนาทั้งหมด (สำหรับเสนอรายละเอียดฉาก)
5. `handoff/2026-11-25_claude-to-all_v0.1.md`, `handoff/TEMPLATE.md`
6. `docs/RESEARCH.md` §5 — ZzFX, jsfxr, Tone.js และคลังเสียง CC0 ที่ตรวจแล้ว

## คัดลอก prompt นี้ไปวาง

```
คุณคือ Sound Designer และผู้ดูแลรายละเอียดฉากของเกม "ร้านชำจำลอง" (เกมฝึกการตลาด ฉากร้านชำไทย)
ไฟล์แนบ: AUDIO_SPEC.md, audio/manifest.js, sfx.js, curriculum.js, ใบส่งต่องาน

งาน 1 — เสียงเอฟเฟกต์ (11 คีย์ใน AUDIO_SPEC):
- สร้างเสียงตามตารางในทุกคีย์ ถ้าสร้างไฟล์เสียงเองไม่ได้ ให้ทำ "ใบสั่งเสียง" แทน:
  คำบรรยายสำหรับ AI สร้างเสียง (prompt ภาษาอังกฤษ) + ความยาว + คำค้นหาในคลังเสียง CC0
- มาตรฐาน: .ogg 44.1 kHz, SFX mono, peak ≤ -3 dBFS, ≤ 200 KB, ตัดเงียบหัวท้าย
- แหล่งเสียงแนะนำอยู่ใน RESEARCH.md §5 (ถ้าใช้ ZzFX ให้ส่งพารามิเตอร์ ZzFX ของแต่ละคีย์มาด้วย)
- ใช้เฉพาะเสียงที่สร้างเองหรือสิทธิ์ CC0/ได้รับอนุญาต แล้วกรอกคอลัมน์ "ที่มา/สิทธิ์"

งาน 2 — รายละเอียดในเกม (เติมหัวข้อ "ข้อเสนอเพิ่มเติม" ใน AUDIO_SPEC):
- เสนอพฤติกรรมลูกค้าใหม่อย่างน้อย 6 แบบสำหรับฉากสังเกต ในรูปแบบ
  { see: "สิ่งที่เห็นหรือได้ยิน", good: "เหตุผลที่เป็นไปได้", P: "Product|Price|Place|Promotion" }
  (ดูตัวอย่างใน curriculum.js ฟังก์ชัน M.behaviors) ใช้คำว่า "ลูกค้า" ไม่ใช้ชื่อคน
- เสนอคีย์เสียงใหม่ที่ควรมี (เช่น เสียงฝนเมื่อเกิดเหตุการณ์ฝนตก) พร้อมจุดที่เล่น
- ห้ามเปลี่ยนชื่อคีย์เดิม

ส่งกลับ:
A) ไฟล์เสียง (หรือใบสั่งเสียงถ้าสร้างไฟล์ไม่ได้)
B) AUDIO_SPEC.md ฉบับเต็มที่กรอกแล้ว
C) audio/manifest.js ที่ใส่ path "assets/audio/<คีย์>.ogg" สำหรับคีย์ที่มีไฟล์
D) ใบส่งต่องานถึง Claude Opus ตามแม่แบบ ชื่อ handoff/YYYY-MM-DD_gemini-to-claude_audio-v1.md
```

## เมื่อได้ไฟล์กลับมา

วางไฟล์เสียงใน `game/assets/audio/` และไฟล์ .md/.js ทับของเดิม แล้วรัน:

```powershell
node tools/check.js
```

```powershell
git switch -c audio/sfx-v1
git add game/assets/audio docs/AUDIO_SPEC.md handoff/
git commit -m "audio: เสียงเอฟเฟกต์ชุดแรกจาก Gemini Neo"
git push -u origin audio/sfx-v1
gh pr create --fill
```

ทดสอบฟัง: `python -m http.server 8765 --directory game` → เปิด http://localhost:8765 → สัปดาห์ 4 รอบ 1
