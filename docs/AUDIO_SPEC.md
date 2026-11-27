# Audio Spec — เสียงเอฟเฟกต์และรายละเอียดในเกม

> **เจ้าของเอกสาร: Gemini Neo** · คีย์ทั้งหมดถูกเรียกจากโค้ดแล้ว (`MTL.sfx.play('<key>')`)
> เอฟเฟกต์ใช้พารามิเตอร์ ZzFX และมีเสียงสำรอง WebAudio ใน `game/js/sfx.js` เพลงฉากร้านใช้ไฟล์ Ogg

## วิธีส่งงาน

มี 2 ทางเลือก ต่อคีย์ (เลือกทางใดก็ได้):

- **ทาง A — ไฟล์เสียง:** วางไฟล์ใน `game/assets/audio/` ตั้งชื่อตามคีย์ เช่น `correct.ogg` แล้วแก้ `manifest.js` เป็น `"assets/audio/correct.ogg"`
- **ทาง B — ZzFX (แนะนำสำหรับ SFX สั้น):** ออกแบบเสียงที่ [ZzFX Designer](https://killedbyapixel.github.io/ZzFX/) กด Copy แล้ววางเฉพาะตัวเลขเป็น array ใน `manifest.js` เช่น `correct: [1,.05,523,0,.1,.2,1]` — ไม่มีไฟล์ ไม่มีปัญหาลิขสิทธิ์ (ใช้ไม่ได้กับ `bgm_store`)

ขั้นต่อไป:
1. รัน `node tools/check.js` เพื่อตรวจคีย์และไฟล์
2. ทดสอบในเกมตามขั้นด้านล่าง
3. เปิดเกม กด 🔊 ให้เปิดอยู่ แล้วเล่นรอบที่มีเสียงนั้น (ดูคอลัมน์ "ได้ยินที่")
4. ถ้าไฟล์โหลดไม่ได้ เกมจะกลับไปใช้เสียงสำรองเอง ไม่พัง

**มาตรฐานไฟล์:** `.ogg` (Vorbis) 44.1 kHz · SFX เป็น mono · peak ≤ −3 dBFS · ความดังใกล้เคียงกันทุกไฟล์ · ไม่เกิน 200 KB (เพลงไม่เกิน 1.5 MB) · ตัดเงียบหัวท้าย

## รายการเสียง

| คีย์ | ได้ยินที่ | ความยาว | อารมณ์ / ตัวอย่าง | ไฟล์ | ที่มา/สิทธิ์ |
|---|---|---|---|---|---|
| `click` | กดปุ่ม เลือกการ์ด | 0.03–0.08 วิ | คลิกไม้/กระดาษเบา ๆ | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `correct` | ตอบถูก | 0.3–0.5 วิ | ระฆังเล็ก 2–3 โน้ตขึ้น สดใส | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `wrong` | ตอบผิด | 0.3–0.5 วิ | "บึ้บ" ต่ำนุ่ม ไม่ตำหนิ ไม่ดัง | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `coin` | ลูกค้าจ่ายเงินในฉากจำลอง | 0.2–0.3 วิ | เหรียญตกลิ้นชักเก็บเงิน | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `star` | หน้าสรุปได้ดาว | 0.5–0.8 วิ | ประกายระยิบ | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `door` | ลูกค้าเข้าร้าน | 0.4–0.7 วิ | กระดิ่งประตูร้าน "ติ๊ง-ต่อง" | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `levelup` | จบช่วงจำลอง / จบสัปดาห์ | 0.8–1.2 วิ | แฟนแฟร์สั้น อบอุ่น | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `tick` | ครบ 60 วินาทีตอนนำเสนอ | 0.05 วิ | ติ๊กนาฬิกา | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `whoosh` | สุ่มโจทย์ใหม่ | 0.3 วิ | ลมพัดกระดาษ | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `note` | จดบันทึก / วางการ์ด / ตอบถูกบางส่วน | 0.2 วิ | ดินสอขีดกระดาษ | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `bgm_store` | วนในฉากร้าน (สังเกต/จำลอง) | 32 วิ วนลูปได้ | ทำนองเบาพร้อมเสียงพื้นหลังสังเคราะห์ | `assets/audio/bgm_store.ogg` | เพลงต้นฉบับของโปรเจกต์ สังเคราะห์ด้วย ZzFX (MIT) · สร้างซ้ำด้วย `node tools/make_store_bgm.js` เมื่อมี FFmpeg |
| `rain` | ฉากจำลองสัปดาห์ 4 เมื่อเกิดเหตุการณ์ฝน (กดเริ่มจำลอง) | 0.8–1.2 วิ | สายฝนเบา ๆ | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |
| `lesson_step` | กด "ต่อไป" ในบทเรียนก่อนเล่น | 0.1–0.2 วิ | เปิดหน้าใหม่ เบามาก | ZzFX ใน manifest | Gemini Neo (Antigravity CLI) 2026-11-26 · ZzFX MIT |

## เสียงพูดภาษาอังกฤษ

บทสนทนาคงที่ 78 ประโยคใช้ไฟล์ `game/assets/voice/<id>.ogg` (Vorbis, mono, 44.1 kHz, ไม่เกิน 80 KB) สร้างด้วย FFmpeg + CMU Flite ใช้เสียงอเมริกัน `rms` สำหรับลูกค้าและ `slt` สำหรับพนักงาน ดูที่มาและเงื่อนไขใน `THIRD_PARTY.md`

เกมเทียบรหัสประโยคกับ `game/assets/voice/manifest.js` และใช้ Web Speech API (`en-US`, rate 0.92) กับข้อความที่เปลี่ยนตามข้อมูลผู้เล่น หรือเมื่อเปิดไฟล์เสียงไม่ได้ สร้างไฟล์และ manifest ซ้ำด้วย `node tools/voice_lines.js --audio` เมื่อ FFmpeg มีตัวกรอง `flite` และตัวเข้ารหัส `libvorbis`

## ข้อเสนอเพิ่มเติม (Gemini เติม)

_(เช่น เสียงบรรยากาศฝนตกเมื่อเกิดเหตุการณ์ฝนในฉากจำลอง · เสียงตู้เย็นร้าน · ข้อความพฤติกรรมลูกค้าเพิ่มเติมสำหรับฉากสังเกต — ระบุคีย์ที่เสนอและจุดที่ควรเล่น)_
