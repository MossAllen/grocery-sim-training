"""
generate_store_assets.py — สร้างภาพสไปรต์ร้านชำแบบ low-poly ด้วย Blender (ทีมภาพ 3D)

วิธีรัน (จากโฟลเดอร์ marketing-training-lab):
    blender -b -P blender/generate_store_assets.py

ผลลัพธ์:
    game/assets/sprites/<key>.png        ภาพ PNG พื้นหลังโปร่งใส
    game/assets/sprites/manifest.js      เขียนทับให้เกมโหลดภาพเหล่านี้อัตโนมัติ

คีย์และขนาดต้องตรงกับ docs/ART_SPEC.md (ห้ามเปลี่ยนชื่อคีย์)
ทดสอบกับ Blender 3.6 และ 4.x — ถ้าต้องการโมเดลละเอียดขึ้น ให้แก้ฟังก์ชัน build_* แต่คงชื่อคีย์เดิม
"""
import math
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "game", "assets", "sprites"))
os.makedirs(OUT, exist_ok=True)

# key: (ความกว้าง, ความสูง) พิกเซล
SIZES = {
    "shelf": (260, 180),
    "counter": (320, 160),
    "customer": (88, 132),
    "item": (48, 56),
}

SHIRTS = [(0.91, 0.44, 0.32), (0.16, 0.62, 0.56), (0.91, 0.77, 0.42), (0.34, 0.46, 0.56), (0.71, 0.51, 0.55)]


# ---------- ตัวช่วย ----------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = "PNG"
    scn.render.image_settings.color_mode = "RGBA"
    scn.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    scn.world = world
    return scn


def mat(name, rgb, rough=0.6, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(m, "blend_method"):
            m.blend_method = "BLEND"
    return m


def cube(loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.scale = scale
    o.data.materials.append(material)
    return o


def cyl(loc, r, depth, material, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    o = bpy.context.active_object
    o.data.materials.append(material)
    return o


def sphere(loc, r, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=r, location=loc)
    o = bpy.context.active_object
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def camera_and_light(scn, target_h, size_key, obj_w):
    """กล้องมุมสูงเล็กน้อย เล็งกลางวัตถุ และขยายภาพให้พอดีทั้งความกว้างและความสูง"""
    wp, hp = SIZES[size_key]
    scn.render.resolution_x, scn.render.resolution_y = wp, hp
    tilt, dist, pad = math.radians(12), 10.0, 1.18
    cz = target_h / 2
    bpy.ops.object.camera_add(location=(0, -dist * math.cos(tilt), cz + dist * math.sin(tilt)), rotation=(math.pi / 2 - tilt, 0, 0))
    cam = bpy.context.active_object
    cam.data.type = "ORTHO"
    need_w, need_h = obj_w * pad, target_h * pad
    # ortho_scale ครอบด้านที่ยาวกว่าของภาพ
    cam.data.ortho_scale = max(need_w, need_h * wp / hp) if wp >= hp else max(need_h, need_w * hp / wp)
    scn.camera = cam
    bpy.ops.object.light_add(type="SUN", location=(3, -5, 8), rotation=(math.radians(45), math.radians(15), math.radians(20)))
    bpy.context.active_object.data.energy = 3.5


def render(scn, key):
    path = os.path.join(OUT, f"{key}.png")
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("rendered", path)
    return f"assets/sprites/{key}.png"


# ---------- โมเดล ----------
def build_shelf():
    wood, wood2 = mat("wood", (0.55, 0.43, 0.30)), mat("wood2", (0.65, 0.52, 0.37))
    cube((0, 0, 1.0), (1.6, 0.35, 1.0), wood)
    for z in (0.55, 1.35):
        cube((0, -0.2, z), (1.5, 0.3, 0.05), wood2)
    return 2.0


def build_counter():
    wood, top = mat("counter", (0.42, 0.31, 0.21)), mat("top", (0.55, 0.43, 0.30))
    cube((0, 0, 0.5), (2.0, 0.5, 0.5), wood)
    cube((0, 0, 1.03), (2.1, 0.6, 0.04), top)
    cube((1.2, 0, 1.3), (0.3, 0.25, 0.25), mat("register", (0.2, 0.2, 0.22)))
    return 1.6


def build_customer(i):
    skin, shirt, pants = mat("skin", (0.96, 0.78, 0.6)), mat("shirt", SHIRTS[i]), mat("pants", (0.2, 0.22, 0.3))
    cyl((0, 0, 0.45), 0.22, 0.9, pants)
    cyl((0, 0, 1.2), 0.3, 0.7, shirt)
    sphere((0, 0, 1.8), 0.28, skin)
    sphere((0, 0.02, 1.95), 0.27, mat("hair", (0.15 + 0.1 * i, 0.1, 0.05)))
    return 2.2


def build_item(product, size):
    big = size == "big"
    if product == "water":
        body = mat("water", (0.55, 0.8, 0.95), rough=0.1, alpha=0.6)
        h = 1.4 if big else 0.9
        cyl((0, 0, h / 2), 0.28 if big else 0.2, h, body)
        cyl((0, 0, h + 0.08), 0.09, 0.16, mat("cap", (0.1, 0.4, 0.85)))
        cyl((0, 0, h * 0.55), (0.29 if big else 0.21), h * 0.3, mat("label", (0.95, 0.95, 0.98)))
        return h + 0.2
    if product == "snack":
        bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0.6))
        o = bpy.context.active_object
        o.scale = (0.45 if big else 0.32, 0.12, 0.6 if big else 0.45)
        o.data.materials.append(mat("bag", (0.95, 0.55, 0.15) if big else (0.9, 0.2, 0.25)))
        bpy.ops.object.modifier_add(type="SUBSURF")
        o.modifiers[-1].levels = 2
        return 1.3
    # household: ทิชชู
    paper = mat("paper", (0.97, 0.97, 0.95), rough=0.9)
    if big:
        for x in (-0.25, 0.25):
            for z in (0.3, 0.9):
                cyl((x, 0, z), 0.24, 0.55, paper)
        return 1.3
    cyl((0, 0, 0.35), 0.28, 0.6, paper)
    cyl((0, 0, 0.35), 0.08, 0.62, mat("core", (0.6, 0.45, 0.3)))
    return 0.8


# ---------- main ----------
def main():
    manifest = {}

    scn = reset_scene(); h = build_shelf(); camera_and_light(scn, h, "shelf", 3.2)
    manifest["shelf"] = render(scn, "shelf")

    scn = reset_scene(); h = build_counter(); camera_and_light(scn, h, "counter", 4.2)
    manifest["counter"] = render(scn, "counter")

    for i in range(5):
        scn = reset_scene(); h = build_customer(i); camera_and_light(scn, h, "customer", 0.8)
        manifest[f"customer_{i + 1}"] = render(scn, f"customer_{i + 1}")

    for product in ("water", "snack", "household"):
        for size in ("small", "big"):
            scn = reset_scene(); h = build_item(product, size); camera_and_light(scn, h, "item", 1.0)
            key = f"item_{product}_{size}"
            manifest[key] = render(scn, key)

    lines = ",\n".join(f'  {k}: "{v}"' for k, v in manifest.items())
    with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("/* สร้างอัตโนมัติโดย blender/generate_store_assets.py — ดู docs/ART_SPEC.md */\n")
        f.write("window.MTL_SPRITE_MANIFEST = {\n" + lines + "\n};\n")
    print("manifest written:", len(manifest), "sprites")


main()
