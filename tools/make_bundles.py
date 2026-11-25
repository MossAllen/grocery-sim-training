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

COMMON = ["docs/RESEARCH.md", "docs/ROADMAP.md", "handoff/TEMPLATE.md", "handoff/2026-11-25_claude-to-all_v0.1.md", "docs/HANDOFF.md"]
BUNDLES = {
    "handoff-chatgpt-sol": {
        "readme": "handoff/to-chatgpt-sol.md",
        "files": ["แผนฝึกการตลาด 8 สัปดาห์.docx", "docs/GDD.md", "README.md"] + COMMON,
    },
    "handoff-gemini-neo": {
        "readme": "handoff/to-gemini-neo.md",
        "files": ["docs/AUDIO_SPEC.md", "game/assets/audio/manifest.js", "game/js/sfx.js", "game/vendor/zzfx/ZzFXMicro.js", "game/js/curriculum.js"] + COMMON,
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
            z.write(os.path.join(ROOT, spec["readme"]), "README-ส่งงาน.md")
            for rel in spec["files"]:
                src = os.path.join(ROOT, rel)
                if not os.path.exists(src):
                    raise SystemExit(f"ไม่พบไฟล์ {rel}")
                z.write(src, rel)
        print(f"{out}  ({len(spec['files']) + 1} ไฟล์, {os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
