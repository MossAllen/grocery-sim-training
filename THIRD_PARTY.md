# ส่วนประกอบจากภายนอก (Third-party)

| ส่วนประกอบ | ที่อยู่ในโปรเจกต์ | ที่มา | ใบอนุญาต |
|---|---|---|---|
| ฟอนต์ Sarabun (Regular, SemiBold, Bold) | `game/assets/fonts/sarabun/` | [google/fonts ofl/sarabun](https://github.com/google/fonts/tree/main/ofl/sarabun) · ต้นฉบับ [cadsondemak/Sarabun](https://github.com/cadsondemak/Sarabun) | SIL OFL 1.1 (`OFL.txt`) |
| ฟอนต์ Kanit (SemiBold) | `game/assets/fonts/kanit/` | [google/fonts ofl/kanit](https://github.com/google/fonts/tree/main/ofl/kanit) | SIL OFL 1.1 (`OFL.txt`) |
| ZzFX Micro v1.4.0 | `game/vendor/zzfx/ZzFXMicro.js` | [KilledByAPixel/ZzFX](https://github.com/KilledByAPixel/ZzFX) · ปรับให้เปิด AudioContext เมื่อเริ่มเล่นเสียงครั้งแรก | MIT (`LICENSE`) |
| เสียงพูดสังเคราะห์ภาษาอังกฤษ (บทพูดของโปรเจกต์) | `game/assets/voice/*.ogg` | สังเคราะห์ด้วย CMU Flite `rms` และ `slt` ผ่าน FFmpeg | [เงื่อนไข CMU Flite](https://github.com/festvox/flite/blob/master/COPYING) · เผยแพร่ไฟล์เสียงที่สร้างขึ้น |

ดาวน์โหลดฟอนต์และ ZzFX เมื่อ 2026-11-25 จาก GitHub โดยตรง
รุ่น v0.4 เพิ่ม WOFF2 ที่บีบอัดจากไฟล์ TTF เดิมโดยคงชื่อฟอนต์ ผังอักขระ และระยะตัวอักษรไว้
เมื่อเพิ่มภาพหรือเสียงจากภายนอก (เช่น Kenney CC0) ให้เพิ่มแถวในตารางนี้ทุกครั้ง

เพลง `game/assets/audio/bgm_store.ogg` เป็นทำนองต้นฉบับของโปรเจกต์ เอาต์พุตสังเคราะห์จาก ZzFX ด้วย `tools/make_store_bgm.js` โดยใช้แหล่งเสียงสังเคราะห์ทั้งหมด
