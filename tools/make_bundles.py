"""
tools/make_bundles.py — รวมไฟล์ที่ต้องอัปโหลดให้แต่ละ AI เป็น zip ใน dist/
    python tools/make_bundles.py
ทุก zip มีไฟล์ README-ส่งงาน.md (prompt + ขั้นตอนรับงานกลับ) อยู่ด้านบนสุด
"""
import glob
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

RELEASE = "handoff/2026-11-27_codex-to-all_v0.4.md"
COMMON = ["docs/RESEARCH.md", "docs/ROADMAP.md", "handoff/TEMPLATE.md", RELEASE,
          "handoff/2026-11-26_claude-to-all_v0.3.md", "docs/HANDOFF.md"]
BUNDLES = {
    "handoff-chatgpt-sol": {
        "readme": "handoff/to-chatgpt-sol.md",
        "files": ["แผนฝึกการตลาด 8 สัปดาห์.docx", "docs/GDD.md", "README.md", "game/js/curriculum.js", "game/js/lesson-kit.js"]
        + sorted(os.path.relpath(p, ROOT).replace("\\", "/") for p in glob.glob(os.path.join(ROOT, "game/js/lessons-w*.js")))
        + COMMON,
    },
    "handoff-gemini-neo": {
        "readme": "handoff/to-gemini-neo.md",
        "files": ["docs/AUDIO_SPEC.md", "docs/VOICE_LINES.md", "game/assets/audio/manifest.js", "game/assets/audio/bgm_store.ogg", "game/assets/voice/manifest.js",
                  "game/js/sfx.js", "game/vendor/zzfx/ZzFXMicro.js", "game/js/curriculum.js", "tools/voice_lines.js", "tools/make_store_bgm.js", "THIRD_PARTY.md"]
        + sorted(os.path.relpath(p, ROOT).replace("\\", "/") for p in glob.glob(os.path.join(ROOT, "game/assets/voice/*.ogg")))
        + sorted(os.path.relpath(p, ROOT).replace("\\", "/") for p in glob.glob(os.path.join(ROOT, "game/js/lessons-w*.js")))
        + COMMON,
    },
    "handoff-blender": {
        "readme": "handoff/to-blender.md",
        "files": ["blender/generate_store_assets.py", "docs/ART_SPEC.md", "game/assets/sprites/manifest.js"]
        + sorted(os.path.relpath(p, ROOT).replace("\\", "/") for p in glob.glob(os.path.join(ROOT, "game/assets/sprites/*.png")))
        + COMMON,
    },
}


def main():
    os.makedirs(DIST, exist_ok=True)
    for name, spec in BUNDLES.items():
        out = os.path.join(DIST, f"{name}.zip")
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            guide = os.path.join(ROOT, spec["readme"])
            with open(guide, "r", encoding="utf-8") as file:
                previous = file.read()
            z.writestr("README-ส่งงาน.md", f"# ชุดส่งงาน {name} · v0.4\n\n"
                       f"เริ่มที่ `{RELEASE}` โดยใช้ตารางส่งงานรอบถัดไปหลังรับผลผู้ฝึก\n\n"
                       "## คำสั่งและขั้นตอนจากรุ่นก่อนสำหรับอ้างอิง\n\n" + previous)
            for rel in spec["files"]:
                src = os.path.join(ROOT, rel)
                if not os.path.exists(src):
                    raise SystemExit(f"ไม่พบไฟล์ {rel}")
                z.write(src, rel)
        print(f"dist/{name}.zip ({len(spec['files']) + 1} entries, {os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
