"""
generate_store_assets.py — สร้างภาพสไปรต์ร้านชำแบบ low-poly ด้วย Blender (ทีมภาพ 3D)

วิธีรัน (จากโฟลเดอร์ marketing-training-lab):
    blender -b -P blender/generate_store_assets.py
    blender -b -P blender/generate_store_assets.py -- --walking-only
    blender -b -P blender/generate_store_assets.py -- --poses-only

ผลลัพธ์:
    game/assets/sprites/<key>.png        ภาพ PNG พื้นหลังโปร่งใส
    game/assets/sprites/manifest.js      เขียนทับให้เกมโหลดภาพเหล่านี้อัตโนมัติ

คีย์และขนาดต้องตรงกับ docs/ART_SPEC.md (ห้ามเปลี่ยนชื่อคีย์)
ทดสอบกับ Blender 3.6, 4.x และ 5.3 — ถ้าต้องการโมเดลละเอียดขึ้น ให้แก้ฟังก์ชัน build_* แต่คงชื่อคีย์เดิม
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "game", "assets", "sprites"))
os.makedirs(OUT, exist_ok=True)

# key: (ความกว้าง, ความสูง) พิกเซล
SIZES = {
    "shelf": (260, 180),
    "counter": (320, 160),
    "customer": (88, 132),
    "customer_pose": (176, 264),   # ท่ากระทำใน W1R2 ใช้กรอบเดียวกับ customer แต่ละเอียด 2 เท่า
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


def limb(a, b, r, material):
    """ทรงกระบอกจากจุด a ไปจุด b (ใช้ทำแขนและสายกระเป๋า)"""
    va, vb = Vector(a), Vector(b)
    d = vb - va
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=r, depth=d.length, location=(va + vb) / 2)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    o.data.materials.append(material)
    return o


def ring(loc, r, thick, material):
    """วงแหวนหันเข้าหากล้อง (กรอบแว่น)"""
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=thick, location=loc, rotation=(math.pi / 2, 0, 0), major_segments=16, minor_segments=6)
    o = bpy.context.active_object
    o.data.materials.append(material)
    return o


def build_walking_legs(scale, pants):
    shoes = mat("shoes", (0.10, 0.09, 0.08))
    for side in (-1, 1):
        hip = (side * 0.10 * scale, 0, 0.88 * scale)
        knee = (side * 0.15 * scale, -side * 0.19 * scale, 0.47 * scale)
        ankle_height = 0.09 if side == 1 else 0.19
        ankle = (side * 0.23 * scale, -side * 0.32 * scale, ankle_height * scale)
        limb(hip, knee, 0.107 * scale, pants)
        sphere(knee, 0.106 * scale, pants)
        limb(knee, ankle, 0.104 * scale, pants)
        cube((ankle[0], ankle[1] - 0.07 * scale, ankle[2] - 0.04 * scale),
             (0.107 * scale, 0.15 * scale, 0.05 * scale), shoes)


# ลูกค้า 4 กลุ่มตาม GDD §5 (+ ลูกค้าทั่วไป) — ต้องแยกออกด้วยรูปทรง ไม่ใช่แค่สีเสื้อ
#   customer_1 รีบเดินทาง: กระเป๋าสะพายข้าง ตัวเอนไปข้างหน้า
#   customer_2 ซื้อเข้าบ้าน: ตัวกว้าง ถือตะกร้า
#   customer_3 นักเรียน: เสื้อขาว กางเกงกรมท่า เป้ใหญ่ ตัวเตี้ยกว่า
#   customer_4 เทียบราคา: แว่นตา ถือสินค้ายกขึ้นอ่านป้าย
#   customer_5 ลูกค้าทั่วไป
# ท่ากระทำที่ผู้เล่นต้องเห็นใน W1R2 (GDD §9): หยิบ ดูป้าย และจ่ายที่เคาน์เตอร์
POSES = [(0, "pick"), (3, "look"), (1, "look"), (2, "pay"), (4, "pay")]


def tagged_pack(loc, scale, body_rgb, name):
    """แพ็กสินค้าทั่วไปพร้อมแถบป้ายราคาด้านหน้า (ใช้ได้กับทุกกลุ่มสินค้า)"""
    cube(loc, scale, mat(name, body_rgb))
    cube((loc[0], loc[1] - scale[1] - 0.005, loc[2] - scale[2] * 0.45), (scale[0] * 0.8, 0.005, scale[2] * 0.22),
         mat(name + "_tag", (1.0, 0.87, 0.35)))


def build_pose(i, pose, s, sh, shirt):
    """แขนและของถือของแต่ละท่า (แทนแขนท่ายืนเดิม)"""
    if (i, pose) == (0, "pick"):  # หยิบแพ็กเล็กเหนือกระเป๋าสะพาย
        bag = mat("bag", (0.18, 0.16, 0.14))
        cube((0.42, -0.05, 1.0 * s), (0.12, 0.2, 0.2), bag)
        limb((-0.22, -0.2, sh), (0.42, -0.1, 1.15 * s), 0.035, bag)
        limb((0.33, -0.1, sh), (0.16, -0.42, 1.34 * s), 0.08, shirt)
        tagged_pack((0.16, -0.54, 1.40 * s), (0.09, 0.06, 0.13), (0.25, 0.7, 0.75), "small")
        limb((-0.33, -0.1, sh), (-0.38, -0.05, 0.95 * s), 0.08, shirt)
    elif (i, pose) == (3, "look"):  # แว่น + ถือสองขนาดเทียบป้าย
        frame = mat("glasses", (0.05, 0.05, 0.05))
        for x in (-0.11, 0.11):
            ring((x, -0.27, 1.82), 0.075, 0.014, frame)
        limb((-0.04, -0.28, 1.82), (0.04, -0.28, 1.82), 0.015, frame)
        limb((-0.33, -0.1, sh), (-0.24, -0.45, 1.48), 0.08, shirt)
        limb((0.33, -0.1, sh), (0.26, -0.45, 1.48), 0.08, shirt)
        tagged_pack((-0.26, -0.55, 1.52), (0.07, 0.05, 0.11), (0.25, 0.7, 0.75), "small")
        tagged_pack((0.28, -0.55, 1.55), (0.11, 0.06, 0.17), (0.2, 0.45, 0.85), "big")
    elif (i, pose) == (1, "look"):  # ตะกร้าห้อยแขนซ้าย ยกแพ็กใหญ่ดู
        basket = mat("basket", (0.78, 0.25, 0.2))
        limb((-0.38, -0.1, sh), (-0.46, -0.18, 1.0 * s), 0.09, shirt)
        cube((-0.46, -0.22, 0.82 * s), (0.22, 0.16, 0.14), basket)
        limb((-0.62, -0.22, 0.98 * s), (-0.30, -0.22, 0.98 * s), 0.025, basket)
        limb((0.38, -0.1, sh), (0.22, -0.48, 1.5 * s), 0.09, shirt)
        tagged_pack((0.18, -0.60, 1.58 * s), (0.17, 0.09, 0.14), (0.95, 0.95, 0.93), "big")
    elif (i, pose) == (2, "pay"):  # นักเรียนยื่นสินค้าและธนบัตรที่เคาน์เตอร์
        pack = mat("pack", (0.2, 0.45, 0.85))
        cube((0, 0.38, 1.25 * s), (0.27, 0.15, 0.3), pack)
        for x in (-0.18, 0.18):
            limb((x, 0.25, sh), (x, -0.27, 1.05 * s), 0.03, pack)
        limb((0.3, 0, sh), (0.17, -0.45, 1.34 * s), 0.07, shirt)
        tagged_pack((0.17, -0.57, 1.40 * s), (0.09, 0.06, 0.13), (0.25, 0.7, 0.75), "small")
        limb((-0.3, 0, sh), (-0.19, -0.45, 1.26 * s), 0.07, shirt)
        cube((-0.19, -0.53, 1.30 * s), (0.13, 0.01, 0.07), mat("note", (0.35, 0.62, 0.38)))
    elif (i, pose) == (4, "pay"):  # อุ้มแพ็กใหญ่ซ้อน 3 ชิ้นมาที่เคาน์เตอร์
        for k, z in enumerate((1.02, 1.24, 1.46)):
            tagged_pack((0, -0.5, z), (0.2, 0.12, 0.1), (0.95, 0.95, 0.93), f"stack{k}")
        limb((0.33, 0, sh), (0.22, -0.45, 1.05), 0.08, shirt)
        limb((-0.33, 0, sh), (-0.22, -0.45, 1.05), 0.08, shirt)
    else:
        raise ValueError(f"no pose {pose} for customer {i + 1}")


def build_customer(i, walking=False, pose=None):
    skin = mat("skin", (0.96, 0.78, 0.6))
    shirt = mat("shirt", SHIRTS[i] if i != 2 else (0.96, 0.96, 0.96))
    pants = mat("pants", (0.08, 0.12, 0.32) if i == 2 else (0.2, 0.22, 0.3))
    hair = mat("hair", (0.12 + 0.06 * i, 0.08, 0.05))
    s = 0.88 if i == 2 else 1.0          # นักเรียนตัวเตี้ยกว่า
    body_r = 0.36 if i == 1 else 0.3     # ซื้อเข้าบ้านตัวกว้าง
    lean = 0.12 if i == 0 else 0.0       # รีบเดินทางเอนไปข้างหน้า (เข้าหากล้อง)
    arm_swing = 0.18 * s if walking else 0.0
    if walking:
        build_walking_legs(s, pants)
    else:
        cyl((0, 0, 0.45 * s), 0.22 * s / 0.88 if i == 1 else 0.22 * s, 0.9 * s, pants)
    torso = cyl((0, -lean / 2, 1.2 * s), body_r * s, 0.7 * s, shirt)
    torso.rotation_euler = (-lean, 0, 0)
    hy = -lean * 1.6
    hx, hz = (0.06, -0.03) if pose == "pick" else (0.0, 0.0)  # ก้มมองกระเป๋าตอนหยิบ
    sphere((hx, hy, 1.8 * s + hz), 0.28 * s, skin)
    sphere((hx, hy + 0.02, 1.95 * s + hz), 0.27 * s, hair)
    sh = 1.45 * s  # ระดับไหล่
    if pose:
        build_pose(i, pose, s, sh, shirt)
        return 2.2 * s
    if i == 0:  # กระเป๋าสะพายข้าง + สาย
        bag = mat("bag", (0.18, 0.16, 0.14))
        cube((0.42, -0.05, 1.0 * s), (0.12, 0.2, 0.2), bag)
        limb((-0.22, -0.2, sh), (0.42, -0.1, 1.15 * s), 0.035, bag)
        limb((0.33, -0.1, sh), (0.4, -0.25, 1.0 * s), 0.08, shirt)
        limb((-0.33, -0.1, sh), (-0.38, -0.05 - arm_swing, 0.95 * s), 0.08, shirt)
    elif i == 1:  # ตะกร้าด้านหน้า
        basket = mat("basket", (0.78, 0.25, 0.2))
        cube((0, -0.55, 0.95 * s), (0.36, 0.2, 0.17), basket)
        cube((0, -0.55, 1.13 * s), (0.34, 0.18, 0.02), mat("goods", (0.4, 0.75, 0.95)))
        limb((-0.3, -0.55, 1.12 * s), (0.3, -0.55, 1.12 * s), 0.03, basket)
        limb((0.38, -0.1, sh), (0.3, -0.5, 1.15 * s), 0.09, shirt)
        limb((-0.38, -0.1, sh), (-0.3, -0.5, 1.15 * s), 0.09, shirt)
    elif i == 2:  # เป้ใหญ่ด้านหลัง + สายเป้
        pack = mat("pack", (0.2, 0.45, 0.85))
        cube((0, 0.38, 1.25 * s), (0.27, 0.15, 0.3), pack)
        for x in (-0.18, 0.18):
            limb((x, 0.25, sh), (x, -0.27, 1.05 * s), 0.03, pack)
        limb((0.3, 0, sh), (0.36, -0.05 + arm_swing, 0.95 * s), 0.07, shirt)
        limb((-0.3, 0, sh), (-0.36, -0.05 - arm_swing, 0.95 * s), 0.07, shirt)
    elif i == 3:  # แว่น + ถือสินค้ายกขึ้นอ่าน
        frame = mat("glasses", (0.05, 0.05, 0.05))
        for x in (-0.11, 0.11):
            ring((x, -0.27, 1.82), 0.075, 0.014, frame)
        limb((-0.04, -0.28, 1.82), (0.04, -0.28, 1.82), 0.015, frame)
        cube((0.2, -0.5, 1.55), (0.1, 0.05, 0.16), mat("item", (0.9, 0.2, 0.25)))
        cube((0.2, -0.56, 1.55), (0.07, 0.01, 0.05), mat("tag", (1.0, 0.87, 0.35)))
        limb((0.33, -0.1, sh), (0.24, -0.45, 1.5), 0.08, shirt)
        limb((-0.33, -0.1, sh), (-0.36, -0.05 - arm_swing, 0.95), 0.08, shirt)
    else:  # ลูกค้าทั่วไป
        limb((0.33, 0, sh), (0.38, -0.05, 0.95), 0.08, shirt)
        limb((-0.33, 0, sh), (-0.38, -0.05, 0.95), 0.08, shirt)
    return 2.2 * s


def build_item(product, size):
    big = size == "big"
    if product == "water":
        body = mat("water", (0.55, 0.8, 0.95), rough=0.1, alpha=0.6)
        h = 1.4 if big else 0.9
        cyl((0, 0, h / 2), 0.28 if big else 0.2, h, body)
        cyl((0, 0, h + 0.08), 0.09, 0.16, mat("cap", (0.1, 0.4, 0.85) if big else (0.15, 0.7, 0.3)))
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
def main(walking_only=False, poses_only=False):
    items = [(product, size) for product in ("water", "snack", "household") for size in ("small", "big")]
    base_keys = ["shelf", "counter", *(f"customer_{i}" for i in range(1, 6))]
    base_keys.extend(f"item_{product}_{size}" for product, size in items)
    walk_keys = [f"customer_{i + 1}_walk" for i in range(4)]
    pose_keys = [f"customer_{i + 1}_{pose}" for i, pose in POSES]
    if poses_only:
        # เรนเดอร์เฉพาะท่ากระทำ ไม่แตะไฟล์ภาพเดิม แล้วเขียน manifest ให้ครบทุกคีย์
        missing = [key for key in base_keys + walk_keys if not os.path.isfile(os.path.join(OUT, f"{key}.png"))]
        if missing:
            raise RuntimeError(f"Run the full render first; missing sprites: {', '.join(missing)}")
        for (i, pose), key in zip(POSES, pose_keys):
            scn = reset_scene(); build_customer(i, pose=pose); camera_and_light(scn, 2.2, "customer_pose", 1.25)
            render(scn, key)
        write_manifest(base_keys + walk_keys + pose_keys)
        return
    if walking_only:
        missing = [key for key in base_keys if not os.path.isfile(os.path.join(OUT, f"{key}.png"))]
        if missing:
            raise RuntimeError(f"Run the full render first; missing sprites: {', '.join(missing)}")
    else:
        scn = reset_scene(); h = build_shelf(); camera_and_light(scn, h, "shelf", 3.2)
        render(scn, "shelf")

        scn = reset_scene(); h = build_counter(); camera_and_light(scn, h, "counter", 4.2)
        render(scn, "counter")

        for i in range(5):
            scn = reset_scene(); build_customer(i); camera_and_light(scn, 2.2, "customer", 1.25)
            render(scn, f"customer_{i + 1}")

        for product, size in items:
            scn = reset_scene(); h = build_item(product, size); camera_and_light(scn, h, "item", 1.0)
            render(scn, f"item_{product}_{size}")

    for i in range(4):
        scn = reset_scene()
        build_customer(i, walking=True)
        camera_and_light(scn, 2.2, "customer", 1.25)  # ใช้กรอบเดียวกับท่ายืน
        render(scn, walk_keys[i])
    # ท่ากระทำเรนเดอร์แยกด้วย --poses-only และรวมใน manifest เมื่อมีไฟล์อยู่แล้ว
    write_manifest(base_keys + walk_keys + [key for key in pose_keys if os.path.isfile(os.path.join(OUT, f"{key}.png"))])


def write_manifest(keys):
    lines = ",\n".join(f'  {key}: "assets/sprites/{key}.png"' for key in keys)
    with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("/* สร้างอัตโนมัติโดย blender/generate_store_assets.py — ดู docs/ART_SPEC.md */\n")
        f.write("window.MTL_SPRITE_MANIFEST = {\n" + lines + "\n};\n")
    print("manifest written:", len(keys), "sprites")


main(walking_only="--walking-only" in sys.argv, poses_only="--poses-only" in sys.argv)
